// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import html from '../example/blocks.html?raw'

const byId = id => document.getElementById(id)
const choose = (id, value) => {
  byId(id).value = value
  byId(id).dispatchEvent(new Event('change', {bubbles: true}))
}
const markers = side => [...byId(side).querySelectorAll('.position-marker')].filter(node => !node.hidden)
const selected = side => [...byId(side).querySelectorAll('.selected-change')]
let originalScroll
let scroll

beforeEach(async () => {
  vi.resetModules()
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML
  originalScroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
  scroll = vi.fn()
  Object.defineProperty(Element.prototype, 'scrollIntoView', {configurable: true, value: scroll})
  await import('../example/src/blocks-demo.js')
})
afterEach(() => {
  if (originalScroll) Object.defineProperty(Element.prototype, 'scrollIntoView', originalScroll)
  else delete Element.prototype.scrollIntoView
  document.body.replaceChildren()
})

describe('block review DOM integration', () => {
  it('locates insertion content and an explicit empty old range', () => {
    expect(byId('scenario').options).toHaveLength(23)
    expect(byId('changes').children).toHaveLength(1)
    expect(markers('before')).toHaveLength(1)
    expect(markers('before')[0].textContent).toContain('Insertion point at 9')
    expect(selected('before')).toHaveLength(0)
    expect(selected('after')).toHaveLength(1)
    expect(selected('after')[0].dataset.from).toBe('9')
    expect(selected('after')[0].dataset.to).toBe('24')
    expect(byId('previous').disabled).toBe(true)
    expect(byId('next').disabled).toBe(true)
    expect(document.querySelector('[contenteditable]')).toBeNull()
  })
  it('locates deletion gaps and the start of an empty document', () => {
    choose('scenario', 'delete')
    expect(markers('before')).toHaveLength(0)
    expect(markers('after')[0].textContent).toContain('Deletion point at 9')
    expect(selected('before')[0].textContent).toContain('Removed paragraph')
    choose('scenario', 'empty-document')
    expect(markers('before')[0].dataset.position).toBe('0')
    expect(byId('before').textContent).toContain('Empty document')
    expect(markers('after')).toHaveLength(0)
  })
  it('renders empty blocks, images and each strict container separately', () => {
    choose('scenario', 'empty-block')
    expect(selected('after')[0].textContent).toContain('Empty paragraph')
    choose('scenario', 'image')
    expect(selected('before')[0].querySelector('img').alt).toBe('Original green cover')
    expect(selected('after')[0].querySelector('img').alt).toBe('Revised blue cover')
    choose('scenario', 'strict-container')
    expect(byId('before').querySelector('.strict-container h3').textContent).toBe('Same title')
    expect(byId('after').querySelector('.strict-container p').textContent).toBe('Same title')
    expect(byId('before').querySelectorAll('.strict-container > .child-content > .block')).toHaveLength(1)
    expect(byId('after').querySelectorAll('.strict-container > .child-content > .block')).toHaveLength(1)
  })
  it('navigates repeated-block changes and clears previous range markers', () => {
    choose('scenario', 'repeated')
    expect(markers('after')[0].dataset.position).toBe('0')
    byId('next').click()
    expect(byId('status').textContent).toContain('Change 2 of 2')
    expect(markers('after')).toHaveLength(0)
    expect(markers('before')[0].dataset.position).toBe('9')
    expect(byId('next').disabled).toBe(true)
    byId('next').click()
    expect(byId('status').textContent).toContain('Change 2 of 2')
    byId('changes').querySelector('button').click()
    expect(byId('previous').disabled).toBe(true)
    expect(markers('before')).toHaveLength(0)
    expect(markers('after')).toHaveLength(1)
    expect(scroll).toHaveBeenCalledTimes(4)
  })
  it('makes coarse fallback visible and refreshes range selection when the budget changes', () => {
    choose('scenario', 'budget')
    expect(byId('changes').children).toHaveLength(2)
    byId('next').click()
    choose('budget', '0')
    expect(byId('changes').children).toHaveLength(1)
    expect(byId('precision').textContent).toContain('Coarse fallback')
    expect(byId('precision').classList.contains('fallback')).toBe(true)
    expect(selected('before')).toHaveLength(3)
    expect(selected('after')).toHaveLength(3)
    expect(byId('status').textContent).toContain('Change 1 of 1')
    expect(byId('next').disabled).toBe(true)
    choose('budget', '100000')
    expect(byId('changes').children).toHaveLength(2)
    expect(byId('precision').classList.contains('fallback')).toBe(false)
    expect(selected('before')).toHaveLength(1)
    expect(byId('status').textContent).toContain('Change 1 of 2')
  })
  it('clears all selected content and boundary markers for unchanged documents', () => {
    choose('scenario', 'unchanged')
    expect(byId('changes').children).toHaveLength(0)
    expect(document.querySelectorAll('.selected-change')).toHaveLength(0)
    expect(markers('before')).toHaveLength(0)
    expect(markers('after')).toHaveLength(0)
    expect(byId('previous').disabled).toBe(true)
    expect(byId('next').disabled).toBe(true)
    expect(byId('status').textContent).toBe('No block changes')
    choose('scenario', 'insert')
    expect(markers('before')).toHaveLength(1)
  })
})
