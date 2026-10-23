import {performance} from 'node:perf_hooks'
import {Schema} from 'prosemirror-model'
import {compareDocumentBlocks} from '../src/blocks.js'

const schema = new Schema({nodes: {doc: {content: 'paragraph*'}, paragraph: {content: 'text*'}, text: {}}})
const p = text => schema.node('paragraph', null, schema.text(text))
for (const count of [10, 100, 1000]) {
  const old = schema.node('doc', null, Array.from({length: count}, (_, i) => p(`paragraph ${i}`)))
  const next = schema.node('doc', null, Array.from({length: count}, (_, i) => p(i % 10 ? `paragraph ${i}` : `updated ${i}`)))
  for (const maxCells of [100000, 0]) {
    for (let i = 0; i < 3; i++) compareDocumentBlocks(old, next, {maxCells})
    const samples = []
    let result
    for (let i = 0; i < 15; i++) {
      const start = performance.now()
      result = compareDocumentBlocks(old, next, {maxCells})
      samples.push(performance.now() - start)
    }
    samples.sort((a, b) => a - b)
    console.log(JSON.stringify({count, maxCells, events: result.changes.length, fallback: result.fallback,
      medianMs: +samples[7].toFixed(3), p95Ms: +samples[14].toFixed(3)}))
  }
}
