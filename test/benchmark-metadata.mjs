// node test/benchmark-metadata.mjs — informational, no timing assertions.
import {performance} from 'node:perf_hooks'
import {Schema} from 'prosemirror-model'
import {compareDocumentMetadata} from '../src/metadata.js'

const schema = new Schema({
  nodes: {doc: {content: 'paragraph+'}, paragraph: {content: 'text*', attrs: {align: {default: 'left'}}}, text: {}},
  marks: {strong: {}}
})
const results = []
for (const blocks of [10, 100, 1000]) {
  const make = changed => schema.node('doc', null, Array.from({length: blocks}, (_, i) =>
    schema.node('paragraph', {align: changed && i % 10 === 0 ? 'right' : 'left'},
      schema.text('paragraph ' + i + ' 😀', changed ? [schema.mark('strong')] : []))))
  const oldDoc = make(false), newDoc = make(true)
  for (let i = 0; i < 3; i++) compareDocumentMetadata(oldDoc, newDoc)
  const samples = []
  let events = 0
  for (let i = 0; i < 15; i++) {
    const start = performance.now()
    events = compareDocumentMetadata(oldDoc, newDoc).length
    samples.push(performance.now() - start)
  }
  samples.sort((a, b) => a - b)
  results.push({blocks, events, medianMs: samples[7], p95Ms: samples[14]})
}
console.log(JSON.stringify({node: process.version, warmups: 3, samples: 15, results}, null, 2))
