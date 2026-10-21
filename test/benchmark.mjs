// Run with: node test/benchmark.mjs (informational, no timing assertions).
import {performance} from 'node:perf_hooks'
import {cpus} from 'node:os'
import {Schema} from 'prosemirror-model'
import {diffWordsWithDetail, diffEditor} from '../src/diff.js'

const schema = new Schema({
  nodes: {doc: {content: 'paragraph+'}, paragraph: {content: 'inline*'},
    text: {group: 'inline'}, hard_break: {group: 'inline', inline: true}},
  marks: {diffMark: {attrs: {type: {default: 0}, level: {default: 'char'}}}}
})
const doc = content => ({type: 'doc', content: [{type: 'paragraph', content}]})
const text = text => ({type: 'text', text})
const cases = {
  'unchanged-2k': () => diffWordsWithDetail('hello world '.repeat(170), 'hello world '.repeat(170)),
  'unicode-edit': () => diffWordsWithDetail('你好 👩🏽‍💻 café '.repeat(30), '你好 👨🏽‍💻 café '.repeat(30)),
  'unrelated-1k': () => diffWordsWithDetail('a'.repeat(1000), 'b'.repeat(1000)),
  'text-to-leaf': () => diffEditor(schema, doc([text('hello')]), doc([{type: 'hard_break'}])),
  'leaf-to-text': () => diffEditor(schema, doc([{type: 'hard_break'}]), doc([text('hello')]))
}
const results = {}
for (const [name, run] of Object.entries(cases)) {
  try {
    for (let i = 0; i < 5; i++) run()
    const samples = []
    for (let i = 0; i < 25; i++) {
      const start = performance.now()
      run()
      samples.push(performance.now() - start)
    }
    samples.sort((a, b) => a - b)
    results[name] = {medianMs: samples[12], p95Ms: samples[23], samples: 25}
  } catch (error) {
    results[name] = {error: error.message}
  }
}
console.log(JSON.stringify({node: process.version, platform: process.platform, arch: process.arch,
  cpu: cpus()[0]?.model, warmups: 5, results}, null, 2))
