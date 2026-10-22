// Informational comparison: node test/benchmark-grapheme.mjs
import {performance} from 'node:perf_hooks'
import {diff_match_patch} from 'diff-match-patch'
import {diffGraphemes, diffWordsWithDetail} from '../src/diff.js'

const cases = {
  'short-emoji': ['x👩🏽‍💻z', 'x👨🏽‍💻z'],
  'prose-2k': ['hello world '.repeat(170), 'hello world '.repeat(85) + 'new ' + 'hello world '.repeat(85)],
  'unicode-30': ['你好 👩🏽‍💻 café '.repeat(30), '你好 👨🏽‍💻 café '.repeat(30)],
  'unrelated-1001': ['👩‍💻'.repeat(1001), '🇨🇦'.repeat(1001)]
}
const legacy = new diff_match_patch()
const modes = {char: (a, b) => legacy.diff_main(a, b), word: diffWordsWithDetail, grapheme: diffGraphemes}
const results = {}
for (const [name, [a, b]] of Object.entries(cases)) {
  results[name] = {}
  for (const [mode, run] of Object.entries(modes)) {
    for (let i = 0; i < 3; i++) run(a, b)
    const samples = []
    for (let i = 0; i < 15; i++) {
      const start = performance.now()
      run(a, b)
      samples.push(performance.now() - start)
    }
    samples.sort((a, b) => a - b)
    results[name][mode] = {medianMs: samples[7], p95Ms: samples[14]}
  }
}
console.log(JSON.stringify({node: process.version, warmups: 3, samples: 15, results}, null, 2))
