// @vitest-environment jsdom
import {beforeEach, afterEach, expect, it, vi} from 'vitest'
import html from '../example/legacy.html?raw'
const byId = id => document.getElementById(id)
const choose = value => {
  byId('scenario').value = value
  byId('scenario').dispatchEvent(new Event('change', {bubbles: true}))
}
beforeEach(async () => {
  vi.resetModules()
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML
  await import('../example/src/legacy-migration-demo-entry.js')
})
afterEach(() => document.body.replaceChildren())

it('renders the actual current-source entry with both originals and a supported combined result', () => {
  expect(byId('scenario').options).toHaveLength(4)
  expect(byId('before').textContent).toBe('cat')
  expect(byId('after').textContent).toBe('cart')
  expect(byId('before').querySelector('strong').textContent).toBe('cat')
  expect(byId('combined').querySelector('ins').textContent).toBe('r')
  expect(byId('comparison-status').dataset.state).toBe('available')
  expect(document.querySelector('[contenteditable]')).toBeNull()
})

it('clears stale combined content and keeps exclusive marks, then recovers on a supported selection', () => {
  choose('exclusive')
  expect(byId('comparison-status').dataset.state).toBe('unrepresentable')
  expect(byId('comparison-status').textContent).toContain('original versions retained')
  expect(byId('comparison-message').textContent).toContain('no source formatting was removed')
  expect(byId('combined').childNodes).toHaveLength(0)
  expect(byId('before').querySelector('code').textContent).toBe('cat')
  expect(byId('after').querySelector('code').textContent).toBe('cart')
  expect(byId('before').querySelector('ins,del')).toBeNull()
  choose('ordinary')
  expect(byId('comparison-message').textContent).toBe('')
  expect(byId('comparison-status').dataset.state).toBe('available')
  expect(byId('combined').querySelector('ins').textContent).toBe('r')
})

it('retains unmarked code blocks and independent strict-container children through rejection', () => {
  choose('code-block')
  expect(byId('combined').childNodes).toHaveLength(0)
  expect(byId('before').querySelector('pre code').textContent).toBe('a')
  expect(byId('after').querySelector('pre code').textContent).toBe('b')
  choose('strict-container')
  expect(byId('comparison-status').dataset.state).toBe('unrepresentable')
  expect(byId('before').querySelector('.strict-container').children).toHaveLength(1)
  expect(byId('after').querySelector('.strict-container').children).toHaveLength(1)
  expect(byId('before').querySelector('.strict-container h3').textContent).toBe('Same title')
  expect(byId('after').querySelector('.strict-container p').textContent).toBe('Same title')
  expect(byId('combined').childNodes).toHaveLength(0)
  choose('ordinary')
  expect(byId('comparison-status').dataset.state).toBe('available')
})
