import {describe, expect, it} from 'vitest'
import {Fragment, Node, Schema} from 'prosemirror-model'
import {compareDocumentBlocks, compareDocumentMetadata, compareNodeMetadata, diffGraphemes} from '../src/index.js'

const baseSeed = 0x6d2b79f5
const cases = Array.from({length: 16}, (_, index) => ({index, seed: (baseSeed + Math.imul(index, 0x9e3779b9)) >>> 0}))
const random = seed => limit => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % limit }
const schema = new Schema({nodes: {
  doc: {content: 'block*', attrs: {title: {default: ''}}},
  paragraph: {group: 'block', content: 'inline*', attrs: {align: {default: 'left'}}},
  section: {group: 'block', content: 'block*'}, list: {group: 'block', content: 'item+'}, item: {content: 'block+'},
  token: {group: 'inline', inline: true, atom: true, attrs: {label: {default: ''}}}, text: {group: 'inline'}
}, marks: {strong: {}, em: {}, link: {attrs: {href: {}}}}})
const p = value => schema.node('paragraph', null, value ? schema.text(value) : null)
const doc = (content, title = '') => schema.node('doc', {title}, content)
const snapshot = (a, b) => structuredClone([a.toJSON(), b.toJSON()])
const children = node => { const result = []; node.forEach(child => result.push(child)); return result }
const same = (a, b) => a.length === b.length && a.every((node, i) => node.eq(b[i]))

// No alignment algorithm here: use only original child boundaries and emitted events.
function verifyLayer(old, next, result, oldBase = 0, newBase = 0, depth = 0) {
  const a = children(old), b = children(next)
  const bounds = (nodes, start) => { const values = [start]; nodes.forEach(node => values.push(values.at(-1) + node.nodeSize)); return values }
  const oldBounds = bounds(a, oldBase), newBounds = bounds(b, newBase)
  let ai = 0, bi = 0, deepest = depth, truncated = 0
  const rebuilt = []
  for (const event of result.changes) {
    const af = oldBounds.indexOf(event.oldFrom), at = oldBounds.indexOf(event.oldTo)
    const bf = newBounds.indexOf(event.newFrom), bt = newBounds.indexOf(event.newTo)
    expect(af).toBeGreaterThanOrEqual(ai); expect(at).toBeGreaterThanOrEqual(af)
    expect(bf).toBeGreaterThanOrEqual(bi); expect(bt).toBeGreaterThanOrEqual(bf)
    expect(at > af || bt > bf).toBe(true)
    expect(same(a.slice(ai, af), b.slice(bi, bf))).toBe(true)
    expect(event.before.length).toBe(at - af); expect(event.after.length).toBe(bt - bf)
    event.before.forEach((node, i) => expect(node).toBe(a[af + i]))
    event.after.forEach((node, i) => expect(node).toBe(b[bf + i]))
    expect(event.kind).toBe(af === at ? 'insert' : bf === bt ? 'delete' : 'replace')
    rebuilt.push(...a.slice(ai, af), ...event.after)
    if (event.details) {
      expect(event.before).toHaveLength(1); expect(event.after).toHaveLength(1)
      if (event.details.truncated) {
        expect(event.details.changes).toEqual([])
        truncated++ // Truncation supplies no reconstruction contract for that layer.
      } else {
        const nested = verifyLayer(event.before[0], event.after[0], event.details, event.oldFrom + 1, event.newFrom + 1, depth + 1)
        deepest = Math.max(deepest, nested.deepest); truncated += nested.truncated
      }
    }
    ai = at; bi = bt
  }
  expect(same(a.slice(ai), b.slice(bi))).toBe(true)
  rebuilt.push(...a.slice(ai))
  expect(Fragment.fromArray(rebuilt).eq(next.content)).toBe(true)
  return {deepest, truncated}
}
const stripDetails = result => ({fallback: result.fallback, changes: result.changes.map(({details, ...event}) => event)})

function blockPair(index, seed) {
  const pick = random(seed), repeated = p('same')
  const before = [repeated, p(''), p(['a', 'e\u0301', '🇨🇦'][pick(3)]), repeated, p('tail')]
  const after = before.slice(), at = 1 + pick(3)
  if (index % 3 === 0) after.splice(at, 0, p(index % 2 ? '' : 'insert'))
  else if (index % 3 === 1) after.splice(at, 1)
  else after[at] = p('replacement ' + index)
  const wrap = nodes => schema.node('section', null, schema.node('list', null, schema.node('item', null, nodes)))
  if (index === 0) return [doc([]), doc([])]
  if (index === 1) return [doc([]), doc(wrap(after))]
  if (index === 2) return [doc(wrap(before)), doc([])]
  return [doc([p('prefix'), wrap(before), p('suffix')]), doc([p('prefix'), wrap(after), p('suffix')])]
}

describe('generated block contracts: independently reconstruct every reported child layer', () => {
  it.each(cases)('seed=$seed index=$index', ({index, seed}) => {
    const [old, next] = blockPair(index, seed), original = snapshot(old, next)
    old.check(); next.check()
    for (const [a, b] of [[old, next], [next, old]]) {
      for (const maxCells of [0, 3, 10000]) {
        expect(compareDocumentBlocks(a, a, {maxCells, maxDepth: 3})).toEqual({changes: [], fallback: false})
        const clone = Node.fromJSON(schema, a.toJSON())
        expect(clone).not.toBe(a)
        expect(compareDocumentBlocks(a, clone, {maxCells, maxDepth: 3})).toEqual({changes: [], fallback: false})
        const shallow = compareDocumentBlocks(a, b, {maxCells, maxDepth: 0})
        for (const maxDepth of [0, 1, 3]) {
          const result = compareDocumentBlocks(a, b, {maxCells, maxDepth})
          expect(stripDetails(result)).toEqual(shallow)
          const checked = verifyLayer(a, b, result)
          if (index >= 3 && maxCells === 10000 && maxDepth === 3) expect(checked.deepest).toBeGreaterThanOrEqual(3)
          if (index >= 3 && maxCells === 10000 && maxDepth === 1) expect(checked.truncated).toBeGreaterThan(0)
        }
      }
    }
    expect(snapshot(old, next)).toEqual(original)
    old.check(); next.check()
  })
})

// Independent metadata oracle: original attrs by node position, original marks
// for each UTF-16 unit. Metadata boundaries may split a grapheme legitimately.
function metadataState(root) {
  const attrs = [], marks = new Map(), types = new Map()
  function visit(node, from, isRoot = false) {
    if (!node.isText) attrs.push({nodeType: node.type.name, from, to: from + (isRoot ? node.content.size : node.nodeSize), value: structuredClone(node.attrs)})
    if (node.isText || node.isInline) for (let i = from; i < from + node.nodeSize; i++) {
      marks.set(i, node.marks.map(mark => mark.toJSON())); types.set(i, node.type.name)
    }
    if (!node.isText) node.forEach((child, offset) => visit(child, (isRoot ? from : from + 1) + offset))
  }
  visit(root, 0, true)
  return {attrs, marks, types}
}
const equalJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b)
function metadataPair(index, seed) {
  const pick = random(seed), strings = ['', 'e\u0301', '🇨🇦', 'a👩‍👩‍👧‍👦a', 'aa']
  const value = strings[index % strings.length] + strings[pick(strings.length)] + 'abcd'
  const paragraph = side => {
    const content = Array.from(value, (part, i) => {
      const before = i % 6 === 2 || i % 6 === 3 ? [] : [schema.mark('strong')]
      const after = i % 6 === 1 || i % 6 === 5 ? [schema.mark('em'), schema.mark('link', {href: 'new/' + (i % 3)})]
        : i % 6 === 3 ? [schema.mark('strong')] : before
      return schema.text(part, side ? after : before)
    })
    content.splice(Math.min(1, content.length), 0, schema.node('token', {label: side ? 'new' : 'old'}, null, side ? [schema.mark('em')] : []))
    return schema.node('paragraph', {align: side ? 'right' : 'left'}, content)
  }
  return [doc([paragraph(0), schema.node('section', null, paragraph(0))], 'old'), doc([paragraph(1), schema.node('section', null, paragraph(1))], 'new')]
}
const reverseRecord = record => ({...record, oldFrom: record.newFrom, oldTo: record.newTo, newFrom: record.oldFrom, newTo: record.oldTo, before: record.after, after: record.before})

describe('generated metadata contracts: UTF-16 oracle, reverse records and independent offset translation', () => {
  it.each(cases)('seed=$seed index=$index', ({index, seed}) => {
    const [old, next] = metadataPair(index, seed), original = snapshot(old, next)
    old.check(); next.check()
    const forward = compareDocumentMetadata(old, next), reverse = compareDocumentMetadata(next, old)
    expect(compareDocumentMetadata(old, old)).toEqual([])
    const clone = Node.fromJSON(schema, old.toJSON())
    expect(clone).not.toBe(old)
    expect(compareDocumentMetadata(old, clone)).toEqual([])
    expect(compareNodeMetadata(old.firstChild, clone.firstChild)).toEqual([])
    expect(reverse).toEqual(forward.map(reverseRecord))
    const a = metadataState(old), b = metadataState(next)
    const expectedAttrs = a.attrs.flatMap((entry, i) => equalJSON(entry.value, b.attrs[i].value) ? [] : [{kind: 'attrs', nodeType: entry.nodeType, oldFrom: entry.from, oldTo: entry.to, newFrom: b.attrs[i].from, newTo: b.attrs[i].to, before: entry.value, after: b.attrs[i].value}])
    expect(forward.filter(record => record.kind === 'attrs')).toEqual(expectedAttrs)
    const markRecords = forward.filter(record => record.kind === 'marks')
    let unchanged = 0, changed = 0, unmarked = 0
    for (const [position, before] of a.marks) {
      const after = b.marks.get(position)
      if (equalJSON(before, after)) unchanged++; else changed++
      if (!before.length && !after.length) unmarked++
      const covering = markRecords.filter(record => record.oldFrom <= position && position < record.oldTo)
      expect(covering).toHaveLength(equalJSON(before, after) ? 0 : 1)
      if (covering.length) {
        expect(covering[0].nodeType).toBe(a.types.get(position))
        expect(covering[0].nodeType).toBe(b.types.get(position))
        expect(covering[0].before).toEqual(before); expect(covering[0].after).toEqual(after)
        expect([covering[0].oldFrom, covering[0].oldTo]).toEqual([covering[0].newFrom, covering[0].newTo])
      }
    }
    expect(unchanged).toBeGreaterThan(0); expect(changed).toBeGreaterThan(0); expect(unmarked).toBeGreaterThan(0)
    for (const record of markRecords) {
      for (const value of [record.oldFrom, record.oldTo, record.newFrom, record.newTo]) expect(Number.isInteger(value)).toBe(true)
      expect(record.oldTo).toBeGreaterThan(record.oldFrom)
      for (let i = record.oldFrom; i < record.oldTo; i++) expect(a.marks.has(i)).toBe(true)
    }
    const local = compareNodeMetadata(old.firstChild, next.firstChild)
    expect(local).toEqual(forward.filter(record => record.nodeType !== 'doc' && record.oldTo <= old.firstChild.nodeSize))
    expect(local.length).toBeGreaterThan(0)
    const shifted = compareNodeMetadata(old.firstChild, next.firstChild, {oldFrom: 11, newFrom: 37})
    expect(shifted).toEqual(local.map(record => ({...record, oldFrom: record.oldFrom + 11, oldTo: record.oldTo + 11, newFrom: record.newFrom + 37, newTo: record.newTo + 37})))
    expect(compareNodeMetadata(next.firstChild, old.firstChild, {oldFrom: 37, newFrom: 11})).toEqual(shifted.map(reverseRecord))
    expect(snapshot(old, next)).toEqual(original)
  })
})

const segmenter = new Intl.Segmenter('en', {granularity: 'grapheme'})
const boundaries = text => new Set([0, text.length, ...Array.from(segmenter.segment(text), part => part.index)])
const pieces = ['a', 'a', '\r', '\n', 'e', '\u0301', '👩', '\u200d', '👧', '🇨', '🇦', '👍', '🏿', '']
describe('generated grapheme contracts: boundaries of complete concatenated inputs', () => {
  it.each(cases)('seed=$seed index=$index', ({index, seed}) => {
    const pick = random(seed), parts = Array.from({length: 4 + pick(8)}, () => pieces[pick(pieces.length)])
    // Prefixes force cross-piece composition; boundaries are never inferred from pieces.
    parts.unshift(...[['e', '\u0301'], ['\r', '\n'], ['🇨', '🇦'], ['👩', '\u200d', '👧']][index % 4])
    const changed = parts.slice(), at = pick(changed.length)
    changed.splice(at, index % 3 === 0 ? 0 : 1, pieces[pick(pieces.length)])
    for (const [old, next] of [[parts.join(''), changed.join('')], [changed.join(''), parts.join('')], [parts.join(''), parts.join('')]]) {
      const segments = diffGraphemes(old, next), oldBounds = boundaries(old), newBounds = boundaries(next)
      let oldOffset = 0, newOffset = 0, oldText = '', newText = ''
      for (const segment of segments) {
        expect([-1, 0, 1]).toContain(segment.type); expect(segment.level).toBe('grapheme')
        expect(segment.text.length).toBeGreaterThan(0)
        if (segment.type !== 1) { expect(oldBounds.has(oldOffset)).toBe(true); oldOffset += segment.text.length; oldText += segment.text; expect(oldBounds.has(oldOffset)).toBe(true) }
        if (segment.type !== -1) { expect(newBounds.has(newOffset)).toBe(true); newOffset += segment.text.length; newText += segment.text; expect(newBounds.has(newOffset)).toBe(true) }
      }
      expect([oldOffset, oldText]).toEqual([old.length, old]); expect([newOffset, newText]).toEqual([next.length, next])
    }
  })
})
