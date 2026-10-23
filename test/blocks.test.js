import {describe, it, expect} from 'vitest'
import {Schema, Fragment} from 'prosemirror-model'
import {compareDocumentBlocks, compareDocumentMetadata} from '../src/index.js'

const makeSchema = () => new Schema({nodes: {
  doc: {content: 'block*', attrs: {title: {default: ''}}},
  paragraph: {group: 'block', content: 'text*'},
  heading: {group: 'block', content: 'text*'},
  container: {group: 'block', content: 'block'},
  image: {group: 'block', attrs: {src: {}}},
  text: {}
}, marks: {strong: {}}})
const s = makeSchema()
const p = text => s.node('paragraph', null, text ? s.text(text) : null)
const doc = nodes => s.node('doc', null, nodes)
const ranges = result => result.changes.map(c => [c.kind, c.oldFrom, c.oldTo, c.newFrom, c.newTo])
function reconstruct(old, result) {
  let content = Fragment.empty, cursor = 0
  for (const change of result.changes) {
    content = content.append(old.content.cut(cursor, change.oldFrom)).append(Fragment.fromArray(change.after))
    cursor = change.oldTo
  }
  return old.copy(content.append(old.content.cut(cursor)))
}

describe('compareDocumentBlocks', () => {
  it('returns no changes for equal documents and empty roots', () => {
    expect(compareDocumentBlocks(doc([]), doc([]))).toEqual({changes: [], fallback: false})
    expect(compareDocumentBlocks(doc([p('abc')]), doc([p('abc')])).changes).toEqual([])
  })
  it('locates inserted empty blocks and deleted images with empty opposite ranges', () => {
    expect(ranges(compareDocumentBlocks(doc([p('a')]), doc([p('a'), p('')])))).toEqual([['insert', 3, 3, 3, 5]])
    const image = s.node('image', {src: 'a'})
    expect(ranges(compareDocumentBlocks(doc([image, p('a')]), doc([p('a')])))).toEqual([['delete', 0, 1, 0, 0]])
  })
  it('reports replacement gaps around unchanged anchors', () => {
    const old = doc([p('x'), p('anchor'), p('z')]), next = doc([p('xx'), p('anchor'), p('zz')])
    const result = compareDocumentBlocks(old, next)
    expect(ranges(result)).toEqual([['replace', 0, 3, 0, 4], ['replace', 11, 14, 12, 16]])
    expect(reconstruct(old, result).eq(next)).toBe(true)
  })
  it('keeps a strict single-child container valid without injecting deleted nodes', () => {
    const old = doc([s.node('container', null, s.node('heading', null, s.text('title')))])
    const next = doc([s.node('container', null, p('title'))])
    const original = old.toJSON()
    const result = compareDocumentBlocks(old, next)
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0].before[0]).toBe(old.firstChild)
    expect(result.changes[0].after[0]).toBe(next.firstChild)
    expect(old.toJSON()).toEqual(original)
    expect(() => old.check()).not.toThrow()
    expect(() => next.check()).not.toThrow()
    expect(reconstruct(old, result).eq(next)).toBe(true)
  })
  it('includes marks and attrs in equality and preserves Unicode positions', () => {
    const old = doc([p('😀'), s.node('image', {src: 'old'})])
    const next = doc([s.node('paragraph', null, s.text('😀', [s.mark('strong')])), s.node('image', {src: 'new'})])
    expect(ranges(compareDocumentBlocks(old, next))).toEqual([['replace', 0, 5, 0, 5]])
  })
  it('pairs repeated blocks deterministically and does not emit moves', () => {
    const old = doc([p('a'), p('b'), p('a')]), next = doc([p('b'), p('a'), p('b')])
    expect(ranges(compareDocumentBlocks(old, next))).toEqual([['delete', 0, 3, 0, 0], ['insert', 9, 9, 6, 9]])
  })
  it('preserves prefix/suffix and signals a coarse fallback within a cell budget', () => {
    const old = doc([p('prefix'), p('old'), p('same'), p('tail')])
    const next = doc([p('prefix'), p('new'), p('same'), p('added'), p('tail')])
    const result = compareDocumentBlocks(old, next, {maxCells: 0})
    expect(result.fallback).toBe(true)
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0].oldFrom).toBe(8)
    expect(result.changes[0].after.map(n => n.textContent)).toEqual(['new', 'same', 'added'])
    expect(reconstruct(old, result).eq(next)).toBe(true)
  })
  it('needs no alignment matrix for pure insertions and deletions', () => {
    for (const [old, next] of [[doc([]), doc([p('a')])], [doc([p('a')]), doc([])]]) {
      const result = compareDocumentBlocks(old, next, {maxCells: 0})
      expect(result.fallback).toBe(false)
      expect(reconstruct(old, result).eq(next)).toBe(true)
    }
  })
  it.each([-1, 1.5, NaN, Infinity, 1000001])('rejects invalid budgets: %s', maxCells => {
    expect(() => compareDocumentBlocks(doc([]), doc([]), {maxCells})).toThrow(RangeError)
  })
  it('rejects root markup changes and leaves the metadata API contract intact', () => {
    const old = doc([p('a')]), next = s.node('doc', {title: 'changed'}, [p('a')])
    expect(() => compareDocumentBlocks(old, next)).toThrow(RangeError)
    expect(compareDocumentMetadata(old, next)[0].kind).toBe('attrs')
    expect(() => compareDocumentMetadata(old, doc([p('b')]))).toThrow(RangeError)
  })
  it('validates schemas, input roots and top-level block children', () => {
    expect(() => compareDocumentBlocks(null, doc([]))).toThrow(TypeError)
    expect(() => compareDocumentBlocks(p('a'), p('b'))).toThrow(TypeError)
    expect(() => compareDocumentBlocks(doc([]), makeSchema().node('doc'))).toThrow(TypeError)
    const inline = new Schema({nodes: {doc: {content: 'text*'}, text: {}}})
    expect(() => compareDocumentBlocks(inline.node('doc', null, inline.text('a')), inline.node('doc'))).toThrow(RangeError)
    expect(() => compareDocumentBlocks(doc([s.node('container')]), doc([]))).toThrow()
  })
  it('reconstructs both directions for deterministic repeated-block sequences', () => {
    let seed = 23
    const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n }
    for (let sample = 0; sample < 200; sample++) {
      const a = doc(Array.from({length: random(9)}, () => p(['', 'a', 'b', '😀'][random(4)])))
      const b = doc(Array.from({length: random(9)}, () => p(['', 'a', 'b', '😀'][random(4)])))
      for (const maxCells of [0, 100000]) {
        expect(reconstruct(a, compareDocumentBlocks(a, b, {maxCells})).eq(b)).toBe(true)
        expect(reconstruct(b, compareDocumentBlocks(b, a, {maxCells})).eq(a)).toBe(true)
      }
    }
  })
})
