import {Schema} from 'prosemirror-model'
import {compareDocumentBlocks} from '../../src/blocks.js'
import {reviewAnnotations} from './annotation-policy.mjs'

// This example owns a comment schema; the existing snapshot reader stays strict.
const schema = new Schema({nodes: {doc: {content: 'paragraph*'}, paragraph: {content: 'text*'}, text: {}},
  marks: {comment: {attrs: {id: {}}}, strong: {}}})
const before = schema.node('doc', null, schema.node('paragraph', null, schema.text('Review this')))
const after = schema.node('doc', null, schema.node('paragraph', null,
  schema.text('Review this', [schema.mark('comment', {id: 'thread-1'})])))
const raw = compareDocumentBlocks(before, after)
console.log(JSON.stringify({equal: before.eq(after), raw,
  review: reviewAnnotations(before, after, ['comment'])}, null, 2))
