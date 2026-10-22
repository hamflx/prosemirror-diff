import {describe, expect, it} from 'vitest'
import {Schema} from 'prosemirror-model'
import {compareDocumentMetadata, diffEditor} from '../src/index.js'

const makeSchema = () => new Schema({
  nodes: {
    doc: {content: 'block+', attrs: {title: {default: ''}}},
    paragraph: {group: 'block', content: 'inline*', attrs: {align: {default: 'left'}, data: {default: null}}},
    heading: {group: 'block', content: 'inline*'},
    container: {group: 'block', content: 'paragraph'},
    image: {group: 'inline', inline: true, attrs: {src: {}, alt: {default: ''}}},
    hard_break: {group: 'inline', inline: true},
    text: {group: 'inline'}
  },
  marks: {strong: {}, em: {}, link: {attrs: {href: {}}}, diffMark: {attrs: {type: {default: 0}}}}
})
const schema = makeSchema()
const t = (text, marks = []) => schema.text(text, marks)
const p = (content = [], attrs = {}) => schema.node('paragraph', attrs, content)
const doc = (content, attrs) => schema.node('doc', attrs, content)
const positions = change => [change.oldFrom, change.oldTo, change.newFrom, change.newTo]

describe('compareDocumentMetadata', () => {
  it('reports added formatting without a diffMark schema requirement', () => {
    const plain = new Schema({nodes: {doc: {content: 'text*'}, text: {}}, marks: {strong: {}}})
    const old = plain.node('doc', null, plain.text('abc'))
    const next = plain.node('doc', null, plain.text('abc', [plain.mark('strong')]))
    expect(compareDocumentMetadata(old, next)).toEqual([{kind: 'marks', nodeType: 'text',
      oldFrom: 0, oldTo: 3, newFrom: 0, newTo: 3, before: [], after: [{type: 'strong'}]}])
  })

  it('aligns formatting splits and uses UTF-16 document positions', () => {
    const old = doc(p(t('a😀bc')))
    const next = doc(p([t('a'), t('😀', [schema.mark('strong')]), t('bc')]))
    const changes = compareDocumentMetadata(old, next)
    expect(changes).toHaveLength(1)
    expect(positions(changes[0])).toEqual([2, 4, 2, 4])
    expect(old.textBetween(changes[0].oldFrom, changes[0].oldTo)).toBe('😀')
    expect(changes[0].after).toEqual([{type: 'strong'}])
  })

  it('reports removed marks and link-target changes', () => {
    const old = doc(p([t('ab', [schema.mark('strong')]), t('cd', [schema.mark('link', {href: '/old'})])]))
    const next = doc(p([t('ab'), t('cd', [schema.mark('link', {href: '/new'})])]))
    const changes = compareDocumentMetadata(old, next)
    expect(changes.map(positions)).toEqual([[1, 3, 1, 3], [3, 5, 3, 5]])
    expect(changes[0].after).toEqual([])
    expect(changes[1].before).toEqual([{type: 'link', attrs: {href: '/old'}}])
    expect(changes[1].after).toEqual([{type: 'link', attrs: {href: '/new'}}])
  })

  it('compares overlapping formatting runs at the union of both sets of boundaries', () => {
    const old = doc(p([t('ab', [schema.mark('strong')]), t('cd', [schema.mark('em')])]))
    const next = doc(p([t('a', [schema.mark('link', {href: '/a'})]),
      t('bc', [schema.mark('strong')]), t('d', [schema.mark('em')])]))
    expect(compareDocumentMetadata(old, next).map(positions)).toEqual([[1, 2, 1, 2], [3, 4, 3, 4]])
  })

  it('reports image attrs and marks as separate records over the leaf range', () => {
    const old = doc(p([t('a'), schema.node('image', {src: '/a'})]))
    const next = doc(p([t('a'), schema.node('image', {src: '/b', alt: 'B'}, null, [schema.mark('em')])]))
    const changes = compareDocumentMetadata(old, next)
    expect(changes.map(c => c.kind)).toEqual(['attrs', 'marks'])
    expect(changes.map(positions)).toEqual([[2, 3, 2, 3], [2, 3, 2, 3]])
    expect(changes[0].before).toEqual({src: '/a', alt: ''})
    expect(changes[0].after).toEqual({src: '/b', alt: 'B'})
  })

  it('handles nested strict single-child containers without constructing mixed content', () => {
    const old = doc(schema.node('container', null, p(t('x'))))
    const next = doc(schema.node('container', null, p(t('x'), {align: 'right'})))
    const before = [old.toJSON(), next.toJSON()]
    const changes = compareDocumentMetadata(old, next)
    expect(changes.map(positions)).toEqual([[1, 4, 1, 4]])
    expect(changes[0].after.align).toBe('right')
    old.check(); next.check()
    expect([old.toJSON(), next.toJSON()]).toEqual(before)
  })

  it('uses document content bounds for root attrs, including empty documents', () => {
    const changes = compareDocumentMetadata(doc(p(), {title: 'a'}), doc(p(), {title: 'b'}))
    expect(positions(changes[0])).toEqual([0, 2, 0, 2])
    const emptySchema = new Schema({nodes: {doc: {content: 'text*', attrs: {title: {default: ''}}}, text: {}}})
    const empty = compareDocumentMetadata(emptySchema.node('doc'), emptySchema.node('doc', {title: 'b'}))
    expect(positions(empty[0])).toEqual([0, 0, 0, 0])
  })

  it('compares nested attributes by value, independent of object key order', () => {
    const a = {a: [1, {b: true}], c: null}, b = {c: null, a: [1, {b: true}]}
    expect(compareDocumentMetadata(doc(p([], {data: a})), doc(p([], {data: b})))).toEqual([])
    const changes = compareDocumentMetadata(doc(p([], {data: a})), doc(p([], {data: {a: [2]}})))
    expect(changes).toHaveLength(1)
  })

  it('returns detached before/after snapshots', () => {
    const old = doc(p([], {data: {items: [1]}})), next = doc(p([], {data: {items: [2]}}))
    const changes = compareDocumentMetadata(old, next)
    changes[0].before.data.items[0] = 8
    changes[0].after.data.items.push(9)
    expect(old.firstChild.attrs.data.items).toEqual([1])
    expect(next.firstChild.attrs.data.items).toEqual([2])
  })

  it('distinguishes array lengths, including sparse plain data', () => {
    const changes = compareDocumentMetadata(doc(p([], {data: []})), doc(p([], {data: Array(1)})))
    expect(changes).toHaveLength(1)
    expect(changes[0].after.data.length).toBe(1)
  })

  it('pairs identical repeated blocks by position, never inferring a move', () => {
    const old = doc([p(t('same'), {align: 'left'}), p(t('same'), {align: 'right'})])
    const next = doc([p(t('same'), {align: 'right'}), p(t('same'), {align: 'left'})])
    const changes = compareDocumentMetadata(old, next)
    expect(changes.map(positions)).toEqual([[0, 6, 0, 6], [6, 12, 6, 12]])
    expect(changes.map(c => c.kind)).toEqual(['attrs', 'attrs'])
  })

  it.each([
    [doc(p(t('a'))), doc(p(t('b')))],
    [doc(p(t('a'))), doc([p(t('a')), p()])],
    [doc([p(t('a')), p()]), doc(p(t('a')))],
    [doc(p(t('a'))), doc(schema.node('heading', null, t('a')))],
    [doc([p(t('a')), p(t('b'))]), doc([p(t('b')), p(t('a'))])],
    [doc(p([t('a'), schema.node('hard_break'), t('b')])), doc(p(t('ab')))]
  ])('rejects structural/text differences rather than returning a misleading partial diff', (a, b) => {
    expect(() => compareDocumentMetadata(a, b)).toThrow(RangeError)
  })

  it('rejects invalid schemas and non-document inputs', () => {
    expect(() => compareDocumentMetadata(doc(p()), doc(p()).toJSON())).toThrow(TypeError)
    expect(() => compareDocumentMetadata(p(), p())).toThrow(TypeError)
    const other = makeSchema()
    expect(() => compareDocumentMetadata(doc(p()), other.node('doc', null, other.node('paragraph')))).toThrow(TypeError)
    expect(() => compareDocumentMetadata(schema.node('doc'), doc(p()))).toThrow(RangeError)
  })

  it('rejects cyclic and non-plain metadata rather than mutating or serializing it', () => {
    const cycle = {}; cycle.self = cycle
    expect(() => compareDocumentMetadata(doc(p([], {data: cycle})), doc(p()))).toThrow(TypeError)
    expect(() => compareDocumentMetadata(doc(p([], {data: new Date()})), doc(p()))).toThrow(TypeError)
  })

  it('exposes metadata changes that the existing renderer does not annotate', () => {
    const old = doc(p([t('link', [schema.mark('link', {href: '/old'})]), schema.node('image', {src: '/old'})]))
    const next = doc(p([t('link', [schema.mark('link', {href: '/new'})]), schema.node('image', {src: '/new'})]))
    const legacy = diffEditor(schema, old.toJSON(), next.toJSON())
    expect(legacy.firstChild.firstChild.marks.some(m => m.type.name === 'diffMark')).toBe(false)
    expect(legacy.firstChild.lastChild.attrs.src).toBe('/old')
    expect(compareDocumentMetadata(old, next).map(c => c.kind)).toEqual(['marks', 'attrs'])
  })
})
