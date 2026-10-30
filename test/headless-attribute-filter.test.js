import {expect, it} from 'vitest'
import {Schema} from 'prosemirror-model'
import {reviewDocuments} from '../example/headless/model-review.mjs'
import {compareDocumentBlocks} from '../src/blocks.js'

const schema = new Schema({nodes: {
  doc: {content: 'paragraph+'},
  paragraph: {content: 'text*', attrs: {id: {default: null}, title: {default: null}}}, text: {}
}})
const doc = (id, title) => schema.node('doc', null,
  schema.node('paragraph', {id, title}, schema.text('same')))

it('rejects saved reports with a filter before producing inconsistent selected metadata or replay options', () => {
  const old = doc('old', 'before'), next = doc('new', 'after')
  const before = structuredClone([old.toJSON(), next.toJSON()])
  const options = {maxDepth: 2, ignoreAttributes: ['id']}
  expect(compareDocumentBlocks(old, next, options).comparison).toEqual({ignoredAttributes: ['id']})
  for (const path of [undefined, '0']) {
    expect(() => reviewDocuments(old, next, path, options)).toThrow(/Saved headless reports do not support ignoreAttributes/)
  }
  expect([old.toJSON(), next.toJSON()]).toEqual(before)
  expect(options.ignoreAttributes).toEqual(['id'])
})

it('keeps empty-filter saved reports identical to default reports and replayable without policy loss', () => {
  const old = doc('old', 'before'), next = doc('new', 'after')
  const report = reviewDocuments(old, next, '0')
  expect(reviewDocuments(old, next, '0', {maxDepth: 2, maxCells: 100000, ignoreAttributes: []})).toEqual(report)
  const saved = JSON.parse(JSON.stringify(report))
  expect(reviewDocuments(schema.nodeFromJSON(saved.snapshots.before),
    schema.nodeFromJSON(saved.snapshots.after), '0', saved.options)).toEqual(report)
})
