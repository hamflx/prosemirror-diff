import {describe, expect, it} from 'vitest'
import {Schema} from 'prosemirror-model'
import {compareNodeMetadata, compareDocumentMetadata} from '../src/index.js'
const makeSchema = () => new Schema({nodes: {
  doc: {content: 'block+'},
  paragraph: {group: 'block', content: 'inline*', attrs: {data: {default: null}}},
  heading: {group: 'block', content: 'inline*'},
  container: {group: 'block', content: 'paragraph', attrs: {title: {default: ''}}},
  image: {inline: true, group: 'inline', attrs: {src: {}}},
  text: {group: 'inline'}
}, marks: {strong: {}, link: {attrs: {href: {}}}}})
const s = makeSchema(), t = (text, marks = []) => s.text(text, marks)
const p = (content = [], attrs) => s.node('paragraph', attrs, content)
const pos = c => [c.oldFrom, c.oldTo, c.newFrom, c.newTo]

describe('compareNodeMetadata', () => {
  it('compares a selected paragraph despite unrelated document text edits', () => {
    const old = s.node('doc', null, [p(t('same')), p(t('old'))])
    const next = s.node('doc', null, [p(t('same', [s.mark('strong')])), p(t('new'))])
    expect(() => compareDocumentMetadata(old, next)).toThrow(RangeError)
    expect(compareNodeMetadata(old.firstChild, next.firstChild)).toEqual([
      {kind: 'marks', nodeType: 'text', oldFrom: 1, oldTo: 5, newFrom: 1, newTo: 5,
        before: [], after: [{type: 'strong'}]}
    ])
  })
  it('aligns split Unicode text and link changes at independent absolute offsets', () => {
    const old = p(t('a\u{1f600}b', [s.mark('link', {href: '/old'})]))
    const next = p([t('a', [s.mark('link', {href: '/old'})]), t('\u{1f600}', [s.mark('strong')]),
      t('b', [s.mark('link', {href: '/new'})])])
    const changes = compareNodeMetadata(old, next, {oldFrom: 10, newFrom: 20})
    expect(changes.map(pos)).toEqual([[12, 14, 22, 24], [14, 15, 24, 25]])
    expect(changes[1].after).toEqual([{type: 'link', attrs: {href: '/new'}}])
  })
  it('includes container attrs and child ranges without temporary documents', () => {
    const old = s.node('container', {title: 'old'}, p(t('x')))
    const next = s.node('container', {title: 'new'}, p(t('x', [s.mark('strong')])))
    expect(compareNodeMetadata(old, next, {oldFrom: 3, newFrom: 9}).map(pos))
      .toEqual([[3, 8, 9, 14], [5, 6, 11, 12]])
  })
  it('compares leaf image attrs and own marks over the complete leaf range', () => {
    const old = s.node('image', {src: '/old'})
    const next = s.node('image', {src: '/new'}, null, [s.mark('strong')])
    const changes = compareNodeMetadata(old, next, {oldFrom: 7, newFrom: 30})
    expect(changes.map(c => c.kind)).toEqual(['attrs', 'marks'])
    expect(changes.map(pos)).toEqual([[7, 8, 30, 31], [7, 8, 30, 31]])
  })
  it('defaults each offset independently and includes an empty block outer span', () => {
    expect(compareNodeMetadata(p(), p([], {data: 1}), {newFrom: 5}).map(pos)).toEqual([[0, 2, 5, 7]])
  })
  it('preserves input nodes and returns detached nested data', () => {
    const old = p([], {data: {values: [1]}}), next = p([], {data: {values: [2]}})
    const before = structuredClone([old.toJSON(), next.toJSON()])
    const changes = compareNodeMetadata(old, next)
    expect(changes[0].before).not.toBe(old.attrs)
    expect(changes[0].after).not.toBe(next.attrs)
    expect(changes[0].before.data.values).not.toBe(old.attrs.data.values)
    expect(changes[0].after.data.values).not.toBe(next.attrs.data.values)
    changes[0].before.data.values.push(3)
    changes[0].after.data.values[0] = 4
    expect([old.toJSON(), next.toJSON()]).toEqual(before)
    expect(old.attrs.data.values).toEqual([1])
    expect(next.attrs.data.values).toEqual([2])
    expect(compareNodeMetadata(old, old)).toEqual([])
  })
  it.each([-1, 0.5, NaN, Infinity, '1', Number.MAX_SAFE_INTEGER])('rejects invalid or overflowing offsets %s on either side', value => {
    expect(() => compareNodeMetadata(p(), p(), {oldFrom: value})).toThrow(RangeError)
    expect(() => compareNodeMetadata(p(), p(), {newFrom: value})).toThrow(RangeError)
  })
  it('accepts the exact safe integer range boundary', () => {
    const from = Number.MAX_SAFE_INTEGER - 2
    const changes = compareNodeMetadata(p(), p([], {data: 1}), {oldFrom: from, newFrom: from})
    expect(changes[0].oldTo).toBe(Number.MAX_SAFE_INTEGER)
  })
  it.each([
    [p(t('old')), p(t('new'))],
    [p(t('same')), s.node('heading', null, t('same'))],
    [p(t('a')), p([t('a'), s.node('image', {src: '/a'})])],
    [p([t('a'), s.node('image', {src: '/a'})]), p(t('a'))]
  ])('rejects text, type and nontext structure changes', (a, b) => {
    expect(() => compareNodeMetadata(a, b)).toThrow(RangeError)
  })
  it('rejects different schemas, JSON, direct text and document roots explicitly', () => {
    expect(() => compareNodeMetadata(p(), makeSchema().node('paragraph'))).toThrow(/same schema/)
    expect(() => compareNodeMetadata(p().toJSON(), p())).toThrow(TypeError)
    expect(() => compareNodeMetadata(t('a'), t('b'))).toThrow(/Direct text/)
    expect(() => compareNodeMetadata(s.node('doc', null, p()), p())).toThrow(/compareDocumentMetadata/)
    expect(() => compareNodeMetadata(p(), t('a'))).toThrow(/Direct text/)
  })
  it('validates schema content and retains snapshot rejection semantics', () => {
    expect(() => compareNodeMetadata(s.nodes.container.create(), s.nodes.container.create())).toThrow(RangeError)
    const cycle = {}; cycle.self = cycle
    expect(() => compareNodeMetadata(p([], {data: cycle}), p())).toThrow(TypeError)
    expect(() => compareNodeMetadata(p([], {data: new Date()}), p())).toThrow(TypeError)
  })
})
