// Native declaration inventory check; no generated build is needed.
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import * as runtime from '../src/index.js'
const declaration = await readFile(new URL('../index.d.ts', import.meta.url), 'utf8')
const declared = [...declaration.matchAll(/export declare (?:function|const) (\w+)/g)]
  .map(match => match[1])
assert.deepEqual([...new Set(declared)].sort(), Object.keys(runtime).sort())
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
assert.equal(pkg.types, 'index.d.ts')
assert.ok(pkg.files.includes('index.d.ts'))
console.log('Every public runtime export has a packaged declaration')
