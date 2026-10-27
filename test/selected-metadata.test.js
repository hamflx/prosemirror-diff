// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import html from '../example/blocks.html?raw'
import {schema, scenarios} from '../example/src/blocks-scenarios.js'
import {renderDocument, changeEntries} from '../example/src/blocks-view.js'
import {compareDocumentBlocks} from '../src/blocks.js'
import {createTextReview} from '../example/src/text-review-view.js'
import {createSelectedReview, selectedMetadata} from '../example/src/selected-review.js'
import {calculateTextReview} from '../example/src/text-review.js'
const el = id => document.getElementById(id)
let workers, review, originalScroll
class DeferredWorker {
  constructor() { workers.push(this) }
  postMessage(data) { this.sent = data }
  terminate = vi.fn()
  deliver() { this.onmessage({data: {requestId: this.sent.requestId, result: calculateTextReview(this.sent)}}) }
}
beforeEach(() => {
  workers = []
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML
  vi.stubGlobal('Worker', DeferredWorker)
  originalScroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
  Object.defineProperty(Element.prototype, 'scrollIntoView', {configurable: true, value: vi.fn()})
})
afterEach(() => { if (originalScroll) Object.defineProperty(Element.prototype, "scrollIntoView", originalScroll); else delete Element.prototype.scrollIntoView; review?.dispose(); review = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren() })
function setup(id) {
  const scenario = scenarios.find(s => s.id === id)
  const views = {old: renderDocument(scenario.oldDoc, el('before')), new: renderDocument(scenario.newDoc, el('after'))}
  const entries = changeEntries(compareDocumentBlocks(scenario.oldDoc, scenario.newDoc, {maxDepth: 2})).entries
  return {scenario, views, entries}
}
function select(id, index = 0) {
  review?.dispose()
  const fixture = setup(id)
  review = createSelectedReview(createTextReview())
  review.select(fixture.entries[index], fixture.views)
  return fixture
}
it('routes same-text strong changes to metadata without a text worker and preserves source marks', () => {
  select('text-marks')
  expect(el('metadata-status').dataset.state).toBe('ready')
  expect(el('metadata-changes').children).toHaveLength(1)
  expect(el('metadata-changes').textContent).toContain('strong')
  expect(el('before').querySelector('.selected-text-change').textContent).toBe('Same words')
  expect(el('after').querySelector('strong .selected-text-change').textContent).toBe('Same words')
  expect(workers).toHaveLength(0)
  review.dispose()
  expect(el('after').querySelector('strong').textContent).toBe('Same words')
  expect(el('after').querySelector('.selected-text-change')).toBeNull()
})
it.each(['metadata-link', 'image', 'text-inline-atom'])('locates %s metadata with literal snapshots', id => {
  const {entries} = select(id)
  expect(el('metadata-status').dataset.state).toBe('ready')
  expect(workers).toHaveLength(0)
  const record = selectedMetadata(entries[0].change).records[0]
  expect(el('metadata-changes').textContent).toContain(JSON.stringify(record.before, null, 2))
  expect(el('metadata-changes').textContent).toContain(JSON.stringify(record.after, null, 2))
  if (id !== 'metadata-link') {
    const target = el('before').querySelector('.selected-metadata-change')
    expect(target).not.toBeNull()
    if (id === 'text-inline-atom') expect(target.classList.contains('inline-token')).toBe(true)
  }
  expect(document.querySelectorAll('#metadata-changes a, .source-text a')).toHaveLength(0)
})
it('keeps distinct original offsets after an unrelated insertion', () => {
  const {entries} = select('metadata-shifted', 1)
  const record = selectedMetadata(entries[1].change).records[0]
  expect(record.oldFrom).not.toBe(record.newFrom)
  for (const [side, panel] of [['old','before'], ['new','after']]) {
    const highlight = el(panel).querySelector('.selected-text-change')
    expect(Number(highlight.dataset.from)).toBe(record[side + 'From'])
    expect(Number(highlight.dataset.to)).toBe(record[side + 'To'])
  }
})
it.each(['marked-mixed', 'metadata-atom-insert', 'strict-container'])('retains explicit partial/outside scope for %s', id => {
  const {scenario} = select(id)
  expect(el('metadata-status').dataset.state).toBe('outside')
  expect(el('metadata-status').textContent).toContain('identical text and structure')
  expect(el('metadata-changes').children).toHaveLength(0)
  expect(el('text-status').dataset.state).toBe(id === 'marked-mixed' ? 'pending' : 'unsupported')
  scenario.oldDoc.check(); scenario.newDoc.check()
})
it('pages every record with edge focus and resets the page on selection', () => {
  const fixture = select('metadata-many')
  expect(el('metadata-changes').children).toHaveLength(50)
  el('metadata-page-next').focus(); el('metadata-page-next').click(); el('metadata-page-next').click()
  expect(el('metadata-changes').children).toHaveLength(2)
  expect(el('metadata-page-status').textContent).toContain('101-102 of 102')
  expect(document.activeElement).toBe(el('metadata-page-previous'))
  el('metadata-next').click()
  expect(el('metadata-status').textContent).toContain('102 of 102')
  el('metadata-previous').click()
  expect(el('metadata-status').textContent).toContain('101 of 102')
  review.select(fixture.entries[0], fixture.views)
  expect(el('metadata-page-status').textContent).toContain('1-50 of 102')
})
it('invalidates pending worker callbacks when selecting metadata, then can return to text', () => {
  const a = setup('marked-mixed')
  review = createSelectedReview(createTextReview())
  review.select(a.entries[0], a.views)
  const old = workers[0]
  const b = setup('text-marks')
  review.select(b.entries[0], b.views)
  expect(old.terminate).toHaveBeenCalledOnce()
  old.deliver(); old.onerror({preventDefault: vi.fn()}); old.onmessageerror({})
  expect(el('metadata-status').dataset.state).toBe('ready')
  expect(el('after').querySelector('strong .selected-text-change').textContent).toBe('Same words')
  const c = setup('marked-mixed')
  review.select(c.entries[0], c.views)
  expect(el('metadata-changes').children).toHaveLength(0)
  expect(el('metadata-status').dataset.state).toBe('outside')
  workers[1].deliver()
  expect(el('text-status').dataset.state).toBe('ready')
  review.dispose()
  workers[1].deliver()
  expect(document.querySelectorAll('.selected-text-change, .selected-metadata-change')).toHaveLength(0)
})
it('does not misclassify invalid positions or Node.check errors as expected scope rejection', () => {
  const p = schema.node('paragraph', null, schema.text('x'))
  const change = {kind:'replace', before:[p], after:[p], oldFrom:-1, newFrom:0}
  expect(selectedMetadata(change).state).toBe('unavailable')
  change.oldFrom = 0; change.before = [schema.nodes.container.create()]
  expect(selectedMetadata(change).state).toBe('unavailable')
})
it('clears prior metadata on validation failure, missing selection and unsupported renderer targets', () => {
  const fixture = select('text-marks')
  review.select({...fixture.entries[0], change: {...fixture.entries[0].change, oldFrom:-1}}, fixture.views)
  expect(el('metadata-status').dataset.state).toBe('unavailable')
  expect(document.querySelectorAll('.selected-text-change')).toHaveLength(0)
  expect(el('metadata-changes').children).toHaveLength(0)
  review.select(fixture.entries[0], {old:{targets:[]}, new:{targets:[]}})
  expect(el('metadata-status').dataset.state).toBe('unsupported')
  review.select(undefined, fixture.views)
  expect(el('metadata-changes').children).toHaveLength(0)
})
it('integrates the actual page, disposes on reload and keeps parent navigation', async () => {
  vi.resetModules()
  await import('../example/src/blocks-demo.js')
  const choose = value => { el('scenario').value = value; el('scenario').dispatchEvent(new Event('change')) }
  choose('text-unicode'); const old = workers[0]
  choose('text-marks')
  old.deliver()
  expect(old.terminate).toHaveBeenCalledOnce()
  expect(el('metadata-status').dataset.state).toBe('ready')
  expect(el('changes').children).toHaveLength(1)
  choose('unchanged')
  expect(el('metadata-changes').children).toHaveLength(0)
  expect(document.querySelectorAll('.selected-text-change, .selected-metadata-change')).toHaveLength(0)
})
function direct(oldNode, newNode, oldFrom = 0, newFrom = 0) {
  const oldLead = oldFrom ? [schema.node('paragraph', null, schema.text('x'.repeat(oldFrom - 2)))] : []
  const newLead = newFrom ? [schema.node('paragraph', null, schema.text('x'.repeat(newFrom - 2)))] : []
  const views = {old: renderDocument(schema.node('doc', null, [...oldLead, oldNode]), el('before')),
    new: renderDocument(schema.node('doc', null, [...newLead, newNode]), el('after'))}
  const entry = {label:'chosen', scopes:{old:-1,new:-1}, change:{kind:'replace', before:[oldNode], after:[newNode], oldFrom, newFrom}}
  review = createSelectedReview(createTextReview()); review.select(entry, views)
  return {views, entry}
}
it.each([0, 1, 50, 51])('handles %i metadata records without an empty extra page', count => {
  const node = side => schema.node('paragraph', null, Array.from({length:count}, (_, i) =>
    schema.text('x', [schema.mark('link', {href:side + '/' + i})])))
  direct(node('old'), node('new'))
  expect(el('metadata-status').dataset.state).toBe('ready')
  expect(el('metadata-changes').children).toHaveLength(Math.min(count, 50))
  expect(el('metadata-page-next').disabled).toBe(count <= 50)
  if (!count) expect(el('metadata-status').textContent).toContain('selected node')
  if (count > 50) {
    el('metadata-page-next').click()
    expect(el('metadata-changes').children).toHaveLength(1)
    expect(el('metadata-next').disabled).toBe(true)
  }
})
it('locates nested mark fragments inside a grapheme at separate original offsets and preserves literal attributes', () => {
  const old = schema.node('section', null, schema.node('paragraph', null, schema.text('e\u0301')))
  const next = schema.node('section', null, schema.node('paragraph', null, [schema.text('e'),
    schema.text('\u0301', [schema.mark('link', {href:'javascript:<img>', title:'<script>literal</script>'})])]))
  direct(old, next, 4, 7)
  const a = el('before').querySelector('.selected-text-change'), b = el('after').querySelector('.selected-text-change')
  expect([a.dataset.from,a.dataset.to,b.dataset.from,b.dataset.to]).toEqual(['7','8','10','11'])
  expect(a.textContent).toBe('\u0301')
  expect(b.closest('[data-mark="link"]').tagName).toBe('SPAN')
  expect(el('metadata-changes').textContent).toContain('javascript:<img>')
  expect(el('metadata-changes').querySelector('img, script, a')).toBeNull()
  review.dispose()
  expect(el('after').querySelector('.child-content .source-text').textContent).toBe('e\u0301')
  expect(el('after').querySelector('[data-mark="link"]').textContent).toBe('\u0301')
})
it('shows snapshot errors and does not fall back to a text worker', () => {
  const p = attrs => schema.node('paragraph', null, schema.text('x', [schema.mark('link', attrs)]))
  direct(p({href:new Date()}), p({href:'new'}))
  expect(el('metadata-status').dataset.state).toBe('unavailable')
  expect(el('metadata-changes').children).toHaveLength(0)
  expect(workers).toHaveLength(0)
})
