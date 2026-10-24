// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import html from '../example/blocks.html?raw'
import {scenarios} from '../example/src/blocks-scenarios.js'

const byId = id => document.getElementById(id)
const choose = (id, value) => {
  byId(id).value = value
  byId(id).dispatchEvent(new Event('change', {bubbles: true}))
}
const source = side => byId(side).querySelector('.source-text')
const highlight = side => byId(side).querySelector('.selected-text-change, .text-position-marker')
let originalScroll
let diffSpy
beforeEach(async () => {
  vi.resetModules()
  diffSpy = vi.spyOn(await import('../src/diff.js'), 'diffGraphemes')
  const {calculateTextReview} = await import('../example/src/text-review.js')
  // These range/render tests use an immediate deterministic worker double.
  // Deferred delivery, cancellation and failures have a separate lifecycle suite.
  vi.stubGlobal('Worker', class {
    postMessage(data) { this.onmessage({data: {requestId: data.requestId, result: calculateTextReview(data)}}) }
    terminate() {}
  })
  originalScroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
  Object.defineProperty(Element.prototype, 'scrollIntoView', {configurable: true, value: vi.fn()})
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML
  await import('../example/src/blocks-demo.js')
})
afterEach(() => {
  diffSpy.mockRestore()
  vi.unstubAllGlobals()
  if (originalScroll) Object.defineProperty(Element.prototype, 'scrollIntoView', originalScroll)
  else delete Element.prototype.scrollIntoView
  document.body.replaceChildren()
})

it('keeps block events and a separate text list with original Unicode in both documents', () => {
  choose('scenario', 'text-unicode')
  expect(byId('changes').querySelectorAll('li')).toHaveLength(1)
  expect(byId('text-changes').children).toHaveLength(2)
  expect(highlight('before').textContent).toBe('👨‍👩‍👧‍👦')
  byId('text-next').click()
  expect(highlight('before').textContent).toBe('e\u0301')
  expect(highlight('after').textContent).toBe('é')
  expect(highlight('before').dataset.from).toBe('15')
  expect(byId('text-next').disabled).toBe(true)
  byId('text-previous').click()
  expect(byId('text-previous').disabled).toBe(true)
  const fixture = scenarios.find(s => s.id === 'text-unicode')
  expect(source('before').textContent).toBe(fixture.oldDoc.firstChild.textContent)
  expect(source('after').textContent).toBe(fixture.newDoc.firstChild.textContent)
  expect(byId('text-precision').textContent).toContain('fallback status is not exposed')
})

it('locates empty text and inline boundary markers without inserting label text into the source', () => {
  choose('scenario', 'text-empty')
  expect(source('before').textContent).toBe('')
  expect(highlight('before').parentElement).toBe(source('before'))
  expect(highlight('before').getAttribute('aria-label')).toBe('Insertion point at 1')
  expect(highlight('after').textContent).toBe('🇨🇦')
  choose('scenario', 'text-empty-delete')
  expect(highlight('after').getAttribute('aria-label')).toBe('Deletion point at 1')
  expect(source('after').textContent).toBe('')
  choose('scenario', 'text-boundaries')
  for (const position of ['1', '2', '3']) {
    expect(highlight('before').dataset.from).toBe(position)
    expect(highlight('before').previousSibling?.textContent ?? '').toBe('AB'.slice(0, Number(position) - 1))
    expect(highlight('before').nextSibling?.textContent ?? '').toBe('AB'.slice(Number(position) - 1))
    expect(source('before').textContent).toBe('AB')
    expect(source('after').textContent).toBe('xAyBz')
    byId('text-next').click()
  }
})

it('refines only the selected nested textblock and clears text state when parent or scenario changes', () => {
  choose('scenario', 'text-nested')
  choose('depth', '1')
  expect(byId('text-changes').children).toHaveLength(0)
  byId('next').click()
  expect(byId('text-owner').textContent).toContain('1.1')
  expect(highlight('before').dataset.from).toBe('11')
  expect(highlight('before').closest('.block').dataset.scope).toBe('0')
  byId('previous').click()
  expect(highlight('before')).toBeNull()
  expect(byId('text-next').disabled).toBe(true)
  byId('next').click()
  choose('budget', '0')
  expect(highlight('before')).toBeNull()
  choose('scenario', 'unchanged')
  expect(byId('text-changes').children).toHaveLength(0)
  expect(byId('text-owner').textContent).toBe('No selected block event')
})

it('routes same-text formatting and inline attributes to metadata while preserving source originals', () => {
  choose('scenario', 'text-marks')
  expect(source('after').querySelector('strong').textContent).toBe('Same words')
  expect(byId('text-status').textContent).toContain('metadata review is active')
  expect(byId('metadata-changes').textContent).toContain('strong')
  expect(byId('text-changes').children).toHaveLength(0)
  choose('scenario', 'text-inline-atom')
  expect(source('before').querySelector('.inline-token').textContent).toBe('[old token]')
  expect(source('after').querySelector('.inline-token').textContent).toBe('[new token]')
  expect(byId('metadata-status').dataset.state).toBe('ready')
  expect(byId('before').querySelector('.inline-token').classList.contains('selected-metadata-change')).toBe(true)
  expect(highlight('before')).toBeNull()
})

it('uses independent old/new nested offsets after an earlier sibling changes length', () => {
  choose('scenario', 'text-nested-shifted')
  choose('depth', '1')
  byId('next').click()
  byId('next').click()
  expect(byId('text-owner').textContent).toContain('1.2')
  expect(highlight('before').dataset.from).toBe('16')
  expect(highlight('after').dataset.from).toBe('24')
  expect(highlight('before').textContent).toBe('👨‍👩‍👧‍👦')
  expect(highlight('after').textContent).toBe('👩‍👩‍👧‍👦')
})

it('compares only the selected block and reuses its details within one comparison result', () => {
  expect(diffSpy).not.toHaveBeenCalled()
  choose('scenario', 'budget')
  expect(diffSpy).toHaveBeenCalledTimes(1)
  byId('next').click()
  expect(diffSpy).toHaveBeenCalledTimes(2)
  byId('previous').click()
  expect(diffSpy).toHaveBeenCalledTimes(2)
  choose('scenario', 'text-inline-atom')
  expect(diffSpy).toHaveBeenCalledTimes(2)
})

it('renders source strings as text rather than HTML', async () => {
  const {schema} = await import('../example/src/blocks-scenarios.js')
  const {renderDocument} = await import('../example/src/blocks-view.js')
  const {createTextReview} = await import('../example/src/text-review-view.js')
  const oldNode = schema.node('paragraph', null, schema.text('<img src=x onerror=alert(1)>'))
  const newNode = schema.node('paragraph', null, schema.text('<script>alert(1)</script>'))
  const views = {
    old: renderDocument(schema.node('doc', null, oldNode), byId('before')),
    new: renderDocument(schema.node('doc', null, newNode), byId('after'))
  }
  createTextReview().select({label: '1', scopes: {old: -1, new: -1}, change: {kind: 'replace', before: [oldNode], after: [newNode], oldFrom: 0, newFrom: 0}}, views)
  expect(source('before').textContent).toBe(oldNode.textContent)
  expect(source('after').textContent).toBe(newNode.textContent)
  expect(byId('before').querySelector('img,script')).toBeNull()
  expect(byId('after').querySelector('img,script')).toBeNull()
})

it('locates formatted nested children using independent original positions', () => {
  choose('scenario', 'marked-nested')
  choose('depth', '1')
  byId('next').click()
  byId('next').click()
  expect(highlight('before').dataset.from).toBe('13')
  expect(highlight('after').dataset.from).toBe('21')
  expect(highlight('before').parentElement.tagName).toBe('CODE')
  expect(highlight('after').parentElement.tagName).toBe('CODE')
  choose('scenario', 'marked-unknown')
  expect(byId('text-status').dataset.state).toBe('unsupported')
  expect(highlight('before')).toBeNull()
  expect(byId('text-format-scope').hidden).toBe(false)
})
