// Run after the library build: node test/smoke-metadata-exports.mjs
// Kept outside unit-test discovery so tests never depend on generated bundles.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {Schema} from 'prosemirror-model'
const require = createRequire(import.meta.url)
const cjs = require('../lib/index.cjs.js')
const esm = await import('../lib/index.esm.js')
const schema = new Schema({nodes: {
  doc: {content: 'paragraph+'}, paragraph: {content: 'text*'}, text: {}
}, marks: {strong: {}}})
const old = schema.node('paragraph', null, schema.text('same'))
const next = schema.node('paragraph', null, schema.text('same', [schema.mark('strong')]))
const expected = [{kind: 'marks', nodeType: 'text', oldFrom: 5, oldTo: 9,
  newFrom: 10, newTo: 14, before: [], after: [{type: 'strong'}]}]
for (const [format, api] of [['CJS', cjs], ['ESM', esm]]) {
  assert.equal(typeof api.compareDocumentMetadata, 'function', format)
  assert.equal(typeof api.compareNodeMetadata, 'function', format)
  assert.deepEqual(api.compareNodeMetadata(old, next, {oldFrom: 4, newFrom: 9}), expected, format)
  assert.deepEqual(api.compareDocumentMetadata(schema.node('doc', null, old), schema.node('doc', null, next)),
    [{...expected[0], oldFrom: 1, oldTo: 5, newFrom: 1, newTo: 5}], format)
  assert.throws(() => api.compareNodeMetadata(schema.text('a'), schema.text('b')), /Direct text/, format)
}
console.log('CJS and ESM metadata exports: exact results and rejection contract passed')
