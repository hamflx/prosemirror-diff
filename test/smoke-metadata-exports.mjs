// Run after the library build: node test/smoke-metadata-exports.mjs
// Kept outside unit-test discovery so tests never depend on generated bundles.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {Schema} from 'prosemirror-model'
const require = createRequire(import.meta.url)
const cjs = require('../lib/index.cjs.js')
const esm = await import('../lib/index.esm.js')
// Native Node resolution must exercise the public source entry, not a bundler.
const source = await import('../src/index.js')
const schema = new Schema({nodes: {
  doc: {content: 'paragraph+'}, paragraph: {content: 'text*'}, text: {}
}, marks: {strong: {}}})
const old = schema.node('paragraph', null, schema.text('same'))
const next = schema.node('paragraph', null, schema.text('same', [schema.mark('strong')]))
const expected = [{kind: 'marks', nodeType: 'text', oldFrom: 5, oldTo: 9,
  newFrom: 10, newTo: 14, before: [], after: [{type: 'strong'}]}]
for (const [format, api] of [['CJS', cjs], ['ESM', esm], ['source', source]]) {
  assert.deepEqual(Object.keys(api).sort(), Object.keys(source).sort(), format)
  assert.deepEqual(api.DiffType, {Unchanged: 0, Deleted: -1, Inserted: 1}, format)
  assert.deepEqual(api.diffGraphemes('\u{1f44d}\u{1f3fb}', '\u{1f44d}\u{1f3ff}'), [
    {type: -1, text: '\u{1f44d}\u{1f3fb}', level: 'grapheme'},
    {type: 1, text: '\u{1f44d}\u{1f3ff}', level: 'grapheme'}
  ], format)
  for (const name of ['patchDocumentNode', 'patchTextNodes', 'createDiffNode',
    'createNewNode', 'createTextNode', 'createDiffMark', 'tokenizeText',
    'diffGraphemes', 'diffWordsWithDetail', 'getNodeChildren', 'getNodeMarks']) {
    assert.equal(typeof api[name], 'function', `${format}: ${name}`)
  }
  assert.equal(typeof api.compareDocumentMetadata, 'function', format)
  assert.equal(typeof api.compareNodeMetadata, 'function', format)
  assert.deepEqual(api.compareNodeMetadata(old, next, {oldFrom: 4, newFrom: 9}), expected, format)
  assert.deepEqual(api.compareDocumentMetadata(schema.node('doc', null, old), schema.node('doc', null, next)),
    [{...expected[0], oldFrom: 1, oldTo: 5, newFrom: 1, newTo: 5}], format)
  assert.throws(() => api.compareNodeMetadata(schema.text('a'), schema.text('b')), /Direct text/, format)
  const oldDoc = schema.node('doc', null, old)
  assert.deepEqual(api.compareDocumentBlocks(oldDoc, oldDoc).changes, [], format)
  assert.deepEqual(api.compareDocumentBlocks(oldDoc, schema.node('doc', null, [old, next])), {
    changes: [{kind: 'insert', oldFrom: 6, oldTo: 6, newFrom: 6, newTo: 12,
      before: [], after: [next]}], fallback: false
  }, format)
  // Use each bundle's model module instance for legacy node construction.
  const ModelSchema = format === 'CJS' ? require('prosemirror-model').Schema : Schema
  const legacySchema = new ModelSchema({nodes: {
    doc: {content: 'paragraph+'}, paragraph: {content: 'text*'}, text: {}
  }, marks: {diffMark: {attrs: {type: {default: 0}}}}})
  const doc = text => legacySchema.node('doc', null,
    legacySchema.node('paragraph', null, legacySchema.text(text))).toJSON()
  const combined = api.diffEditor(legacySchema, doc('cat'), doc('cart'))
  combined.check()
  assert.equal(combined.textContent, 'cart', format)
  assert.equal(combined.firstChild.child(1).marks[0].attrs.type, api.DiffType.Inserted, format)
}
console.log('Native source, CJS and ESM exports: four APIs, legacy helpers and rejection contract passed')
