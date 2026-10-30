// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import html from '../example/blocks.html?raw'
import {scenarios, schema} from '../example/src/blocks-scenarios.js'
import {compareDocumentBlocks} from '../src/blocks.js'
import {renderDocument, changeEntries} from '../example/src/blocks-view.js'
import {createTextReview} from '../example/src/text-review-view.js'
import {calculateTextReview, reviewTextChange} from '../example/src/text-review.js'

const byId = id => document.getElementById(id)
let workers
let originalScroll
class DeferredWorker {
  constructor() { workers.push(this) }
  postMessage(data) { this.sent = structuredClone(data) }
  terminate = vi.fn()
  deliver(data = {requestId: this.sent.requestId, result: calculateTextReview(this.sent)}) { this.onmessage({data}) }
}
function fixture(id = 'budget') {
  const scenario = scenarios.find(s => s.id === id)
  const views = {old: renderDocument(scenario.oldDoc, byId('before')), new: renderDocument(scenario.newDoc, byId('after'))}
  const entries = changeEntries(compareDocumentBlocks(scenario.oldDoc, scenario.newDoc, {maxDepth: 1})).entries
  return {views, entries}
}
const controller = () => createTextReview({workerFactory: () => new DeferredWorker()})
beforeEach(() => {
  workers = []
  originalScroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
  Object.defineProperty(Element.prototype, 'scrollIntoView', {configurable: true, value: vi.fn()})
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML
})
afterEach(() => {
  if (originalScroll) Object.defineProperty(Element.prototype, 'scrollIntoView', originalScroll)
  else delete Element.prototype.scrollIntoView
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

it('shows pending immediately and sends only strings, offsets and request ID', () => {
  const {entries, views} = fixture('text-unicode')
  controller().select(entries[0], views)
  expect(byId('text-status').dataset.state).toBe('pending')
  expect(byId('text-changes').children).toHaveLength(0)
  expect(byId('text-next').disabled).toBe(true)
  expect(Object.keys(workers[0].sent).sort()).toEqual(['newStart', 'newText', 'oldStart', 'oldText', 'requestId'])
  expect(typeof workers[0].sent.oldText).toBe('string')
  workers[0].deliver()
  expect(byId('text-status').dataset.state).toBe('ready')
  expect(byId('before').querySelector('.selected-text-change').textContent).toBe('👨‍👩‍👧‍👦')
  expect(byId('text-changes').children).toHaveLength(reviewTextChange(entries[0].change).hunks.length)
  expect(workers[0].terminate).toHaveBeenCalledOnce()
})

it('terminates superseded work and ignores late success/error/messageerror after A to B', () => {
  const {entries, views} = fixture()
  const review = controller()
  review.select(entries[0], views)
  const old = workers[0]
  review.select(entries[1], views)
  expect(old.terminate).toHaveBeenCalledOnce()
  old.deliver()
  old.onerror({preventDefault: vi.fn()})
  old.onmessageerror({})
  expect(byId('text-status').dataset.state).toBe('pending')
  expect(byId('text-owner').textContent).toContain('2')
  workers[1].deliver({requestId: old.sent.requestId, result: calculateTextReview(old.sent)})
  expect(byId('text-status').dataset.state).toBe('pending')
  workers[1].deliver()
  expect(byId('text-status').dataset.state).toBe('ready')
  expect(byId('text-owner').textContent).toContain('2')
})

it('cancels and safely restarts the same pending entry, then reuses its completed cache', () => {
  const {entries, views} = fixture('text-unicode')
  const review = controller()
  review.select(entries[0], views)
  review.select(entries[0], views)
  expect(workers).toHaveLength(2)
  expect(workers[0].terminate).toHaveBeenCalledOnce()
  workers[0].deliver()
  expect(byId('text-status').dataset.state).toBe('pending')
  workers[1].deliver()
  review.select(entries[0], views)
  expect(workers).toHaveLength(2)
  expect(byId('text-status').dataset.state).toBe('ready')
})

it('disposes pending work and prevents all old callbacks and future selection from changing UI', () => {
  const {entries, views} = fixture()
  const review = controller()
  review.select(entries[0], views)
  review.dispose()
  expect(workers[0].terminate).toHaveBeenCalledOnce()
  const content = byId('text-status').textContent
  workers[0].deliver()
  workers[0].onerror({preventDefault: vi.fn()})
  workers[0].onmessageerror({})
  review.select(entries[1], views)
  expect(workers).toHaveLength(1)
  expect(byId('text-status').textContent).toBe(content)
  expect(byId('text-changes').children).toHaveLength(0)
})

it.each(['factory', 'post', 'error', 'messageerror', 'response'])('handles %s failure without synchronous fallback or losing block originals', failure => {
  const {entries, views} = fixture('text-unicode')
  const review = createTextReview({workerFactory: () => {
    if (failure === 'factory') throw Error('private detail')
    const worker = new DeferredWorker()
    if (failure === 'post') worker.postMessage = () => { throw Error('private detail') }
    return worker
  }})
  review.select(entries[0], views)
  if (failure === 'error') workers[0].onerror({preventDefault: vi.fn()})
  if (failure === 'messageerror') workers[0].onmessageerror({})
  if (failure === 'response') workers[0].deliver({requestId: workers[0].sent.requestId, error: true})
  expect(byId('text-status').dataset.state).toBe('unavailable')
  expect(byId('text-status').textContent).not.toContain('private detail')
  expect(byId('text-changes').children).toHaveLength(0)
  expect(byId('before').querySelector('.source-text').textContent).toBe(entries[0].change.before[0].textContent)
  if (workers.length) expect(workers[0].terminate).toHaveBeenCalledOnce()
})

it('does not create workers for unsupported or oversized inputs and cancels prior pending work', () => {
  const review = controller()
  const first = fixture('text-unicode')
  review.select(first.entries[0], first.views)
  const marked = fixture('text-inline-atom')
  review.select(marked.entries[0], marked.views)
  expect(workers).toHaveLength(1)
  expect(workers[0].terminate).toHaveBeenCalledOnce()
  const p = schema.node('paragraph', null, schema.text('a'.repeat(10001)))
  review.select({label: 'large', change: {kind: 'replace', before: [p], after: [p], oldFrom: 0, newFrom: 0}}, {})
  expect(workers).toHaveLength(1)
  expect(byId('text-status').textContent).toContain('20,000')
})

it('preserves consecutive whitespace and newlines through highlighting and restoration', () => {
  const oldNode = schema.node('paragraph', null, schema.text('  a\n\n end  '))
  const newNode = schema.node('paragraph', null, schema.text('  b\n\n end  '))
  const views = {old: renderDocument(schema.node('doc', null, oldNode), byId('before')), new: renderDocument(schema.node('doc', null, newNode), byId('after'))}
  const review = controller()
  review.select({label: '1', scopes: {old: -1, new: -1}, change: {kind: 'replace', before: [oldNode], after: [newNode], oldFrom: 0, newFrom: 0}}, views)
  workers[0].deliver()
  expect(byId('before').querySelector('.source-text').textContent).toBe(oldNode.textContent)
  review.select(undefined, views)
  expect(byId('before').querySelector('.source-text').textContent).toBe(oldNode.textContent)
  expect(byId('after').querySelector('.source-text').textContent).toBe(newNode.textContent)
  expect(byId('before').querySelector('.selected-text-change')).toBeNull()
})

it('disposes the previous actual-page controller on scenario reload while keeping block navigation usable', async () => {
  vi.resetModules()
  vi.stubGlobal('Worker', DeferredWorker)
  await import('../example/src/blocks-demo-entry.js')
  const choose = value => { byId('scenario').value = value; byId('scenario').dispatchEvent(new Event('change')) }
  choose('text-unicode')
  const old = workers[0]
  choose('budget')
  expect(old.terminate).toHaveBeenCalledOnce()
  old.deliver()
  expect(byId('text-owner').textContent).toBe('Selected block event 1')
  expect(byId('text-status').dataset.state).toBe('pending')
  workers[1].onmessageerror({})
  expect(byId('next').disabled).toBe(false)
  byId('next').click()
  expect(byId('status').textContent).toContain('Change 2 of 2')
  expect(workers).toHaveLength(3)
})

it('runs the actual worker protocol with string payloads and matching Unicode results', async () => {
  vi.resetModules()
  const endpoint = {postMessage: vi.fn()}
  vi.stubGlobal('self', endpoint)
  await import('../example/src/text-review-worker.js')
  const input = {requestId: 42, oldText: 'e\u0301 👩‍💻', newText: 'é 🇨🇦', oldStart: 7, newStart: 12}
  endpoint.onmessage({data: input})
  expect(endpoint.postMessage).toHaveBeenCalledWith({requestId: 42, result: calculateTextReview(input)})
})
