import {describe, it, expect} from 'vitest'
import {Schema} from 'prosemirror-model'
import {compareDocumentBlocks, compareDocumentMetadata, compareNodeMetadata, diffEditor, patchDocumentNode, patchTextNodes} from '../src/index.js'
const attrs = {id: {default: null}, title: {default: null}, data: {default: null}}
const schema = new Schema({nodes: {
  doc: {content: 'block*', attrs}, paragraph: {group: 'block', content: 'text*', attrs},
  quote: {group: 'block', content: 'block+', attrs}, image: {group: 'block', attrs}, text: {}
}, marks: {link: {attrs: {id: {default: null}, href: {default: '/'}}}, strong: {}}})
const p = (id, text = 'same', title = null) => schema.node('paragraph', {id, title}, schema.text(text))
const doc = (nodes, id = null) => schema.node('doc', {id}, nodes)
const options = {ignoreAttributes: ['id']}

describe('attribute comparison projection', () => {
  it('preserves default output and suppresses only explicitly ignored ids', () => {
    const a = doc([p('old')]), b = doc([p('new')])
    expect(compareDocumentBlocks(a, b).changes).toHaveLength(1)
    expect(compareDocumentMetadata(a, b)).toHaveLength(1)
    expect(compareDocumentBlocks(a, b, {ignoreAttributes: []})).toEqual(compareDocumentBlocks(a, b))
    expect(compareDocumentBlocks(a, b, options)).toEqual({changes: [], fallback: false, comparison: {ignoredAttributes: ['id']}})
    expect(compareDocumentMetadata(a, b, options)).toEqual([])
    expect(compareNodeMetadata(a.firstChild, b.firstChild, options)).toEqual([])
  })
  it('keeps raw metadata snapshots and node references when another value changes', () => {
    const a = doc([p('old', 'same', 'before')]), b = doc([p('new', 'same', 'after')])
    const original = structuredClone([a.toJSON(), b.toJSON()])
    const record = compareNodeMetadata(a.firstChild, b.firstChild, {...options, oldFrom: 4, newFrom: 9})[0]
    expect(record).toMatchObject({oldFrom: 4, oldTo: 10, newFrom: 9, newTo: 15,
      before: {id: 'old', title: 'before'}, after: {id: 'new', title: 'after'}})
    const change = compareDocumentBlocks(a, b, options).changes[0]
    expect(change.before[0]).toBe(a.firstChild); expect(change.after[0]).toBe(b.firstChild)
    expect(change).toMatchObject({oldFrom: 0, oldTo: 6, newFrom: 0, newTo: 6})
    record.before.id = 'detached'
    expect([a.toJSON(), b.toJSON()]).toEqual(original)
  })
  it('filters node and mark top-level keys but never nested data keys or mark types', () => {
    const marked = (id, href = '/', mark = 'link') => schema.node('paragraph', {id},
      schema.text('same', [schema.mark(mark, {id, href})]))
    const a = marked('a'), b = marked('b')
    expect(compareNodeMetadata(a, b, options)).toEqual([])
    expect(compareDocumentBlocks(doc([a]), doc([b]), options).changes).toEqual([])
    expect(compareNodeMetadata(a, marked('b', '/changed'), options)[0].after[0].attrs).toEqual({id: 'b', href: '/changed'})
    expect(compareNodeMetadata(a, marked('b', '/', 'strong'), options)).toHaveLength(1)
    const x = schema.node('image', {data: {id: 'a'}}), y = schema.node('image', {data: {id: 'b'}})
    expect(compareNodeMetadata(x, y, options)).toHaveLength(1)
  })
  it('allows ignored document markup while still rejecting meaningful root differences', () => {
    const a = doc([p('a')], 'old'), b = doc([p('b')], 'new')
    expect(() => compareDocumentBlocks(a, b)).toThrow(/document-level markup/)
    expect(compareDocumentBlocks(a, b, options).changes).toEqual([])
    expect(compareDocumentMetadata(a, b, options)).toEqual([])
    expect(() => compareDocumentBlocks(a, schema.node('doc', {title: 'different'}, [p('b')]), options)).toThrow(/document-level markup/)
  })
  it('normalizes projected split text runs without modifying raw text or marks', () => {
    const text = (value, id) => schema.text(value, [schema.mark('link', {id})])
    const a = schema.node('paragraph', null, [text('👩‍👩‍👧‍👦', 'a'), text('!', 'b')])
    const b = schema.node('paragraph', null, [text('👩‍👩‍👧‍👦!', 'c')])
    expect(a.childCount).toBe(2); expect(b.childCount).toBe(1)
    expect(compareDocumentBlocks(doc([a]), doc([b]), options).changes).toEqual([])
    expect(compareNodeMetadata(a, b, options)).toEqual([])
    expect(a.childCount).toBe(2)
  })
  it('propagates policy through nested ranges, truncation and shared budget fallback', () => {
    const quote = (id, nodes) => schema.node('quote', {id}, nodes)
    const a = doc([quote('a', [p('x', 'old')])]), b = doc([quote('b', [p('y', 'new')])])
    const result = compareDocumentBlocks(a, b, {...options, maxDepth: 1, maxCells: 4})
    expect(result.changes[0].details).toMatchObject({fallback: true, comparison: {ignoredAttributes: ['id']},
      changes: [{oldFrom: 1, oldTo: 6, newFrom: 1, newTo: 6}]})
    const x = doc([quote('a', [quote('c', [p('x', 'old')])])])
    const y = doc([quote('b', [quote('d', [p('y', 'new')])])])
    expect(compareDocumentBlocks(x, y, {...options, maxDepth: 1}).changes[0].details.changes[0].details)
      .toMatchObject({truncated: true, comparison: {ignoredAttributes: ['id']}})
  })
  it('keeps insert/delete positions, repeats and raw outputs', () => {
    const a = doc([p('a'), p('b')]), inserted = p('inserted', 'extra'), b = doc([p('c'), inserted, p('d')])
    const change = compareDocumentBlocks(a, b, options).changes[0]
    expect(change).toMatchObject({kind: 'insert', oldFrom: 6, oldTo: 6, newFrom: 6, newTo: 13})
    expect(change.after[0]).toBe(inserted)
    expect(compareDocumentBlocks(b, a, options).changes[0].kind).toBe('delete')
  })
  it('does not bypass metadata validation or text/structure restrictions', () => {
    expect(() => compareNodeMetadata(p('a', 'old'), p('b', 'new'), options)).toThrow(/identical/)
    const data = {}; data.self = data
    const a = schema.node('image', {data}), b = schema.node('image')
    expect(() => compareNodeMetadata(a, b, {ignoreAttributes: ['data']})).toThrow(/acyclic/)
  })
  it.each([null, 'id', [1], Array(1)])('rejects invalid filter %j across structured paths', ignoreAttributes => {
    const a = doc([p('a')]), b = doc([p('b')])
    expect(() => compareDocumentBlocks(a, b, {ignoreAttributes})).toThrow(TypeError)
    expect(() => compareDocumentMetadata(a, b, {ignoreAttributes})).toThrow(TypeError)
    expect(() => compareNodeMetadata(a.firstChild, b.firstChild, {ignoreAttributes})).toThrow(TypeError)
  })
  it('rejects legacy use explicitly instead of silently accepting an ineffective option', () => {
    const a = doc([p('a')])
    expect(() => diffEditor(schema, a.toJSON(), a.toJSON(), options)).toThrow(/structured/)
    expect(() => patchDocumentNode(schema, a, a, options)).toThrow(/structured/)
    expect(() => patchTextNodes(schema, [], [], options)).toThrow(/structured/)
  })
})
