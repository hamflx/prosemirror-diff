// Diagnostic reproduction, not a test asserting invalid output is desirable.
// Build first, then run: node test/repro-legacy-mark-validation.mjs
import {createRequire} from 'node:module'
const require = createRequire(import.meta.url)
// Match the CJS bundle's model module instance when constructing nodes/schema.
const {Schema} = require('prosemirror-model')
const {diffEditor} = require('../lib/index.cjs.js')
const schema = new Schema({nodes: {
  doc: {content: 'block+'}, paragraph: {group: 'block', content: 'text*'},
  code_block: {group: 'block', content: 'text*', marks: ''}, text: {}
}, marks: {code: {excludes: '_'}, diffMark: {attrs: {type: {default: 0}}}}})
for (const [name, type, before, after, marks] of [
  ['exclusive code mark', 'paragraph', 'cat', 'cart', [schema.mark('code')]],
  ['mark-disallowing code block', 'code_block', 'a', 'b', []]
]) {
  const doc = text => schema.node('doc', null, schema.node(type, null, schema.text(text, marks)))
  const old = doc(before), next = doc(after)
  old.check(); next.check()
  for (const level of ['char', 'word', 'grapheme']) {
    try {
      const result = diffEditor(schema, old.toJSON(), next.toJSON(), {level})
      let valid = true, validationError = null
      try { result.check() } catch (error) { valid = false; validationError = error.message }
      console.log(JSON.stringify({name, level, inputsValid: true, outputValid: valid, validationError}))
    } catch (error) {
      console.log(JSON.stringify({name, level, inputsValid: true, rendererError: error.message}))
    }
  }
}
