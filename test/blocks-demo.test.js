import {describe, expect, it} from 'vitest'
import {compareDocumentBlocks} from '../src/index.js'
import {scenarios} from '../example/src/blocks-scenarios.js'

const compare = (id, maxCells = 100000) => {
  const item = scenarios.find(item => item.id === id)
  return compareDocumentBlocks(item.oldDoc, item.newDoc, {maxCells})
}
const ranges = result => result.changes.map(c => [c.kind, c.oldFrom, c.oldTo, c.newFrom, c.newTo])

describe('block review example fixtures', () => {
  it('exposes real empty ranges and empty blocks', () => {
    expect(ranges(compare('insert'))).toEqual([['insert', 9, 9, 9, 24]])
    expect(ranges(compare('delete'))).toEqual([['delete', 9, 28, 9, 9]])
    expect(ranges(compare('empty-block'))).toEqual([['insert', 9, 9, 9, 11]])
    expect(ranges(compare('empty-document'))).toEqual([['insert', 0, 0, 0, 17]])
  })
  it('keeps strict containers valid and reports image attribute replacements', () => {
    const item = scenarios.find(item => item.id === 'strict-container')
    item.oldDoc.check()
    item.newDoc.check()
    expect(item.oldDoc.firstChild.childCount).toBe(1)
    expect(item.newDoc.firstChild.childCount).toBe(1)
    expect(ranges(compare('strict-container'))).toEqual([['replace', 0, 14, 0, 14]])
    expect(ranges(compare('image'))).toEqual([['replace', 7, 8, 7, 8]])
  })
  it('demonstrates repeated-block correspondence without move events', () => {
    expect(ranges(compare('repeated'))).toEqual([['delete', 0, 3, 0, 0], ['insert', 9, 9, 6, 9]])
  })
  it('shows precision differences and zero-budget no-matrix cases truthfully', () => {
    expect(compare('budget').changes).toHaveLength(2)
    expect(compare('budget').fallback).toBe(false)
    expect(compare('budget', 0).changes).toHaveLength(1)
    expect(compare('budget', 0).fallback).toBe(true)
    expect(compare('insert', 0).fallback).toBe(false)
    expect(compare('unchanged', 0)).toEqual({changes: [], fallback: false})
  })
})
