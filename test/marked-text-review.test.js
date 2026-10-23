// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import {Schema} from 'prosemirror-model'
import html from '../example/blocks.html?raw'
import {schema, scenarios} from '../example/src/blocks-scenarios.js'
import {renderDocument} from '../example/src/blocks-view.js'
import {createTextReview} from '../example/src/text-review-view.js'
import {reviewTextChange, calculateTextReview} from '../example/src/text-review.js'

const byId = id => document.getElementById(id)
const t = (value, ...marks) => schema.text(value, marks.map(mark => typeof mark === 'string' ? schema.mark(mark) : mark))
const p = content => schema.node('paragraph', null, content)
const source = side => byId(side).querySelector('.source-text')
let workers, scrollDescriptor
class DeferredWorker {
  constructor() { workers.push(this) }
  terminate = vi.fn()
  postMessage(data) { this.sent = structuredClone(data) }
  finish() { this.onmessage({data: {requestId: this.sent.requestId, result: calculateTextReview(this.sent)}}) }
}
function mount(oldNode, newNode) {
  const views = {old: renderDocument(schema.node('doc', null, oldNode), byId('before')),
    new: renderDocument(schema.node('doc', null, newNode), byId('after'))}
  const entry = {label: '1', scopes: {old: -1, new: -1}, change: {kind: 'replace', before: [oldNode], after: [newNode], oldFrom: 0, newFrom: 0}}
  return {views, entry, controller: createTextReview({workerFactory: () => new DeferredWorker()})}
}

// Independent oracle: compare each UTF-16 position's original mark types/attrs
// with its actual DOM ancestors. This does not reuse the renderer's support test.
function assertOriginal(root, node) {
  const expected = []
  node.forEach(child => {
    for (let i = 0; i < child.text.length; i++) expected.push({unit: child.text[i], marks: child.marks.map(mark => ({name: mark.type.name, attrs: {...mark.attrs}})).sort((a, b) => a.name.localeCompare(b.name))})
  })
  const actual = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const marks = []
    for (let parent = text.parentElement; parent && parent !== root; parent = parent.parentElement) {
      if (parent.dataset.mark) {
        expect(parent.tagName).toBe(parent.dataset.mark === 'link' ? 'SPAN' : parent.dataset.mark.toUpperCase())
        expect(parent.hasAttribute('href')).toBe(false)
        marks.push({name: parent.dataset.mark, attrs: JSON.parse(parent.dataset.markAttrs)})
      }
    }
    marks.sort((a, b) => a.name.localeCompare(b.name))
    for (let i = 0; i < text.nodeValue.length; i++) actual.push({unit: text.nodeValue[i], marks})
  }
  expect(root.textContent).toBe(node.textContent)
  expect(actual).toEqual(expected)
}

beforeEach(() => {
  workers = []
  scrollDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
  Object.defineProperty(Element.prototype, 'scrollIntoView', {configurable: true, value: vi.fn()})
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML
})
afterEach(() => {
  if (scrollDescriptor) Object.defineProperty(Element.prototype, 'scrollIntoView', scrollDescriptor)
  else delete Element.prototype.scrollIntoView
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

it('keeps excluding code marks valid without inserting diff marks into ProseMirror nodes', () => {
  const a = p(t('cat', 'code')), b = p(t('cart', 'code'))
  const {controller, entry, views} = mount(a, b)
  controller.select(entry, views)
  workers[0].finish()
  expect(byId('text-status').textContent).toContain('insert')
  assertOriginal(source('before'), a)
  assertOriginal(source('after'), b)
  expect(source('after').querySelector('code .selected-text-change').textContent).toBe('r')
  controller.select(undefined, views)
  assertOriginal(source('before'), a)
  assertOriginal(source('after'), b)
  a.check(); b.check()
  expect(a.firstChild.marks.map(mark => mark.type.name)).toEqual(['code'])
})

it('retains every side-specific overlapping and adjacent mark through selection, restoration and cache', () => {
  const link = schema.mark('link', {href: 'https://example.org/?q=<img>', title: '"notes" <script>'})
  const a = p([t('cat', 'strong', 'em'), t(' link', link), t(' x()', 'code')])
  const b = p([t('cats', 'em'), t(' link', 'strong', link), t(' y()', 'code')])
  const {controller, entry, views} = mount(a, b)
  controller.select(entry, views)
  expect(byId('text-status').dataset.state).toBe('pending')
  workers[0].finish()
  for (let i = 0; i < 2; i++) {
    assertOriginal(source('before'), a)
    assertOriginal(source('after'), b)
    byId('text-next').click()
  }
  controller.select(undefined, views)
  assertOriginal(source('before'), a)
  assertOriginal(source('after'), b)
  controller.select(entry, views)
  expect(workers).toHaveLength(1)
  assertOriginal(source('before'), a)
  assertOriginal(source('after'), b)
  expect(byId('text-format-scope').textContent).toContain('Formatting is not independently compared')
})

it('keeps a whole changed grapheme across original mark boundaries', () => {
  const a = p([t('e'), t('\u0301', 'strong')]), b = p([t('e'), t('\u0300', 'em')])
  const {controller, entry, views} = mount(a, b)
  controller.select(entry, views)
  workers[0].finish()
  expect(byId('text-status').textContent).toContain('Before [1, 3), After [1, 3)')
  expect([...source('before').querySelectorAll('.selected-text-change')].map(n => n.textContent).join('')).toBe('e\u0301')
  expect(source('before').querySelector('strong').textContent).toBe('\u0301')
  assertOriginal(source('before'), a)
  assertOriginal(source('after'), b)
})

it('preserves link snapshots and forbids navigation while text and href/title change', () => {
  const a = p(t('read', schema.mark('link', {href: 'javascript:alert(1)', title: ''})))
  const b = p(t('read more', schema.mark('link', {href: 'https://example.org/<img>', title: '<script>x</script>'})))
  const {controller, entry, views} = mount(a, b)
  controller.select(entry, views); workers[0].finish()
  assertOriginal(source('before'), a); assertOriginal(source('after'), b)
  expect(byId('before').querySelector('.mark-descriptions').textContent).toContain('href "javascript:alert(1)"; title ""')
  expect(byId('after').querySelector('.mark-descriptions').textContent).toContain('<script>x</script>')
  expect(document.querySelectorAll('.source-text a, .source-text [href], .source-text [onclick], .mark-descriptions script, .mark-descriptions img')).toHaveLength(0)
  const description = byId('after').querySelector('.mark-descriptions').textContent
  controller.select(undefined, views)
  expect(byId('after').querySelector('.mark-descriptions').textContent).toBe(description)
  assertOriginal(source('after'), b)
})

it('reports formatting-only replacements even with zero text hunks and preserves empty markers', () => {
  const a = p(t('cat')), b = p(t('cat', 'strong'))
  const first = mount(a, b)
  first.controller.select(first.entry, first.views); workers[0].finish()
  expect(byId('text-status').textContent).toContain('Text unchanged; formatting differs')
  expect(byId('text-changes').children).toHaveLength(0)
  expect(byId('text-format-scope').hidden).toBe(false)
  assertOriginal(source('after'), b)
  first.controller.dispose()
  const empty = p([]), flag = p(t('🇨🇦', 'strong'))
  const second = mount(empty, flag)
  second.controller.select(second.entry, second.views); workers[1].finish()
  expect(source('before').querySelector('.text-position-marker').getAttribute('aria-label')).toBe('Insertion point at 1')
  assertOriginal(source('before'), empty); assertOriginal(source('after'), flag)
})

it('keeps repeated-letter alignment separate from formatting identity or history', () => {
  const a = p([t('a', 'strong'), t('a')]), b = p(t('a'))
  const {controller, entry, views} = mount(a, b)
  controller.select(entry, views); workers[0].finish()
  assertOriginal(source('before'), a); assertOriginal(source('after'), b)
  expect(byId('text-format-scope').textContent).toContain('ambiguous correspondence')
  expect(byId('text-format-scope').textContent).toContain('actual edit history')
})

it('places exactly one insertion marker between differently marked runs', () => {
  const a = p([t('a', 'strong'), t('b', 'em')]), b = p([t('a', 'strong'), t('x', 'code'), t('b', 'em')])
  const {controller, entry, views} = mount(a, b)
  controller.select(entry, views); workers[0].finish()
  expect(source('before').querySelectorAll('.text-position-marker')).toHaveLength(1)
  const marker = source('before').querySelector('.text-position-marker')
  expect(marker.dataset.from).toBe('2')
  expect(marker.previousSibling.tagName).toBe('STRONG')
  expect(marker.nextSibling.tagName).toBe('EM')
  assertOriginal(source('before'), a); assertOriginal(source('after'), b)
})

it('does not hide same-text link attribute changes or conflate null and empty titles', () => {
  const a = p(t('cat', schema.mark('link', {href: 'old', title: ''})))
  const b = p(t('cat', schema.mark('link', {href: 'new'})))
  const {controller, entry, views} = mount(a, b)
  controller.select(entry, views); workers[0].finish()
  expect(byId('text-status').textContent).toContain('Text unchanged; formatting differs')
  expect(byId('before').querySelector('.mark-descriptions').textContent).toContain('title ""')
  expect(byId('after').querySelector('.mark-descriptions').textContent).toContain('title null')
  expect(byId('text-changes').children).toHaveLength(0)
  assertOriginal(source('before'), a); assertOriginal(source('after'), b)
})

it('retains original formats across page changes, errors, cancellation and cached reselection', () => {
  const a = p(t('a|'.repeat(60), 'strong')), b = p(t('b|'.repeat(60), 'em'))
  const {controller, entry, views} = mount(a, b)
  controller.select(entry, views); workers[0].finish()
  expect(byId('text-changes').children).toHaveLength(50)
  byId('text-page-next').click()
  expect(byId('text-changes').children).toHaveLength(10)
  assertOriginal(source('before'), a); assertOriginal(source('after'), b)
  controller.select({...entry}, views)
  const old = workers[1]
  old.onerror({preventDefault: vi.fn()})
  expect(byId('text-status').dataset.state).toBe('unavailable')
  assertOriginal(source('before'), a); assertOriginal(source('after'), b)
  controller.select(entry, views)
  old.finish()
  expect(byId('text-status').dataset.state).toBe('ready')
  expect(workers).toHaveLength(2)
  assertOriginal(source('before'), a); assertOriginal(source('after'), b)
})

it('refuses unknown marks, supported names with extra attrs, and non-text inline children', () => {
  for (const name of ['strong', 'em', 'code', 'link', 'unknown']) {
    const custom = new Schema({nodes: {doc: {content: 'paragraph*'}, paragraph: {content: 'text*'}, text: {}}, marks: {[name]: {attrs: {unhandled: {default: 'value'}}}}})
    const a = custom.node('paragraph', null, custom.text('old', [custom.mark(name)]))
    const b = custom.node('paragraph', null, custom.text('new', [custom.mark(name)]))
    expect(reviewTextChange({kind: 'replace', before: [a], after: [b], oldFrom: 0, newFrom: 0})).toMatchObject({supported: false, reason: expect.stringContaining('unknown marks or mark attributes')})
  }
  for (const id of ['text-inline-atom', 'text-hard-break', 'marked-unknown']) {
    const item = scenarios.find(s => s.id === id)
    const a = item.oldDoc.firstChild, b = item.newDoc.firstChild
    const {controller, entry, views} = mount(a, b)
    controller.select(entry, views)
    expect(byId('text-status').dataset.state).toBe('unsupported')
  }
  expect(workers).toHaveLength(0)
  expect(byId('before').querySelector('.mark-descriptions').textContent).toContain('Unsupported mark highlight')
})
