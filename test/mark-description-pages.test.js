// @vitest-environment jsdom
import {afterEach, expect, it, vi} from 'vitest'
import {Schema} from 'prosemirror-model'
import {renderMarkDescriptions} from '../example/src/text-source-view.js'
import html from '../example/blocks.html?raw'
const schema = new Schema({nodes: {doc: {content: 'paragraph+'}, paragraph: {content: 'text*'}, text: {}}, marks: {link: {attrs: {href: {}, title: {default: null}}}, mystery: {}}})
const node = count => schema.node('paragraph', null, Array.from({length: count}, (_, i) => schema.text('a', [schema.mark('link', {href: 'javascript:<literal>', title: String(i)})])))
const rows = root => [...root.querySelectorAll('li')]
const next = root => root.querySelector('button[aria-label^="Next"]')
const previous = root => root.querySelector('button[aria-label^="Previous"]')
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules() })

it.each([0, 1, 50, 51])('keeps exact records at the %i-row boundary with simple short lists', count => {
  const root = renderMarkDescriptions(node(count), 20)
  expect(rows(root)).toHaveLength(Math.min(50, count))
  expect(root.querySelectorAll('button')).toHaveLength(count > 50 ? 2 : 0)
  if (count) expect(rows(root)[0].textContent).toContain('Link [21, 22): href "javascript:<literal>"; title "0"')
  if (count === 51) {
    next(root).click()
    expect(rows(root)).toHaveLength(1)
    expect(rows(root)[0].textContent).toContain('Link [71, 72)')
    expect(root.textContent).toContain('Showing 51-51 of 51')
    expect(next(root).disabled).toBe(true)
  }
  expect(root.querySelectorAll('a, [href], script')).toHaveLength(0)
})

it('visits all 6000 records exactly once with at most 50 actual li elements', () => {
  const root = renderMarkDescriptions(node(6000), 0)
  const seen = []
  for (;;) {
    const page = rows(root)
    expect(page.length).toBeLessThanOrEqual(50)
    seen.push(...page.map(row => row.textContent))
    if (next(root).disabled) break
    next(root).click()
  }
  expect(seen).toHaveLength(6000)
  seen.forEach((value, i) => {
    if (!value.includes('[' + (i + 1) + ', ' + (i + 2) + ')') || !value.includes('title "' + i + '"')) throw Error('Missing or reordered record ' + i)
  })
  expect(root.textContent).toContain('Showing 5951-6000 of 6000')
})

it('keeps an off-page unknown-mark warning and handles keyboard focus at page boundaries', () => {
  const content = [...Array.from({length: 51}, (_, i) => schema.text('a', [schema.mark('link', {href: 'same', title: String(i)})])), schema.text('?', [schema.mark('mystery')])]
  const root = renderMarkDescriptions(schema.node('paragraph', null, content), 0, 'Before paragraph')
  document.body.append(root)
  expect(root.querySelector('.mark-description-warning').textContent).toContain('1 unsupported mark records (mystery)')
  expect(rows(root).some(row => row.textContent.includes('Unsupported'))).toBe(false)
  expect(root.querySelector('[aria-live="polite"]')).not.toBeNull()
  next(root).focus(); next(root).click()
  expect(document.activeElement).toBe(previous(root))
  expect(rows(root).at(-1).textContent).toContain('Unsupported mark mystery [52, 53)')
  expect(root.querySelector('.mark-description-warning')).not.toBeNull()
  previous(root).click()
  expect(document.activeElement).toBe(next(root))
  expect(root.textContent).toContain('Showing 1-50 of 52')
})

it('uses the real example entry with independent blocks/sides and fresh pages on scenario reload', async () => {
  vi.resetModules()
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML
  vi.stubGlobal('Worker', undefined)
  await import('../example/src/blocks-demo-entry.js')
  const choose = value => { const select = document.getElementById('scenario'); select.value = value; select.dispatchEvent(new Event('change')) }
  choose('marked-many-links')
  const groups = [...document.querySelectorAll('.mark-description-pages')]
  expect(groups).toHaveLength(4)
  expect(new Set(groups.map(group => group.getAttribute('aria-label'))).size).toBe(4)
  const sources = [...document.querySelectorAll('.source-text')]
  const originals = sources.map(source => [...source.childNodes])
  next(groups[0]).click()
  expect(groups[0].textContent).toContain('Showing 51-100 of 102')
  expect(groups[1].textContent).toContain('Showing 1-50 of 102')
  expect(groups[2].textContent).toContain('Showing 1-50 of 102')
  next(groups[0]).click()
  expect(rows(groups[0])).toHaveLength(2)
  sources.forEach((source, i) => expect([...source.childNodes].every((child, j) => child === originals[i][j])).toBe(true))
  choose('unchanged'); choose('marked-many-links')
  document.querySelectorAll('.mark-description-pages').forEach(group => expect(group.textContent).toContain('Showing 1-50 of 102'))
  expect(document.querySelectorAll('.mark-descriptions a, .mark-descriptions [href]')).toHaveLength(0)
  vi.unstubAllGlobals()
})
