// Usage: node test/run-table-integration.mjs /absolute/path/to/npm-cli.js
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {cpSync, mkdirSync, writeFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const npm = process.argv[2] || process.env.npm_execpath
assert.ok(npm, 'Pass the path to npm-cli.js, or run through npm')
const run = (args, cwd = root) => execFileSync(process.execPath, args, {cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit']})
run(['node_modules/rollup/dist/bin/rollup', '-c', 'rollup.config.mjs'])
const cell = resolve(root, 'logs/tables-integration')
mkdirSync(resolve(cell, 'test'), {recursive: true})
for (const file of ['package.json', 'package-lock.json']) cpSync(resolve(root, 'test/tables-runtime', file), resolve(cell, file))
// Never install the project itself into this runtime: copy the exact artifacts.
run([resolve(npm), 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], cell)
for (const folder of ['src', 'lib']) cpSync(resolve(root, folder), resolve(cell, folder), {recursive: true})
for (const file of ['table-contracts.mjs', 'table-integration.mjs']) cpSync(resolve(root, 'test', file), resolve(cell, 'test', file))
const raw = run(['test/table-integration.mjs'], cell)
writeFileSync(resolve(cell, 'result.json'), raw)
const result = JSON.parse(raw)
console.log(JSON.stringify({environment: result.environment, formats: result.results.map(({format, semantics}) => ({format,
  validCases: semantics.cases.filter(c => c.comparison === 'pass').length,
  invalidGridCases: semantics.cases.filter(c => c.comparison === 'skipped-invalid-grid').length,
  layers: semantics.layers, nested: semantics.nested}))}, null, 2))
