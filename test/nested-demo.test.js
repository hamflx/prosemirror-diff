// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import html from '../example/blocks.html?raw'
import {scenarios} from '../example/src/blocks-scenarios.js'
import {compareDocumentBlocks} from '../src/blocks.js'

const byId = id => document.getElementById(id)
const choose = (id, value) => {
  byId(id).value = value
  byId(id).dispatchEvent(new Event('change', {bubbles: true}))
}
const active = side => [...byId(side).querySelectorAll('.selected-change')]
const markers = side => [...byId(side).querySelectorAll('.position-marker')].filter(n => !n.hidden)
const labels = () => [...byId('changes').querySelectorAll('li')].map(n => n.dataset.change)
let originalScroll
beforeEach(async () => {
  vi.resetModules()
  originalScroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
  Object.defineProperty(Element.prototype, 'scrollIntoView', {configurable: true, value: vi.fn()})
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML
  await import('../example/src/blocks-demo.js')
})
afterEach(() => {
  if (originalScroll) Object.defineProperty(Element.prototype, 'scrollIntoView', originalScroll)
  else delete Element.prototype.scrollIntoView
  document.body.replaceChildren()
})

it('keeps depth zero compatible and highlights only the actual child range', () => {
  choose('scenario', 'nested-details')
  expect(byId('depth').value).toBe('0')
  expect(labels()).toEqual(['1'])
  choose('depth', '1')
  expect(labels()).toEqual(['1', '1.1'])
  byId('next').click()
  for (const side of ['before', 'after']) {
    expect(active(side)).toHaveLength(1)
    expect(active(side)[0].dataset.scope).toBe('0')
    expect(active(side)[0].dataset.from).toBe('7')
  }
  expect(active('before')[0].dataset.to).toBe('12')
  expect(active('after')[0].dataset.to).toBe('16')
  choose('depth', '0')
  expect(labels()).toEqual(['1'])
  expect(active('before')[0].dataset.scope).toBe('-1')
})

it('retains parent events, exposes descendant truncation, and navigates grandchildren', () => {
  choose('scenario', 'nested-depth')
  choose('depth', '1')
  expect(labels()).toEqual(['1', '1.1'])
  expect(byId('precision').textContent).toContain('1 depth-limited event')
  expect(byId('changes').textContent).toContain('Empty details do not mean equal contents')
  choose('depth', '2')
  expect(labels()).toEqual(['1', '1.1', '1.1.1'])
  byId('next').click()
  byId('next').click()
  expect(active('before')[0].dataset.scope).toBe('1')
  expect(active('before')[0].dataset.from).toBe('2')
  expect(active('before')[0].dataset.to).toBe('7')
  expect(byId('next').disabled).toBe(true)
  byId('previous').click()
  expect(active('before')[0].dataset.scope).toBe('0')
})

it('places nested insertion and deletion markers inside their own container', () => {
  choose('depth', '1')
  for (const [scenario, side, label] of [['nested-insert', 'before', 'Insertion'], ['nested-delete', 'after', 'Deletion']]) {
    choose('scenario', scenario)
    byId('next').click()
    expect(markers(side)).toHaveLength(1)
    const marker = markers(side)[0]
    expect(marker.dataset.position).toBe('1')
    expect(marker.dataset.scope).toBe('0')
    expect(marker.parentElement.className).toBe('child-content')
    expect(marker.textContent).toContain(label)
    expect(active(side)).toHaveLength(0)
  }
})

it('preserves nested sibling DOM order and repeated-block end boundaries', () => {
  choose('scenario', 'nested-repeated')
  choose('depth', '1')
  for (const side of ['before', 'after']) {
    const content = byId(side).querySelector('.child-content')
    expect([...content.children].map(n => n.classList.contains('block') ? `block:${n.dataset.from}` : `marker:${n.dataset.position}`))
      .toEqual(['marker:1', 'block:1', 'marker:4', 'block:4', 'marker:7', 'block:7', 'marker:10'])
  }
  byId('next').click()
  expect(markers('after')[0].dataset.position).toBe('1')
  byId('next').click()
  expect(markers('before')[0].dataset.position).toBe('10')
  expect(markers('before')[0].parentElement.lastElementChild).toBe(markers('before')[0])
})

it('shows shared-budget local fallback even when root is not coarse', () => {
  choose('scenario', 'shared-budget')
  choose('depth', '1')
  choose('budget', '20')
  expect(byId('precision').textContent).toContain('Root has no budget fallback')
  expect(byId('precision').textContent).toContain('1 nested fallback layer')
  expect(byId('precision').classList.contains('fallback')).toBe(true)
  expect(labels()).toEqual(['1', '1.1', '2', '2.1'])
  expect(document.querySelector('[data-change="2"] > .detail-status').textContent).toContain('Local coarse fallback')
  choose('budget', '24')
  expect(byId('precision').textContent).toContain('0 nested fallback layer')
  expect(byId('precision').classList.contains('fallback')).toBe(false)
  choose('scenario', 'unchanged')
  expect(labels()).toEqual([])
  expect(active('before')).toEqual([])
  expect(markers('before')).toEqual([])
})

it('renders strict single-child replacement descendants without mixing documents', () => {
  choose('scenario', 'strict-container')
  choose('depth', '2')
  byId('next').click()
  expect(active('before')[0].dataset.nodeType).toBe('heading')
  expect(active('after')[0].dataset.nodeType).toBe('paragraph')
  expect(active('before')[0].dataset.from).toBe('1')
  expect(active('before')[0].dataset.to).toBe('13')
  expect(byId('before').querySelectorAll('.child-content > .block')).toHaveLength(1)
  expect(byId('after').querySelectorAll('.child-content > .block')).toHaveLength(1)
})

it('keeps all fixture documents valid and default API results free of details', () => {
  for (const fixture of scenarios) {
    fixture.oldDoc.check()
    fixture.newDoc.check()
    const result = compareDocumentBlocks(fixture.oldDoc, fixture.newDoc)
    for (const change of result.changes) expect(change).not.toHaveProperty('details')
  }
})
