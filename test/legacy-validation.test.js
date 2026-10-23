import {describe, expect, it, vi} from 'vitest'
import {Node, Schema} from 'prosemirror-model'
import {diffEditor, patchDocumentNode, patchTextNodes, createDiffNode, createNewNode, createTextNode, DiffType} from '../src/index.js'
const schema = new Schema({nodes: {
  doc: {content: 'block+'}, paragraph: {group: 'block', content: 'text*'},
  heading: {group: 'block', content: 'text*'}, container: {group: 'block', content: 'block'},
  section: {group: 'block', content: 'block*'}, code_block: {group: 'block', content: 'text*', marks: ''}, text: {}
}, marks: {code: {excludes: '_'}, strong: {}, diffMark: {attrs: {type: {default: 0}}}}})
const text = (value, marks = []) => schema.text(value, marks)
const block = (type, value, marks = []) => schema.node(type, null, text(value, marks))
const doc = node => schema.node('doc', null, node)
const rejectedOutput = run => {
  let caught
  try { run() } catch (error) { caught = error }
  expect(caught).toBeInstanceOf(RangeError)
  expect(caught.message).toMatch(/^Diff output cannot be represented in the original schema:/)
  expect(caught.cause).toBeInstanceOf(RangeError)
  return caught
}

describe('legacy schema validation boundaries', () => {
  it.each(['char', 'word', 'grapheme'])('rejects exclusive and disallowed marks in %s without changing either input', level => {
    for (const [type, a, b, marks] of [
      ['paragraph', 'cat', 'cart', [schema.mark('code')]],
      ['code_block', 'a', 'b', []]
    ]) {
      const old = doc(block(type, a, marks)), next = doc(block(type, b, marks))
      old.check(); next.check()
      const json = [old.toJSON(), next.toJSON()], original = structuredClone(json)
      rejectedOutput(() => diffEditor(schema, json[0], json[1], {level}))
      rejectedOutput(() => patchDocumentNode(schema, old, next, {level}))
      expect(json).toEqual(original)
      expect([old.toJSON(), next.toJSON()]).toEqual(original)
      old.check(); next.check()
    }
  })
  it.each(['char', 'word', 'grapheme'])('preserves supported %s output and source marks', level => {
    const old = doc(block('paragraph', 'cat', [schema.mark('strong')]))
    const next = doc(block('paragraph', 'cart', [schema.mark('strong')]))
    const result = diffEditor(schema, old.toJSON(), next.toJSON(), {level})
    result.check()
    const changed = result.firstChild.content.content.filter(n => n.marks.some(m => m.type.name === 'diffMark'))
    expect(changed.length).toBeGreaterThan(0)
    expect(changed.every(n => n.marks.some(m => m.type.name === 'strong'))).toBe(true)
    expect(result.textContent).toContain('r')
    expect(old.textContent).toBe('cat')
    expect(next.textContent).toBe('cart')
  })
  it('rejects a mixed child replacement that violates a strict single-child container', () => {
    const old = doc(schema.node('container', null, block('heading', 'same')))
    const next = doc(schema.node('container', null, block('paragraph', 'same')))
    expect(rejectedOutput(() => diffEditor(schema, old.toJSON(), next.toJSON())).cause.message).toContain('Invalid content')
    old.check(); next.check()
  })
  it('validates invalid inputs before an unchanged-content shortcut', () => {
    // create(), unlike schema.node()/createChecked(), permits the intentionally
    // invalid fixture so the public comparison boundary performs the rejection.
    const bad = doc(schema.nodes.code_block.create(null, text('same', [schema.mark('strong')])))
    for (const run of [() => patchDocumentNode(schema, bad, bad), () => diffEditor(schema, bad.toJSON(), bad.toJSON())]) {
      expect(run).toThrow(/^Invalid input node:/)
    }
    const invalidMarks = text('x', [schema.mark('code'), schema.mark('strong')])
    expect(() => patchTextNodes(schema, [invalidMarks], [invalidMarks])).toThrow(/^Invalid input node:/)
    expect(() => createDiffNode(schema, bad, DiffType.Inserted)).toThrow(/^Invalid input node:/)
    rejectedOutput(() => createNewNode(bad, bad.content.content))
  })
  it('keeps valid unchanged exclusive and mark-disallowing content usable without a diffMark type', () => {
    const plainSchema = new Schema({nodes: {doc: {content: 'p'}, p: {content: 'text*', marks: ''}, text: {}}})
    const unchanged = plainSchema.node('doc', null, plainSchema.node('p', null, plainSchema.text('same')))
    expect(diffEditor(plainSchema, unchanged.toJSON(), unchanged.toJSON()).eq(unchanged)).toBe(true)
    for (const node of [doc(block('code_block', 'same')), doc(block('paragraph', 'same', [schema.mark('code')]))]) {
      expect(patchDocumentNode(schema, node, node).eq(node)).toBe(true)
    }
  })
  it('allows createNewNode to replace invalid placeholder content with valid children', () => {
    const placeholder = schema.nodes.container.create()
    expect(() => placeholder.check()).toThrow(RangeError)
    const child = block('paragraph', 'valid')
    const repaired = createNewNode(placeholder, [child])
    repaired.check()
    expect(repaired.firstChild).toBe(child)
    expect(placeholder.childCount).toBe(0)
  })
  it('validates direct public constructors and text patches without assuming an unknown parent', () => {
    const coded = text('cat', [schema.mark('code')])
    rejectedOutput(() => createDiffNode(schema, coded, DiffType.Deleted))
    rejectedOutput(() => createDiffNode(schema, block('code_block', 'x'), DiffType.Inserted))
    rejectedOutput(() => patchTextNodes(schema, [coded], [text('cart', [schema.mark('code')])]))
    rejectedOutput(() => createTextNode(schema, 'x', [schema.mark('code'), schema.mark('strong')]))
    const marked = createTextNode(schema, 'x', [schema.mark('strong')])
    marked.check() // Valid standalone text need not be allowed by every parent.
    rejectedOutput(() => createNewNode(block('code_block', 'x'), [marked]))
    const valid = createDiffNode(schema, block('paragraph', 'x'), DiffType.Inserted)
    valid.check()
    expect(valid.firstChild.marks.map(m => m.type.name)).toEqual(['diffMark'])
    const originalText = text('same')
    expect(createNewNode(originalText, [])).toBe(originalText) // TextNode.copy compatibility.
  })
  it('rejects incompatible duplicate diffMarks while preserving an unchanged existing diffMark', () => {
    const deleted = schema.mark('diffMark', {type: DiffType.Deleted})
    const inserted = schema.mark('diffMark', {type: DiffType.Inserted})
    const original = text('x', [deleted])
    expect(patchTextNodes(schema, [original], [original])[0].marks).toEqual([deleted])
    rejectedOutput(() => createDiffNode(schema, original, DiffType.Inserted))
    rejectedOutput(() => createTextNode(schema, 'x', [deleted, inserted]))
    expect(original.marks).toEqual([deleted])
  })
  it('does not swallow non-validation exceptions', () => {
    const broken = block('paragraph', 'same')
    const failure = new Error('custom check failure')
    const check = vi.spyOn(broken, 'check').mockImplementation(() => { throw failure })
    try { expect(() => patchDocumentNode(schema, broken, broken)).toThrow(failure) }
    finally { check.mockRestore() }
  })
  it('checks each input and final output once rather than recursively revalidating every ancestor', () => {
    const nest = node => { for (let i = 0; i < 60; i++) node = schema.node('section', null, node); return doc(node) }
    const old = nest(block('paragraph', 'cat')), next = nest(block('paragraph', 'cart'))
    const count = node => { let n = 1; node.descendants(() => { n++ }); return n }
    const check = vi.spyOn(Node.prototype, 'check')
    try {
      const result = patchDocumentNode(schema, old, next)
      expect(check).toHaveBeenCalledTimes(count(old) + count(next) + count(result))
    } finally { check.mockRestore() }
  })
})
