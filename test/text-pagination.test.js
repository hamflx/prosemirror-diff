// @vitest-environment jsdom
import {beforeEach, afterEach, expect, it, vi} from 'vitest'
import html from '../example/blocks.html?raw'
import {schema} from '../example/src/blocks-scenarios.js'
import {renderDocument} from '../example/src/blocks-view.js'
import {createTextReview} from '../example/src/text-review-view.js'
const byId = id => document.getElementById(id)
const source = side => byId(side).querySelector('.source-text')
let workers, scrollDescriptor
class WorkerDouble {
  constructor() { workers.push(this) }
  postMessage(input) { this.input = input }
  terminate = vi.fn()
  deliver(hunks) { this.onmessage({data: {requestId: this.input.requestId, result: {...this.input, supported: true, hunks}}}) }
}
function setup(count, insertion = false) {
  // Legal deterministic result isolates pagination from the diff algorithm's deadline.
  const oldText = insertion ? 'a'.repeat(count) : 'a '.repeat(count)
  const newText = insertion ? 'ba'.repeat(count) : 'b '.repeat(count)
  const p = text => schema.node('paragraph', null, text ? schema.text(text) : null)
  const old = p(oldText), next = p(newText)
  const views = {old: renderDocument(schema.node('doc', null, old), byId('before')), new: renderDocument(schema.node('doc', null, next), byId('after'))}
  const entry = {label: '1', scopes: {old: -1, new: -1}, change: {kind: 'replace', before: [old], after: [next], oldFrom: 0, newFrom: 0}}
  const hunks = Array.from({length: count}, (_, i) => insertion
    ? {kind: 'insert', oldFrom: i + 1, oldTo: i + 1, newFrom: i * 2 + 1, newTo: i * 2 + 2}
    : {kind: 'replace', oldFrom: i * 2 + 1, oldTo: i * 2 + 2, newFrom: i * 2 + 1, newTo: i * 2 + 2})
  const review = createTextReview({workerFactory: () => new WorkerDouble()})
  review.select(entry, views)
  workers.at(-1).deliver(hunks)
  return {review, entry, views, hunks, oldText, newText}
}
beforeEach(() => {
  workers = []
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML
  scrollDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
  Object.defineProperty(Element.prototype, 'scrollIntoView', {configurable: true, value: vi.fn()})
})
afterEach(() => {
  if (scrollDescriptor) Object.defineProperty(Element.prototype, 'scrollIntoView', scrollDescriptor)
  else delete Element.prototype.scrollIntoView
  document.body.replaceChildren()
})
it.each([0, 1, 50, 51, 600])('shows accurate initial page bounds for %i returned hunks', count => {
  setup(count)
  expect(byId('text-changes').children).toHaveLength(Math.min(count, 50))
  expect(byId('text-page-status').textContent).toContain(`of ${count} text details`)
  expect(byId('text-page-status').textContent).toContain(`Page ${count ? 1 : 0} of ${Math.ceil(count / 50)}`)
  expect(byId('text-page-previous').disabled).toBe(true)
  expect(byId('text-page-next').disabled).toBe(count <= 50)
  expect(byId('text-next').disabled).toBe(count <= 1)
})
it('keeps every hunk reachable with global navigation and accurate source ranges', () => {
  const {hunks, oldText, newText} = setup(600)
  for (let i = 0; i < hunks.length; i++) {
    expect(byId('text-status').textContent).toContain(`Text detail ${i + 1} of 600:`)
    expect(byId('text-changes').start).toBe(Math.floor(i / 50) * 50 + 1)
    const selected = byId('text-changes').querySelector('[aria-pressed="true"]')
    expect(selected.textContent.startsWith(`${i + 1}. `)).toBe(true)
    expect(source('before').querySelector('.selected-text-change').dataset.from).toBe(String(hunks[i].oldFrom))
    expect(source('after').querySelector('.selected-text-change').textContent).toBe('b')
    expect(source('before').textContent).toBe(oldText)
    expect(source('after').textContent).toBe(newText)
    expect(byId('text-changes').children.length).toBeLessThanOrEqual(50)
    byId('text-next').click()
  }
  expect(byId('text-next').disabled).toBe(true)
  expect(byId('text-page-next').disabled).toBe(true)
  expect(byId('text-status').textContent).toContain('600 of 600')
})
it('crosses pages in both directions without replacing the focused global navigation button', () => {
  setup(51)
  byId('text-changes').lastChild.querySelector('button').click()
  const next = byId('text-next')
  next.focus()
  next.click()
  expect(byId('text-status').textContent).toContain('51 of 51')
  expect(byId('text-changes').start).toBe(51)
  expect(byId('text-changes').firstChild.value).toBe(51)
  expect(byId('text-next')).toBe(next)
  const previous = byId('text-previous')
  previous.focus()
  previous.click()
  expect(document.activeElement).toBe(previous)
  expect(byId('text-status').textContent).toContain('50 of 51')
  expect(byId('text-changes').start).toBe(1)
})
it('page controls select the first target-page detail and preserve empty markers', () => {
  const {oldText, newText} = setup(51, true)
  byId('text-page-next').click()
  expect(byId('text-status').textContent).toContain('51 of 51')
  expect(source('before').querySelector('.text-position-marker').getAttribute('aria-label')).toBe('Insertion point at 51')
  expect(source('before').textContent).toBe(oldText)
  expect(source('after').textContent).toBe(newText)
  byId('text-page-previous').click()
  expect(byId('text-status').textContent).toContain('1 of 51')
  expect(byId('text-previous').disabled).toBe(true)
})
it('resets pages on cached selection, pending, failure, unsupported input and disposal', () => {
  const {review, entry, views, hunks, oldText} = setup(51)
  const firstWorker = workers[0]
  byId('text-page-next').click()
  review.select(entry, views)
  expect(workers).toHaveLength(1)
  expect(byId('text-status').textContent).toContain('1 of 51')
  byId('text-page-next').click()
  review.select({...entry}, views) // New entry starts a request, not a cache hit.
  expect(byId('text-status').dataset.state).toBe('pending')
  expect(byId('text-changes').children).toHaveLength(0)
  expect(byId('text-page-status').textContent).toBe('No text detail page')
  expect(byId('text-page-next').disabled).toBe(true)
  expect(source('before').textContent).toBe(oldText)
  firstWorker.deliver(hunks) // Stale successful response cannot restore an old page.
  expect(byId('text-status').dataset.state).toBe('pending')
  workers[1].onerror({preventDefault() {}})
  expect(byId('text-status').dataset.state).toBe('unavailable')
  expect(byId('text-page-next').disabled).toBe(true)
  review.select(entry, views)
  byId('text-page-next').click()
  review.select(undefined, views)
  expect(byId('text-status').dataset.state).toBe('unsupported')
  expect(byId('text-changes').children).toHaveLength(0)
  review.select(entry, views)
  byId('text-page-next').click()
  review.dispose()
  expect(byId('text-page-status').textContent).toBe('No text detail page')
  expect(byId('text-page-next').disabled).toBe(true)
  expect(byId('text-page-previous').disabled).toBe(true)
  expect(byId('text-changes').children).toHaveLength(0)
  expect(source('before').querySelector('.selected-text-change')).toBeNull()
})
