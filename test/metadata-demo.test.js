import {describe, it, expect} from 'vitest'
import {compareDocumentMetadata} from '../src/index.js'
import {scenarios, schema, textSegments, rangeMatches} from '../example/src/metadata-scenarios.js'

describe('read-only metadata example fixtures', () => {
  it('locates the combined formatting, link and image changes on both sides', () => {
    const {oldDoc, newDoc} = scenarios[0]
    const changes = compareDocumentMetadata(oldDoc, newDoc)
    expect(changes.map(change => [change.kind, change.nodeType, change.oldFrom, change.oldTo, change.newFrom, change.newTo])).toEqual([
      ['marks', 'text', 3, 17, 3, 17],
      ['marks', 'text', 37, 50, 37, 50],
      ['attrs', 'image', 52, 53, 52, 53]
    ])
    expect(oldDoc.textBetween(3, 17)).toBe('clear decision')
    expect(newDoc.textBetween(37, 50)).toBe('project notes')
    expect(oldDoc.nodeAt(52).type.name).toBe('image')
    expect(changes[1].before[0].attrs.href).toContain('/original')
    expect(changes[1].after[0].attrs.href).toContain('/revised')
    expect(changes[2].before.alt).toContain('Green')
    expect(changes[2].after.alt).toContain('Blue')
  })

  it('has isolated examples, an empty result, and a rejected text edit', () => {
    for (const id of ['bold', 'link', 'image']) {
      const item = scenarios.find(item => item.id === id)
      expect(compareDocumentMetadata(item.oldDoc, item.newDoc)).toHaveLength(1)
    }
    const unchanged = scenarios.find(item => item.id === 'unchanged')
    expect(compareDocumentMetadata(unchanged.oldDoc, unchanged.newDoc)).toEqual([])
    const unsupported = scenarios.find(item => item.id === 'unsupported')
    expect(() => compareDocumentMetadata(unsupported.oldDoc, unsupported.newDoc)).toThrow(RangeError)
  })

  it('splits a merged plain text node at exact change boundaries', () => {
    const {oldDoc, newDoc} = scenarios[0]
    const changes = compareDocumentMetadata(oldDoc, newDoc)
    const segments = textSegments(oldDoc.firstChild.firstChild, 1, changes, 'old')
    expect(segments.map(segment => segment.text)).toEqual(['A ', 'clear decision', ' matters.'])
    expect(segments.filter(segment => rangeMatches(segment.from, segment.to, changes[0], 'old')).map(segment => segment.text)).toEqual(['clear decision'])
  })

  it('uses UTF-16 offsets without splitting unrelated surrogate pairs', () => {
    const node = schema.text('A😀B')
    const change = {oldFrom: 2, oldTo: 4, newFrom: 2, newTo: 4}
    const segments = textSegments(node, 1, [change], 'new')
    expect(segments.map(segment => [segment.text, segment.from, segment.to])).toEqual([['A', 1, 2], ['😀', 2, 4], ['B', 4, 5]])
    expect(rangeMatches(1, 5, change, 'new')).toBe(false)
  })
})
