import {describe, expect, it} from 'vitest'
import {Schema} from 'prosemirror-model'
import {compareDocumentBlocks, compareDocumentMetadata, compareNodeMetadata} from '../src/index.js'
import {reviewTextChange} from '../example/src/text-review.js'

const s = new Schema({nodes: {
  doc: {content: 'block*'}, paragraph: {group: 'block', content: 'inline*'},
  section: {group: 'block', content: 'block*'}, text: {group: 'inline'},
  code_block: {group: 'block', content: 'text*', marks: ''},
  token: {inline: true, group: 'inline', atom: true, attrs: {label: {}}},
  content_atom: {inline: true, group: 'inline', atom: true, content: 'text*', attrs: {label: {}}}
}, marks: {strong: {}, code: {excludes: '_'}, diffMark: {attrs: {type: {default: 0}}}}})
const t = (value, marks = []) => s.text(value, marks)
const p = content => s.node('paragraph', null, content)
const doc = content => s.node('doc', null, content)
const pair = (old, next, options) => {
  const oldDoc = doc(old), newDoc = doc(next)
  oldDoc.check(); newDoc.check()
  const original = structuredClone([oldDoc.toJSON(), newDoc.toJSON()])
  const result = compareDocumentBlocks(oldDoc, newDoc, options)
  return {oldDoc, newDoc, result, original}
}
const preserved = ({oldDoc, newDoc, original}) => {
  oldDoc.check(); newDoc.check()
  expect([oldDoc.toJSON(), newDoc.toJSON()]).toEqual(original)
}

describe('composition counterexamples across independent review contracts', () => {
  it('separates same-text formatting from simultaneous text and formatting edits', () => {
    const before = p(t('same')), formatted = p(t('same', [s.mark('strong')]))
    const formatting = pair(before, formatted)
    const [event] = formatting.result.changes
    expect(event.before[0]).toBe(before)
    expect(event.after[0]).toBe(formatted)
    expect(compareDocumentMetadata(formatting.oldDoc, formatting.newDoc)).toEqual([
      {kind: 'marks', nodeType: 'text', oldFrom: 1, oldTo: 5, newFrom: 1, newTo: 5, before: [], after: [{type: 'strong'}]}
    ])
    expect(reviewTextChange(event)).toMatchObject({supported: true, hunks: []})
    const changed = pair(before, p(t('changed', [s.mark('strong')])))
    expect(() => compareDocumentMetadata(changed.oldDoc, changed.newDoc)).toThrow(RangeError)
    expect(() => compareNodeMetadata(before, changed.newDoc.firstChild)).toThrow(RangeError)
    expect(reviewTextChange(changed.result.changes[0])).toMatchObject({supported: true, oldText: 'same', newText: 'changed'})
    expect(changed.result.changes[0].after[0]).toBe(changed.newDoc.firstChild)
    preserved(formatting); preserved(changed)
  })

  it('shows why repeated words alone do not establish node or mark correspondence', () => {
    const bold = p(t('same', [s.mark('strong')])), plain = p(t('same'))
    const input = pair([bold, plain], [plain, bold])
    // Both possible correspondences have identical text, but incompatible meanings.
    expect(bold.textContent).toBe(plain.textContent)
    expect(compareNodeMetadata(bold, bold)).toEqual([])
    expect(compareNodeMetadata(bold, plain)).toHaveLength(1)
    const positional = compareDocumentMetadata(input.oldDoc, input.newDoc)
    expect(positional.map(c => [c.oldFrom, c.oldTo, c.before, c.after])).toEqual([
      [1, 5, [{type: 'strong'}], []], [7, 11, [], [{type: 'strong'}]]
    ])
    // Block events reconstruct both-node content without inventing a move contract.
    let cursor = 0, rebuilt = []
    for (const event of input.result.changes) {
      input.oldDoc.content.cut(cursor, event.oldFrom).forEach(node => rebuilt.push(node))
      rebuilt.push(...event.after)
      cursor = event.oldTo
    }
    input.oldDoc.content.cut(cursor).forEach(node => rebuilt.push(node))
    expect(doc(rebuilt).eq(input.newDoc)).toBe(true)
    preserved(input)
  })

  it.each(['token', 'content_atom'])('rejects plain-text refinement of %s despite equal textContent, while retaining metadata support', type => {
    const atom = label => s.node(type, {label}, type === 'content_atom' ? t('inner') : null)
    const old = p([t('A'), atom('old'), t('B')]), next = p([t('A'), atom('new'), t('B')])
    const input = pair(old, next), event = input.result.changes[0]
    expect(old.textContent).toBe(type === 'token' ? 'AB' : 'AinnerB')
    expect(next.textContent).toBe(old.textContent)
    expect(event.before[0]).toBe(old)
    expect(event.after[0]).toBe(next)
    expect(reviewTextChange(event)).toMatchObject({supported: false, reason: expect.stringContaining('inline atoms')})
    const metadata = compareNodeMetadata(old, next)
    expect(metadata).toHaveLength(1)
    expect(metadata[0]).toMatchObject({kind: 'attrs', nodeType: type, oldFrom: 2, newFrom: 2, before: {label: 'old'}, after: {label: 'new'}})
    expect(metadata[0].oldTo).toBe(2 + atom('old').nodeSize)
    preserved(input)
  })

  it('does not infer mark provenance when either repeated character could have been deleted', () => {
    const old = p([t('a', [s.mark('strong')]), t('a')]), next = p(t('a'))
    const input = pair(old, next), event = input.result.changes[0]
    expect(old.textContent.slice(0, 1)).toBe(next.textContent)
    expect(old.textContent.slice(1)).toBe(next.textContent)
    expect(() => compareNodeMetadata(old, next)).toThrow(RangeError)
    expect(() => compareDocumentMetadata(input.oldDoc, input.newDoc)).toThrow(RangeError)
    expect(reviewTextChange(event)).toMatchObject({supported: true, oldText: 'aa', newText: 'a'})
    expect(event.before[0]).toBe(old)
    expect(event.after[0]).toBe(next)
    expect(old.firstChild.marks.map(mark => mark.type.name)).toEqual(['strong'])
    expect(old.lastChild.marks).toEqual([])
    preserved(input)
  })

  it('composes nested block offsets with whole Unicode graphemes without treating text edits as metadata', () => {
    const oldFamily = '\u{1f468}\u200d\u{1f469}\u200d\u{1f467}\u200d\u{1f466}'
    const newFamily = '\u{1f469}\u200d\u{1f469}\u200d\u{1f467}\u200d\u{1f466}'
    const section = content => s.node('section', null, content)
    const input = pair(section([p(t('a')), p(t('A')), p(t(`Hi ${oldFamily} e\u0301!`))]),
      section([p(t('long lead')), p(t('A')), p(t(`Hi ${newFamily} \u00e9!`))]), {maxDepth: 1})
    const parent = input.result.changes[0], child = parent.details.changes.at(-1)
    expect(child.before[0]).toBe(input.oldDoc.firstChild.lastChild)
    expect(child.after[0]).toBe(input.newDoc.firstChild.lastChild)
    expect([child.oldFrom, child.newFrom]).toEqual([7, 15])
    expect(() => compareNodeMetadata(child.before[0], child.after[0], {oldFrom: 7, newFrom: 15})).toThrow(RangeError)
    const result = reviewTextChange(child)
    expect(result.hunks).toEqual([
      {kind: 'replace', oldFrom: 11, oldTo: 22, newFrom: 19, newTo: 30},
      {kind: 'replace', oldFrom: 23, oldTo: 25, newFrom: 31, newTo: 32}
    ])
    expect(input.oldDoc.textBetween(11, 22)).toBe(oldFamily)
    expect(input.newDoc.textBetween(19, 30)).toBe(newFamily)
    expect(input.oldDoc.textBetween(23, 25)).toBe('e\u0301')
    expect(input.newDoc.textBetween(31, 32)).toBe('\u00e9')
    expect(child.oldTo).toBeLessThan(parent.oldTo)
    expect(child.newTo).toBeLessThan(parent.newTo)
    preserved(input)
  })

  it('rejects an inserted inline atom even when both complete textContent strings are identical', () => {
    const old = p(t('ab')), next = p([t('a'), s.node('token', {label: 'inserted'}), t('b')])
    const input = pair(old, next), event = input.result.changes[0]
    expect(old.textContent).toBe('ab')
    expect(next.textContent).toBe('ab')
    expect(next.nodeSize).toBe(old.nodeSize + 1)
    expect(() => compareNodeMetadata(old, next)).toThrow(RangeError)
    expect(() => compareDocumentMetadata(input.oldDoc, input.newDoc)).toThrow(RangeError)
    expect(reviewTextChange(event).supported).toBe(false)
    expect(event.after[0].child(1).attrs.label).toBe('inserted')
    expect(event.after[0]).toBe(next)
    preserved(input)
  })

  it('preserves valid exclusive marks while refining only text correspondence', () => {
    const old = p(t('cat', [s.mark('code')])), next = p(t('cart', [s.mark('code')]))
    const input = pair(old, next), event = input.result.changes[0]
    expect(s.marks.code.spec.excludes).toBe('_')
    expect(event.before[0]).toBe(old)
    expect(event.after[0]).toBe(next)
    expect(event.after[0].firstChild.marks.map(m => m.type.name)).toEqual(['code'])
    event.before[0].check(); event.after[0].check()
    expect(() => compareDocumentMetadata(input.oldDoc, input.newDoc)).toThrow(RangeError)
    expect(() => compareNodeMetadata(old, next)).toThrow(RangeError)
    expect(reviewTextChange(event)).toMatchObject({supported: true, hunks: [
      {kind: 'insert', oldFrom: 3, oldTo: 3, newFrom: 3, newTo: 4}
    ]})
    preserved(input)
  })

  it('keeps mark-disallowing textblocks valid while describing plain-text changes externally', () => {
    const old = s.node('code_block', null, t('a')), next = s.node('code_block', null, t('b'))
    const input = pair(old, next), event = input.result.changes[0]
    expect(s.nodes.code_block.spec.marks).toBe('')
    expect(event.before[0]).toBe(old)
    expect(event.after[0]).toBe(next)
    expect(() => compareNodeMetadata(old, next)).toThrow(RangeError)
    expect(reviewTextChange(event)).toMatchObject({supported: true, hunks: [
      {kind: 'replace', oldFrom: 1, oldTo: 2, newFrom: 1, newTo: 2}
    ]})
    expect(old.firstChild.marks).toEqual([])
    expect(next.firstChild.marks).toEqual([])
    preserved(input)
  })
})
