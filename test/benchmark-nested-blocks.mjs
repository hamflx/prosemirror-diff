import {performance} from 'node:perf_hooks'
import {Schema} from 'prosemirror-model'
import {compareDocumentBlocks} from '../src/blocks.js'

const schema = new Schema({nodes: {
  doc: {content: 'block*'}, quote: {content: 'block*', group: 'block'},
  paragraph: {content: 'text*', group: 'block'}, text: {}
}})
const p = text => schema.node('paragraph', null, schema.text(text))
const q = children => schema.node('quote', null, children)
function describe(result) {
  let events = 0, fallbacks = 0, truncations = 0
  const visit = layer => {
    if (layer.fallback) fallbacks++
    if (layer.truncated) truncations++
    events += layer.changes.length
    for (const change of layer.changes) if (change.details) visit(change.details)
  }
  visit(result)
  return {events, fallbacks, truncations}
}
for (const count of [10, 100, 1000]) {
  const old = schema.node('doc', null, q(q(Array.from({length: count}, (_, i) => p(`paragraph ${i}`)))))
  const next = schema.node('doc', null, q(q(Array.from({length: count}, (_, i) => p(i % 10 ? `paragraph ${i}` : `updated ${i}`)))))
  for (const [maxDepth, maxCells] of [[0, 100000], [1, 100000], [2, 100000], [2, 8]]) {
    const options = {maxDepth, maxCells}
    for (let i = 0; i < 3; i++) compareDocumentBlocks(old, next, options)
    const samples = []
    let result
    for (let i = 0; i < 15; i++) {
      const start = performance.now()
      result = compareDocumentBlocks(old, next, options)
      samples.push(performance.now() - start)
    }
    samples.sort((a, b) => a - b)
    console.log(JSON.stringify({count, ...options, ...describe(result),
      medianMs: +samples[7].toFixed(3), p95Ms: +samples[14].toFixed(3)}))
  }
}
