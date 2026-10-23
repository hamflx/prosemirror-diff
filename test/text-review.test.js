import {describe, expect, it, vi} from 'vitest'
import {Schema} from 'prosemirror-model'
import {reviewTextChange} from '../example/src/text-review.js'
import {compareDocumentBlocks} from '../src/blocks.js'
import {scenarios, schema} from '../example/src/blocks-scenarios.js'

const change = (before, after, oldFrom = 0, newFrom = 0) => ({kind: 'replace', before: [before], after: [after], oldFrom, newFrom})
const paragraph = text => schema.node('paragraph', null, text ? schema.text(text) : null)
const review = (a, b, oldFrom = 0, newFrom = 0) => reviewTextChange(change(paragraph(a), paragraph(b), oldFrom, newFrom))
const fixtureChange = id => {
  const fixture = scenarios.find(s => s.id === id)
  return compareDocumentBlocks(fixture.oldDoc, fixture.newDoc, {maxDepth: 1}).changes[0]
}

function assertReconstruction(result) {
  let oldCursor = result.oldStart, newCursor = result.newStart, rebuilt = ''
  for (const hunk of result.hunks) {
    const oldGap = result.oldText.slice(oldCursor - result.oldStart, hunk.oldFrom - result.oldStart)
    const newGap = result.newText.slice(newCursor - result.newStart, hunk.newFrom - result.newStart)
    expect(oldGap).toBe(newGap)
    rebuilt += oldGap + result.newText.slice(hunk.newFrom - result.newStart, hunk.newTo - result.newStart)
    expect(hunk.oldFrom).toBeGreaterThanOrEqual(oldCursor)
    expect(hunk.newFrom).toBeGreaterThanOrEqual(newCursor)
    oldCursor = hunk.oldTo
    newCursor = hunk.newTo
  }
  const suffix = result.oldText.slice(oldCursor - result.oldStart)
  expect(suffix).toBe(result.newText.slice(newCursor - result.newStart))
  expect(rebuilt + suffix).toBe(result.newText)
}

describe('example-only plain text review adapter', () => {
  it('maps whole graphemes to original UTF-16 positions without normalization', () => {
    const result = reviewTextChange(fixtureChange('text-unicode'))
    expect(result.hunks).toEqual([
      {kind: 'replace', oldFrom: 3, oldTo: 14, newFrom: 3, newTo: 14},
      {kind: 'replace', oldFrom: 15, oldTo: 17, newFrom: 15, newTo: 16}
    ])
    expect(result.oldText).toContain('e\u0301')
    assertReconstruction(result)
  })
  it('handles empty text and start/middle/end insertion and deletion boundaries', () => {
    expect(review('', '🇨🇦').hunks).toEqual([{kind: 'insert', oldFrom: 1, oldTo: 1, newFrom: 1, newTo: 5}])
    expect(review('🇨🇦', '').hunks).toEqual([{kind: 'delete', oldFrom: 1, oldTo: 5, newFrom: 1, newTo: 1}])
    expect(review('', '').hunks).toEqual([])
    for (const [a, b] of [['AB', 'xAyBz'], ['xAyBz', 'AB'], ['  a\n', '  b\n'], ['same', 'same']]) assertReconstruction(review(a, b))
    expect(review('AB', 'xAyBz').hunks.map(h => h.oldFrom)).toEqual([1, 2, 3])
  })
  it('uses each side absolute textblock start exactly once for nested or shifted blocks', () => {
    const nested = fixtureChange('text-nested').details.changes[0]
    expect(reviewTextChange(nested).hunks[0]).toMatchObject({oldFrom: 11, newFrom: 11, oldTo: 22, newTo: 22})
    expect(review('a', 'b', 8, 17).hunks[0]).toEqual({kind: 'replace', oldFrom: 9, oldTo: 10, newFrom: 18, newTo: 19})
    const shifted = fixtureChange('text-nested-shifted').details.changes[1]
    expect(reviewTextChange(shifted).hunks[0]).toMatchObject({oldFrom: 16, newFrom: 24, oldTo: 27, newTo: 35})
  })
  it('rejects mark and atom changes that textContent would silently erase', () => {
    for (const id of ['text-marks', 'text-inline-atom']) {
      const event = fixtureChange(id)
      expect(event.before[0].textContent).toBe(event.after[0].textContent)
      expect(reviewTextChange(event)).toMatchObject({supported: false})
    }
  })
  it('rejects unsupported node correspondence and inline node types', () => {
    const p = paragraph('a')
    for (const event of [undefined, {...change(p, p), kind: 'insert'}, {...change(p, p), before: [p, p]},
      change(p, schema.node('heading', null, schema.text('a'))), change(schema.node('section', null, p), schema.node('section', null, p))]) {
      expect(reviewTextChange(event).supported).toBe(false)
    }
    const custom = new Schema({nodes: {doc: {content: 'block*'}, block: {group: 'block', content: 'inline*', attrs: {id: {default: 1}}}, text: {group: 'inline'}, br: {inline: true, group: 'inline'}, atom: {group: 'block', content: 'text*', atom: true}}})
    const a = custom.node('block', null, custom.node('br'))
    expect(reviewTextChange(change(a, a)).supported).toBe(false)
    expect(reviewTextChange(change(custom.node('block'), custom.node('block', {id: 2}))).supported).toBe(false)
    const atom = custom.node('atom', null, custom.text('a'))
    expect(reviewTextChange(change(atom, atom)).supported).toBe(false)
  })
  it('preserves reconstruction when the unobservable time fallback is taken', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(1001)
    try {
      const result = review('a👩‍💻 SAME x', 'a🇨🇦 SAME y')
      expect(result.hunks).toHaveLength(1)
      expect(result).not.toHaveProperty('fallback')
      assertReconstruction(result)
    } finally { clock.mockRestore() }
  })
  it('bounds selected text work by a combined-size limit, retaining the complete event', () => {
    expect(review('x'.repeat(10000), 'y'.repeat(10001))).toMatchObject({supported: false, reason: expect.stringContaining('20,000')})
    const result = review('x'.repeat(10000), 'x'.repeat(10000))
    expect(result.supported).toBe(true)
    expect(result.hunks).toEqual([])
  })
  it('preserves text after edit-budget fallback without claiming minimal edits', () => {
    const result = review('start ' + '👩‍💻'.repeat(1001) + ' end', 'start ' + '🇨🇦'.repeat(1001) + ' end')
    expect(result.hunks).toHaveLength(1)
    assertReconstruction(result)
  })
})
