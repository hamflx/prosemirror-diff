// Run after building this cell's bundles: node test/model-compatibility.mjs
// Each matrix cell must contain its own src/, lib/ and node_modules/.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync, realpathSync, existsSync} from 'node:fs'
import {dirname, resolve, relative, sep, isAbsolute} from 'node:path'
import {fileURLToPath} from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const modelEntry = realpathSync(require.resolve('prosemirror-model'))
const localModules = realpathSync(resolve(root, 'node_modules'))
const modelRelative = relative(localModules, modelEntry)
assert.ok(!isAbsolute(modelRelative) && !modelRelative.startsWith('..' + sep) && modelRelative !== '..', 'Model must resolve inside this cell node_modules')
const esmModelRelative = relative(localModules, realpathSync(fileURLToPath(import.meta.resolve('prosemirror-model'))))
assert.ok(!isAbsolute(esmModelRelative) && !esmModelRelative.startsWith('..' + sep) && esmModelRelative !== '..', 'ESM model must resolve inside this cell node_modules')
let modelDirectory = dirname(modelEntry)
while (!existsSync(resolve(modelDirectory, 'package.json'))) {
  assert.notEqual(dirname(modelDirectory), modelDirectory, 'Missing local model package metadata')
  modelDirectory = dirname(modelDirectory)
}
const modelVersion = JSON.parse(readFileSync(resolve(modelDirectory, 'package.json'), 'utf8')).version
const args = process.argv.slice(2)
assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--format'), 'Usage: node test/model-compatibility.mjs [--format all|source|cjs|esm]')
const requested = args[1] ?? 'all'
assert.ok(['all', 'source', 'cjs', 'esm'].includes(requested), 'Unknown format')
const formats = requested === 'all' ? ['source', 'cjs', 'esm'] : [requested]
const json = value => JSON.parse(JSON.stringify(value))
const rejected = fn => { let error; try { fn() } catch (caught) { error = caught } assert.ok(error instanceof RangeError); return error }

function verify(api, Schema) {
  const s = new Schema({nodes: {
    doc: {content: 'block*'}, paragraph: {group: 'block', content: 'text*', attrs: {align: {default: 'left'}}},
    heading: {group: 'block', content: 'text*'}, section: {group: 'block', content: 'block*'},
    container: {group: 'block', content: 'block'}, image: {group: 'block', atom: true, attrs: {src: {}}}, text: {}
  }, marks: {strong: {}, link: {attrs: {href: {}}}, code: {excludes: '_'}, diffMark: {attrs: {type: {default: 0}, level: {default: 'char'}}}}})
  const text = (value, marks = []) => value ? s.text(value, marks) : undefined
  const p = (value, marks = [], align = 'left') => s.node('paragraph', {align}, text(value, marks))
  const doc = content => s.node('doc', null, content)
  const section = content => s.node('section', null, content)
  const preserved = (old, next, fn) => {
    old.check(); next.check()
    const original = json([old.toJSON(), next.toJSON()])
    const result = fn()
    assert.deepEqual(json([old.toJSON(), next.toJSON()]), original)
    old.check(); next.check()
    return result
  }
  const validate = (old, next, result) => {
    const visit = (changes, parent) => changes.forEach(change => {
      for (const [side, source, nodes] of [['old', old, change.before], ['new', next, change.after]]) {
        const from = change[side + 'From'], to = change[side + 'To']
        assert.ok(Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to >= from && to <= source.content.size)
        if (parent) assert.ok(from >= parent[side + 'From'] && to <= parent[side + 'To'])
        assert.equal(nodes.reduce((size, node) => size + node.nodeSize, 0), to - from)
        let offset = from
        for (const node of nodes) { assert.ok(source.nodeAt(offset).eq(node)); offset += node.nodeSize }
      }
      if (change.details) visit(change.details.changes, change)
    })
    visit(result.changes)
    const rebuilt = []; let cursor = 0
    for (const change of result.changes) {
      old.content.cut(cursor, change.oldFrom).forEach(node => rebuilt.push(node))
      rebuilt.push(...change.after); cursor = change.oldTo
    }
    old.content.cut(cursor).forEach(node => rebuilt.push(node))
    assert.ok(doc(rebuilt).eq(next), 'Root events must reconstruct the new document')
  }
  const compare = (old, next, options) => preserved(old, next, () => {
    const result = api.compareDocumentBlocks(old, next, options)
    validate(old, next, result)
    return json(result)
  })
  const old = doc([p('same', [s.mark('link', {href: 'old'})]), s.node('image', {src: 'old.png'})])
  const next = doc([p('same', [s.mark('strong'), s.mark('link', {href: 'new'})], 'right'), s.node('image', {src: 'new.png'})])
  const metadata = preserved(old, next, () => api.compareDocumentMetadata(old, next))
  assert.deepEqual(metadata.map(item => item.kind), ['attrs', 'marks', 'attrs'])
  assert.deepEqual(metadata.map(item => [item.oldFrom, item.oldTo, item.newFrom, item.newTo]), [[0, 6, 0, 6], [1, 5, 1, 5], [6, 7, 6, 7]])
  assert.equal(metadata[1].before[0].attrs.href, 'old')
  assert.equal(metadata[1].after[1].attrs.href, 'new')
  const nodeMetadata = preserved(old.firstChild, next.firstChild, () => api.compareNodeMetadata(old.firstChild, next.firstChild, {oldFrom: 10, newFrom: 20}))
  assert.deepEqual(nodeMetadata.map(item => [item.oldFrom, item.oldTo, item.newFrom, item.newTo]), [[10, 16, 20, 26], [11, 15, 21, 25]])
  rejected(() => api.compareNodeMetadata(p('a'), p('b')))
  const graphemes = [['👨‍👩‍👧‍👦', '👩‍👩‍👧‍👦'], ['e\u0301', '\u00e9'], ['', '🇨🇦']].map(([before, after]) => {
    const segments = api.diffGraphemes(before, after)
    assert.equal(segments.filter(x => x.type !== 1).map(x => x.text).join(''), before)
    assert.equal(segments.filter(x => x.type !== -1).map(x => x.text).join(''), after)
    assert.ok(segments.every(x => x.level === 'grapheme'))
    if (before) assert.equal(segments[0].text, before)
    return segments
  })
  const blocks = compare(doc([p('same'), p('old')]), doc([p('same'), p('new'), p('')]))
  const nestedOld = doc(section([p('same'), p('old'), p('anchor'), p('tail-old')]))
  const nestedNew = doc(section([p('same'), p('new'), p('anchor'), p('tail-new')]))
  const nested = compare(nestedOld, nestedNew, {maxDepth: 2})
  assert.ok(nested.changes[0].details.changes.length > 0)
  const budget = compare(doc([p('old'), p('anchor'), p('tail')]), doc([p('new'), p('anchor'), p('next')]), {maxCells: 0, maxDepth: 2})
  assert.equal(budget.fallback, true)
  const legacy = ['char', 'word', 'grapheme'].map(level => {
    const a = doc(p('cat', [s.mark('strong')])), b = doc(p('cart', [s.mark('strong')]))
    const result = preserved(a, b, () => api.diffEditor(s, a.toJSON(), b.toJSON(), {level}))
    result.check(); assert.equal(result.textContent, 'cart')
    const ca = doc(p('cat', [s.mark('code')])), cb = doc(p('cart', [s.mark('code')]))
    preserved(ca, cb, () => { const error = rejected(() => api.diffEditor(s, ca.toJSON(), cb.toJSON(), {level})); assert.match(error.message, /^Diff output cannot be represented/); assert.ok(error.cause instanceof RangeError) })
    return {level, output: result.toJSON(), exclusiveMarks: 'rejected'}
  })
  const strictOld = doc(s.node('container', null, s.node('heading', null, text('same'))))
  const strictNew = doc(s.node('container', null, p('same')))
  preserved(strictOld, strictNew, () => rejected(() => api.diffEditor(s, strictOld.toJSON(), strictNew.toJSON())))
  let seed = 0x5eed1234
  const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n }
  const words = ['', 'a', 'same', 'e\u0301', '🇨🇦']
  const seededCases = Array.from({length: 24}, (_, index) => {
    const children = Array.from({length: 2 + random(4)}, () => p(words[random(words.length)]))
    const changed = children.slice(), at = random(changed.length), mode = random(3)
    if (mode === 0) changed.splice(at, 0, p('insert'))
    else if (mode === 1) changed.splice(at, 1)
    else changed[at] = p('edit', [s.mark('strong')])
    const before = doc([section(children), p('end')]), after = doc([section(changed), p('end')])
    return {index, result: compare(before, after, {maxDepth: 2, maxCells: index % 3 === 0 ? 0 : 1000})}
  })
  // AttributeSpec.validate was introduced in PM 1.22. Its legitimate contract
  // difference belongs in capability observations, outside cross-version semantics.
  const attrsSchema = new Schema({nodes: {doc: {content: 'p'}, p: {attrs: {value: {default: 'valid', validate: value => { if (typeof value !== 'string') throw new RangeError('expected string') }}}}, text: {}}})
  let bad, creationRejects = false, checkRejects = null, apiRejects = null
  try { bad = attrsSchema.node('doc', null, attrsSchema.nodes.p.create({value: 42})) }
  catch (error) { assert.ok(error instanceof RangeError); creationRejects = true }
  // Newer model releases validate on creation. Null means these later stages
  // were not exercised, rather than reporting an invented check/API result.
  if (!creationRejects) {
    checkRejects = false
    try { bad.check() } catch (error) { assert.ok(error instanceof RangeError); checkRejects = true }
    apiRejects = false
    try { api.compareDocumentMetadata(bad, bad) } catch (error) { assert.ok(error instanceof RangeError); apiRejects = true }
    assert.equal(apiRejects, checkRejects, 'API must follow this model version Node.check contract')
  }
  return {semantics: json({exports: Object.keys(api).sort(), metadata, nodeMetadata, graphemes, blocks, nested, budget, legacy, strictContainer: 'rejected', seededCases}), capabilities: {attributeValidation: {creationRejects, nodeCheckRejects: checkRejects, metadataRejects: apiRejects}}}
}

const results = {}
for (const format of formats) {
  const api = format === 'cjs' ? require('../lib/index.cjs.js') : await import(format === 'source' ? '../src/index.js' : '../lib/index.esm.js')
  const {Schema} = format === 'cjs' ? require('prosemirror-model') : await import('prosemirror-model')
  results[format] = verify(api, Schema)
}
for (const format of formats.slice(1)) assert.deepEqual(results[format], results[formats[0]], 'Format contracts differ: ' + format)
console.log(JSON.stringify({environment: {node: process.version, modelVersion, formats, seed: '0x5eed1234', generatedCases: 24}, ...results[formats[0]]}, null, 2))
