import {performance} from 'node:perf_hooks'
import {Schema} from 'prosemirror-model'
import {reviewTextChange} from '../example/src/text-review.js'

const schema = new Schema({nodes: {
  doc: {content: 'paragraph*'}, paragraph: {content: 'text*'}, text: {}
}})
const paragraph = text => schema.node('paragraph', null, schema.text(text))
// String repetition and node construction are outside the measured helper calls.
const cases = [
  ['short Unicode', 'A 👨‍👩‍👧‍👦 e\u0301 Z', 'A 👩‍👩‍👧‍👦 é Z'],
  ['10k per side, one edit', 'a'.repeat(4999) + 'x' + 'b'.repeat(5000), 'a'.repeat(4999) + 'y' + 'b'.repeat(5000)],
  ['high edit distance', 'start ' + '👩‍💻'.repeat(1001) + ' end', 'start ' + '🇨🇦'.repeat(1001) + ' end']
].map(([name, oldText, newText]) => ({name, oldLength: oldText.length, newLength: newText.length,
  change: {kind: 'replace', before: [paragraph(oldText)], after: [paragraph(newText)], oldFrom: 0, newFrom: 0}}))

const results = cases.map(({name, oldLength, newLength, change}) => {
  reviewTextChange(change)
  const samples = []
  let hunks
  for (let i = 0; i < 7; i++) {
    const start = performance.now()
    const result = reviewTextChange(change)
    samples.push(performance.now() - start)
    if (!result.supported) throw new Error(result.reason)
    hunks = result.hunks.length
  }
  samples.sort((a, b) => a - b)
  return {name, oldLength, newLength, hunks, medianMs: samples[3], minMs: samples[0], maxMs: samples[6]}
})
console.log(JSON.stringify({runtime: process.version, samples: 7, warmups: 1, results}, null, 2))
