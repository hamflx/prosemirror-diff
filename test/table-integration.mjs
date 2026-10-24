import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import * as esmModel from 'prosemirror-model'
import * as esmTables from 'prosemirror-tables'
import * as esmState from 'prosemirror-state'
import {runTableContracts} from './table-contracts.mjs'
const require = createRequire(import.meta.url)
const cjsModel = require('prosemirror-model'), cjsTables = require('prosemirror-tables'), cjsState = require('prosemirror-state')
const version = name => JSON.parse(readFileSync(new URL('../node_modules/' + name + '/package.json', import.meta.url), 'utf8')).version
assert.equal(version('prosemirror-model'), '1.25.12')
assert.equal(version('prosemirror-tables'), '1.8.5')
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'))
assert.deepEqual(Object.keys(lock.packages).filter(path => path.endsWith('node_modules/prosemirror-model')), ['node_modules/prosemirror-model'])
// Verify both dependency entry paths resolve the SAME model entry in each module
// system; importing another installation can make instanceof/schema checks lie.
const tableRequire = createRequire(require.resolve('prosemirror-tables'))
assert.equal(tableRequire.resolve('prosemirror-model'), require.resolve('prosemirror-model'))
assert.equal(tableRequire.resolve('prosemirror-state'), require.resolve('prosemirror-state'))
const output = []
for (const [format, api, model, tables, state] of [
  ['source', await import('../src/index.js'), esmModel, esmTables, esmState],
  ['cjs', require('../lib/index.cjs.js'), cjsModel, cjsTables, cjsState],
  ['esm', await import('../lib/index.esm.js'), esmModel, esmTables, esmState]
]) {
  const semantics = runTableContracts(api, model, tables, state)
  if (output.length) assert.deepEqual(semantics, output[0].semantics, 'Different table contract result for ' + format)
  output.push({format, semantics})
}
console.log(JSON.stringify({environment: {node: process.version, model: version('prosemirror-model'), tables: version('prosemirror-tables'), state: version('prosemirror-state'),
  sourceModel: 'ESM Schema/Node with ESM tableNodes/TableMap/CellSelection/EditorState', cjsModel: 'CJS Schema/Node with CJS tableNodes/TableMap/CellSelection/EditorState',
  bundleModel: 'ESM Schema/Node with ESM tableNodes/TableMap/CellSelection/EditorState'}, results: output}, null, 2))
