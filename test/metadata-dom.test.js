// @vitest-environment jsdom
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest'
import html from '../example/metadata.html?raw'
const byId = id => document.getElementById(id)
const highlighted = side => [...byId(side).querySelectorAll('.selected-change')].map(node => node.textContent)
const choose = value => {
  byId('scenario').value = value
  byId('scenario').dispatchEvent(new Event('change', {bubbles: true}))
}
let scroll
let originalScroll

beforeEach(async () => {
  vi.resetModules()
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML
  originalScroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
  scroll = vi.fn()
  // jsdom has no layout/scrolling. Stub only this browser operation, not the
  // comparison, renderer, controls, selectors or their event listeners.
  Object.defineProperty(Element.prototype, 'scrollIntoView', {configurable: true, value: scroll})
  await import('../example/src/metadata-demo.js')
})

afterEach(() => {
  if (originalScroll) Object.defineProperty(Element.prototype, 'scrollIntoView', originalScroll)
  else delete Element.prototype.scrollIntoView
  document.body.replaceChildren()
})

describe('metadata demo DOM integration', () => {
  it('loads the actual entry and selects the exact bold range in both documents', () => {
    expect(byId('scenario').options).toHaveLength(6)
    expect(byId('changes').children).toHaveLength(3)
    expect(highlighted('before')).toEqual(['clear decision'])
    expect(highlighted('after')).toEqual(['clear decision'])
    expect(byId('before').querySelector('strong')).toBeNull()
    expect(byId('after').querySelector('strong').textContent).toBe('clear decision')
    expect(byId('status').textContent).toContain('Change 1 of 3')
    expect(byId('previous').disabled).toBe(true)
    expect(byId('next').disabled).toBe(false)
    expect(document.querySelector('[contenteditable]')).toBeNull()
  })

  it('navigates link/image ranges, bounds buttons and reports the selected change', () => {
    byId('next').click()
    expect(highlighted('before')).toEqual(['project notes'])
    expect(highlighted('after')).toEqual(['project notes'])
    expect(byId('previous').disabled).toBe(false)
    byId('next').click()
    expect(highlighted('before')).toEqual(['Green cover with a pale circle'])
    expect(highlighted('after')).toEqual(['Blue cover with a pale circle'])
    expect(byId('next').disabled).toBe(true)
    byId('next').click() // Native disabled button must not advance past the end.
    expect(byId('status').textContent).toContain('Change 3 of 3')
    expect([...byId('changes').querySelectorAll('button')].map(b => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
    expect(scroll).toHaveBeenCalledTimes(4)
    byId('previous').click()
    expect(highlighted('before')).toEqual(['project notes'])
  })

  it('selects changes from the list and clears the previous highlight', () => {
    byId('changes').querySelectorAll('button')[2].click()
    byId('changes').querySelectorAll('button')[0].click()
    expect(document.querySelectorAll('.selected-change')).toHaveLength(2)
    expect(highlighted('before')).toEqual(['clear decision'])
    expect(byId('previous').disabled).toBe(true)
    expect(byId('next').disabled).toBe(false)
  })

  it('clears results after a rejected text edit and recovers through empty/supported states', () => {
    byId('next').click()
    choose('unsupported')
    expect(byId('error').hidden).toBe(false)
    expect(byId('error').textContent).toContain('identical node structure and text')
    expect(byId('changes').children).toHaveLength(0)
    expect(document.querySelectorAll('.selected-change')).toHaveLength(0)
    expect(byId('previous').disabled).toBe(true)
    expect(byId('next').disabled).toBe(true)
    expect(byId('status').textContent).toContain('Outside metadata-only scope')
    expect(byId('before').textContent).toContain('The text stays the same.')
    expect(byId('after').textContent).toContain('The text has changed.')
    choose('unchanged')
    expect(byId('error').hidden).toBe(true)
    expect(byId('error').textContent).toBe('')
    expect(byId('status').textContent).toBe('No metadata changes')
    expect(byId('next').disabled).toBe(true)
    choose('combined')
    expect(byId('changes').children).toHaveLength(3)
    expect(highlighted('after')).toEqual(['clear decision'])
    expect(byId('next').disabled).toBe(false)
  })

  it('renders each isolated scenario and its before/after values', () => {
    for (const id of ['bold', 'link', 'image']) {
      choose(id)
      expect(byId('changes').children).toHaveLength(1)
      expect(byId('previous').disabled).toBe(true)
      expect(byId('next').disabled).toBe(true)
      expect(document.querySelectorAll('.selected-change')).toHaveLength(2)
    }
    const values = [...byId('changes').querySelectorAll('pre')].map(pre => JSON.parse(pre.textContent))
    expect(values[0].alt).toBe('Green cover with a pale circle')
    expect(values[1].alt).toBe('Blue cover with a pale circle')
    expect(byId('before').querySelector('img').alt).toBe(values[0].alt)
    expect(byId('after').querySelector('img').alt).toBe(values[1].alt)
  })

  it('cancels an ordinary link click without claiming navigation isolation', () => {
    const link = byId('before').querySelector('a')
    const click = new MouseEvent('click', {bubbles: true, cancelable: true, button: 0})
    expect(link.dispatchEvent(click)).toBe(false)
    expect(click.defaultPrevented).toBe(true)
    expect(link.getAttribute('href')).toBe('https://example.org/notes/original')
    expect(link.title).toBe('https://example.org/notes/original (demo link; ordinary click disabled)')
    // Retained href still allows browser context-menu/middle-button navigation.
  })
})
