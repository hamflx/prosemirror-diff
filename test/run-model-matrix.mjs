// npm CLI is explicit so Windows runs Node directly without shell quoting.
// Usage: node test/run-model-matrix.mjs /absolute/path/to/npm-cli.js
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {cpSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const npm = process.argv[2] || process.env.npm_execpath
assert.ok(npm, 'Pass the path to npm-cli.js, or run through npm')
const versions = ['1.18.1', '1.19.1', '1.22.0', '1.25.12']
const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'))
const dependencies = Object.fromEntries(['diff', 'diff-match-patch', 'unicode-segmenter'].map(name =>
  [name, lock.packages['node_modules/' + name].version]))
const run = (args, cwd = root) => execFileSync(process.execPath, args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']})
// PM is external in all bundles; the same artifact must work with each model.
run(['node_modules/rollup/dist/bin/rollup', '-c', 'rollup.config.mjs'])
let baseline
const summary = []
for (const version of versions) {
  const cell = resolve(root, 'logs/model-matrix', version)
  mkdirSync(resolve(cell, 'test'), {recursive: true})
  writeFileSync(resolve(cell, 'package.json'), JSON.stringify({private: true, dependencies: {...dependencies, 'prosemirror-model': version}}, null, 2) + '\n')
  run([resolve(npm), 'install', '--ignore-scripts', '--no-audit', '--no-fund'], cell)
  for (const path of ['src', 'lib']) cpSync(resolve(root, path), resolve(cell, path), {recursive: true})
  cpSync(resolve(root, 'test/model-compatibility.mjs'), resolve(cell, 'test/model-compatibility.mjs'))
  const raw = run(['test/model-compatibility.mjs'], cell)
  writeFileSync(resolve(cell, 'result.json'), raw)
  const result = JSON.parse(raw)
  assert.equal(result.environment.modelVersion, version)
  if (baseline) assert.deepEqual(result.semantics, baseline, 'Semantic mismatch for PM ' + version)
  else baseline = result.semantics
  summary.push({environment: result.environment, capabilities: result.capabilities})
}
writeFileSync(resolve(root, 'logs/model-matrix/summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
