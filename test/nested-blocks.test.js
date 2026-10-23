import {describe, expect, it} from 'vitest'
import {Fragment, Schema} from 'prosemirror-model'
import {compareDocumentBlocks} from '../src/index.js'

const s = new Schema({nodes: {
  doc: {content: 'block*', marks: '_'},
  paragraph: {content: 'text*', group: 'block'},
  heading: {content: 'text*', group: 'block'},
  quote: {content: 'block*', group: 'block', marks: '_', attrs: {label: {default: ''}}},
  container: {content: 'block', group: 'block'},
  atomBox: {content: 'block*', group: 'block', atom: true},
  text: {}
}, marks: {strong: {}}})
const p = text => s.node('paragraph', null, text ? s.text(text) : null)
const q = (children, attrs = null, marks = []) => s.node('quote', attrs, children, marks)
const doc = children => s.node('doc', null, children)
const positions = change => [change.oldFrom, change.oldTo, change.newFrom, change.newTo]
const fixture = () => [doc([q([p('a'), p('old'), p('b')])]), doc([q([p('a'), p('updated'), p('b')])])]

function assertTree(old, next, changes, oldMin = 0, oldMax = old.content.size, newMin = 0, newMax = next.content.size) {
  for (const change of changes) {
    expect(change.oldFrom).toBeGreaterThanOrEqual(oldMin)
    expect(change.oldTo).toBeLessThanOrEqual(oldMax)
    expect(change.newFrom).toBeGreaterThanOrEqual(newMin)
    expect(change.newTo).toBeLessThanOrEqual(newMax)
    expect(old.slice(change.oldFrom, change.oldTo).content.eq(Fragment.fromArray(change.before))).toBe(true)
    expect(next.slice(change.newFrom, change.newTo).content.eq(Fragment.fromArray(change.after))).toBe(true)
    if (change.details) assertTree(old, next, change.details.changes, change.oldFrom + 1, change.oldTo - 1, change.newFrom + 1, change.newTo - 1)
  }
}

describe('opt-in nested block details', () => {
  it('keeps the default result unchanged with no details fields', () => {
    const [old, next] = fixture()
    const result = compareDocumentBlocks(old, next)
    expect(result).toEqual(compareDocumentBlocks(old, next, {maxDepth: 0}))
    expect(result.changes[0]).not.toHaveProperty('details')
    expect(positions(result.changes[0])).toEqual([0, 13, 0, 17])
  })
  it('preserves the parent and supplies absolute child ranges', () => {
    const [old, next] = fixture()
    const result = compareDocumentBlocks(old, next, {maxDepth: 1})
    const parent = result.changes[0]
    expect(positions(parent)).toEqual([0, 13, 0, 17])
    expect(parent.before[0]).toBe(old.firstChild)
    expect(parent.after[0]).toBe(next.firstChild)
    expect(parent.details.fallback).toBe(false)
    expect(parent.details.truncated).toBe(false)
    expect(parent.details.changes).toHaveLength(1)
    expect(positions(parent.details.changes[0])).toEqual([4, 9, 4, 13])
    assertTree(old, next, result.changes)
  })
  it('adds each container opening token to deeply nested coordinates', () => {
    const old = doc([p('prefix'), q([q([p('a')])])])
    const next = doc([p('prefix'), q([q([p('bb')])])])
    const result = compareDocumentBlocks(old, next, {maxDepth: 2})
    expect(positions(result.changes[0].details.changes[0].details.changes[0])).toEqual([10, 13, 10, 14])
    assertTree(old, next, result.changes)
  })
  it('marks an eligible deeper event as truncated at the configured depth', () => {
    const old = doc([q([q([p('old')])])]), next = doc([q([q([p('new')])])])
    const result = compareDocumentBlocks(old, next, {maxDepth: 1})
    expect(result.changes[0].details.changes[0].details).toEqual({changes: [], fallback: false, truncated: true})
    expect(result.changes[0].details.truncated).toBe(false)
  })
  it('refines a strict container without changing its valid one-child content', () => {
    const old = doc([s.node('container', null, s.node('heading', null, s.text('title')))])
    const next = doc([s.node('container', null, p('title'))])
    const result = compareDocumentBlocks(old, next, {maxDepth: 3})
    expect(positions(result.changes[0].details.changes[0])).toEqual([1, 8, 1, 8])
    expect(result.changes[0].details.changes[0]).not.toHaveProperty('details')
    expect(() => old.check()).not.toThrow()
    expect(() => next.check()).not.toThrow()
  })
  it('does not infer pairing across markup changes, atoms, inline content or multi-node gaps', () => {
    const pairs = [
      [q([p('a')]), q([p('b')], {label: 'different'})],
      [q([p('a')]), q([p('b')], null, [s.mark('strong')])],
      [s.node('atomBox', null, p('a')), s.node('atomBox', null, p('b'))],
      [p('a'), p('b')]
    ]
    for (const [old, next] of pairs) expect(compareDocumentBlocks(doc([old]), doc([next]), {maxDepth: 32}).changes[0]).not.toHaveProperty('details')
    const result = compareDocumentBlocks(doc([q([p('a')]), q([p('b')])]), doc([q([p('x')]), q([p('y')])]), {maxDepth: 32})
    expect(result.changes[0].before).toHaveLength(2)
    expect(result.changes[0]).not.toHaveProperty('details')
  })
  it('locates nested insertion and deletion with empty opposite ranges', () => {
    const old = doc([q([])]), next = doc([q([p('')])])
    const added = compareDocumentBlocks(old, next, {maxDepth: 1}).changes[0].details.changes[0]
    const removed = compareDocumentBlocks(next, old, {maxDepth: 1}).changes[0].details.changes[0]
    expect([added.kind, ...positions(added)]).toEqual(['insert', 1, 1, 1, 3])
    expect([removed.kind, ...positions(removed)]).toEqual(['delete', 1, 3, 1, 1])
  })
  it('applies deterministic old-first tie breaking inside repeated blocks', () => {
    const old = doc([q([p('a'), p('b'), p('a')])]), next = doc([q([p('b'), p('a'), p('b')])])
    const changes = compareDocumentBlocks(old, next, {maxDepth: 1}).changes[0].details.changes
    expect(changes.map(c => [c.kind, ...positions(c)])).toEqual([['delete', 1, 4, 1, 1], ['insert', 10, 10, 7, 10]])
  })
  it('debits the root matrix before allocating child detail matrices', () => {
    const [old, next] = fixture()
    const coarse = compareDocumentBlocks(old, next, {maxDepth: 1, maxCells: 7})
    expect(coarse.fallback).toBe(false)
    expect(coarse.changes[0].details.fallback).toBe(true)
    expect(positions(coarse.changes[0].details.changes[0])).toEqual([4, 9, 4, 13])
    expect(compareDocumentBlocks(old, next, {maxDepth: 1, maxCells: 8}).changes[0].details.fallback).toBe(false)
  })
  it('shares the remaining budget across sibling detail branches', () => {
    const old = doc([q([p('a')]), p('anchor'), q([p('b')])])
    const next = doc([q([p('x')]), p('anchor'), q([p('y')])])
    const result = compareDocumentBlocks(old, next, {maxDepth: 1, maxCells: 20})
    expect(result.changes.map(c => c.details.fallback)).toEqual([false, true])
    expect(compareDocumentBlocks(old, next, {maxDepth: 1, maxCells: 24}).changes.map(c => c.details.fallback)).toEqual([false, false])
  })
  it('does not refine a coarse parent layer even with a positive depth', () => {
    const [old, next] = fixture()
    const result = compareDocumentBlocks(old, next, {maxDepth: 32, maxCells: 0})
    expect(result.fallback).toBe(true)
    expect(result.changes[0]).not.toHaveProperty('details')
  })
  it.each([-1, 1.5, NaN, Infinity, 33])('rejects invalid maxDepth %s', maxDepth => {
    expect(() => compareDocumentBlocks(doc([]), doc([]), {maxDepth})).toThrow(RangeError)
  })
  it('preserves parent-level reconstruction and inputs through nested detail trees', () => {
    let seed = 23
    const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n }
    for (let sample = 0; sample < 100; sample++) {
      const build = () => doc([q([q(Array.from({length: random(5)}, () => p(['', 'a', '😀'][random(3)])))])])
      const old = build(), next = build(), oldJSON = old.toJSON(), nextJSON = next.toJSON()
      for (const maxCells of [0, 8, 100000]) {
        const result = compareDocumentBlocks(old, next, {maxDepth: 3, maxCells})
        assertTree(old, next, result.changes)
        let content = Fragment.empty, cursor = 0
        for (const change of result.changes) {
          content = content.append(old.content.cut(cursor, change.oldFrom)).append(Fragment.fromArray(change.after))
          cursor = change.oldTo
        }
        expect(old.copy(content.append(old.content.cut(cursor))).eq(next)).toBe(true)
      }
      expect(old.toJSON()).toEqual(oldJSON)
      expect(next.toJSON()).toEqual(nextJSON)
    }
  })
})
