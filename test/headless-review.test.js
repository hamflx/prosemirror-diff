import {afterAll, expect, it} from 'vitest'
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve, dirname, basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {readSnapshot, schema} from '../example/headless/schema.mjs'
import {reviewSnapshots, refineSelected} from '../example/headless/review.mjs'
const root = fileURLToPath(new URL('../', import.meta.url))
const cli = join(root, 'example/headless/cli.mjs')
const oldFile = join(root, 'example/headless/old.json'), newFile = join(root, 'example/headless/new.json')
const oldJSON = JSON.parse(readFileSync(oldFile, 'utf8')), newJSON = JSON.parse(readFileSync(newFile, 'utf8'))
const doc = content => ({type:'doc',content})
const t = (text, marks) => ({type:'text',text,...(marks ? {marks} : {})})
const p = (...content) => ({type:'paragraph',content})
const strong = [{type:'strong'}]
const temp = mkdtempSync(join(tmpdir(), 'pm-headless-'))
afterAll(() => {
  const target = resolve(temp)
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('pm-headless-')) {
    throw new Error('Refusing cleanup outside the expected test temporary directory')
  }
  rmSync(target, {recursive:true, force:true})
})
const run = args => spawnSync(process.execPath, [cli, ...args], {cwd:root, encoding:'utf8'})

it('executes the real CLI on saved files and emits a full JSON tree with selected nested metadata', () => {
  const runResult = run([oldFile, newFile, '0.0.0'])
  expect(runResult.status, runResult.stderr).toBe(0)
  const result = JSON.parse(runResult.stdout)
  expect(result.equal).toBe(false)
  expect(result.selected.coverage).toBe('metadata')
  expect(result.selected.path).toEqual([0,0,0])
  expect(result.selected.records[0]).toMatchObject({nodeType:'text',kind:'marks',oldFrom:8,oldTo:10,newFrom:8,newTo:10})
  expect(result.blocks.changes[0].before[0].type).toBe('bullet_list')
  expect(result.blocks.changes[0].details.changes[0].before[0].type).toBe('list_item')
  expect(result.blocks.changes[0].details.truncated).toBe(false)
  expect(result.blocks.changes[1].before[0].type).toBe('image')
  const image = reviewSnapshots(oldJSON,newJSON,'1')
  expect(image.selected.records[0].before.src).toBe('cover-v1.png')
  expect(image.selected.records[0].after.src).toBe('cover-v2.png')
})
it('uses whole-document equality and preserves canonical model values through JSON round trips', () => {
  const result = reviewSnapshots(oldJSON,oldJSON)
  expect(result.equal).toBe(true)
  expect(result.blocks).toEqual({changes:[],fallback:false})
  expect(result.selected.coverage).toBe('not-selected')
  const roundtrip = JSON.parse(JSON.stringify(result))
  expect(readSnapshot(roundtrip.snapshots.before).eq(readSnapshot(oldJSON))).toBe(true)
  expect(reviewSnapshots(roundtrip.snapshots.before,roundtrip.snapshots.after).equal).toBe(true)
  expect(oldJSON.content[0].content[0].content[0].content[0].text).toBe('Read e\u0301 notes')
})
it('retains distinct offsets with Unicode metadata, despite unrelated leading text changes', () => {
  const a=doc([p(t('Anchor')),p(t('e\u0301🇨🇦'))])
  const b=doc([p(t('Inserted')),p(t('Anchor')),p(t('e\u0301🇨🇦',strong))])
  const result=reviewSnapshots(a,b,'1')
  expect(result.selected.coverage).toBe('metadata')
  const record=result.selected.records[0]
  expect([record.oldFrom,record.oldTo,record.newFrom,record.newTo]).toEqual([9,15,19,25])
  expect(result.equal).toBe(false)
})
it('provides text-only partial coverage for mixed text/marks with unchanged input snapshots', () => {
  const a=doc([p(t('A e\u0301 👨‍👩‍👧‍👦'))]),b=doc([p(t('A é 👩‍👩‍👧‍👦',strong))])
  const before=JSON.stringify([a,b]), result=reviewSnapshots(a,b,'0')
  expect(result.selected.coverage).toBe('text-only-partial')
  expect(result.selected.reason).toContain('Formatting is not independently compared')
  expect(result.selected.oldText).toBe('A e\u0301 👨‍👩‍👧‍👦')
  expect(result.selected.newText).toBe('A é 👩‍👩‍👧‍👦')
  expect(result.selected.hunks.length).toBeGreaterThan(0)
  expect(result.selected.precision).toContain('does not expose fallback')
  expect(JSON.stringify([a,b])).toBe(before)
})
it('does not ignore inline atom insertion when textContent is equal', () => {
  const a=doc([p(t('same'))]), b=doc([p(t('same'),{type:'inline_token',attrs:{label:'added'}})])
  expect(readSnapshot(a).textContent).toBe(readSnapshot(b).textContent)
  const result=reviewSnapshots(a,b,'0')
  expect(result.selected.coverage).toBe('block-only')
  expect(result.selected.reason).toContain('inline atoms')
  expect(result.blocks.changes).toHaveLength(1)
})
it('preserves strict container originals and rejects incompatible child types without constructing a mixed document', () => {
  const a=doc([{type:'container',content:[p(t('same'))]}])
  const b=doc([{type:'container',content:[{type:'heading',content:[t('same')]}]}])
  const result=reviewSnapshots(a,b,'0.0')
  expect(result.selected.coverage).toBe('block-only')
  expect(result.blocks.changes[0].before[0].content).toHaveLength(1)
  expect(result.blocks.changes[0].after[0].content).toHaveLength(1)
  expect(() => readSnapshot(result.snapshots.before).check()).not.toThrow()
  expect(() => readSnapshot(doc([{type:'container',content:[]}]))).toThrow()
})
it('retains coarse root and depth-truncation flags instead of treating empty details as equality', () => {
  const coarse=reviewSnapshots(oldJSON,newJSON,'0',{maxCells:0,maxDepth:2})
  expect(coarse.blocks.fallback).toBe(true)
  expect(coarse.selected.coverage).toBe('block-only')
  expect(coarse.blocks.changes[0].before).toHaveLength(3)
  const wrap=node=>({type:'container',content:[node]})
  const a=doc([wrap(wrap(p(t('old'))))]), b=doc([wrap(wrap(p(t('new'))))])
  const shallow=reviewSnapshots(a,b,'0.0',{maxCells:100000,maxDepth:1})
  expect(shallow.equal).toBe(false)
  expect(shallow.blocks.changes[0].details.changes[0].details).toEqual({changes:[],fallback:false,truncated:true})
  expect(() => reviewSnapshots(a,b,'0.0.0',{maxCells:100000,maxDepth:1})).toThrow(/depth-limited/)
})
it('does not turn selected validation failures into partial text results', () => {
  const node=schema.node('paragraph',null,schema.text('same'))
  expect(refineSelected({kind:'replace',before:[node],after:[node],oldFrom:-1,newFrom:0}).coverage).toBe('unavailable')
})
it.each([
  ['invalid-json','{'],
  ['array-node-type',JSON.stringify(doc([{type:['paragraph']}]))],
  ['array-mark-type',JSON.stringify(doc([p(t('x',[{type:['strong']}]))]))],
  ['unknown-node',JSON.stringify(doc([{type:'mystery'}]))],
  ['unknown-mark',JSON.stringify(doc([p(t('x',[{type:'mystery'}]))]))],
  ['unknown-attrs',JSON.stringify(doc([{type:'paragraph',attrs:{secret:1},content:[t('x')]}]))],
  ['invalid-attrs',JSON.stringify(doc([{type:'image',attrs:{src:123}}]))],
  ['strict-invalid',JSON.stringify(doc([{type:'container',content:[]}]))]
])('CLI rejects %s with stderr/nonzero and no partial stdout', (name,content) => {
  const file=join(temp,name+'.json');writeFileSync(file,content)
  const result=run([file,newFile])
  expect(result.status).not.toBe(0)
  expect(result.stdout).toBe('')
  expect(result.stderr).toContain('Snapshot review failed:')
})
it.each(['-1','0..0','99','0.99','01'])('CLI rejects invalid/missing event path %s atomically', path => {
  const result=run([oldFile,newFile,path])
  expect(result.status).not.toBe(0)
  expect(result.stdout).toBe('')
  expect(result.stderr).toContain('Snapshot review failed:')
})
it('uses independent UTF-16 text offsets without normalizing combining characters', () => {
  const a=doc([p(t('Anchor')),p(t('e\u0301'))])
  const b=doc([p(t('Inserted')),p(t('Anchor')),p(t('é',strong))])
  const result=reviewSnapshots(a,b,'1')
  expect(result.selected.coverage).toBe('text-only-partial')
  expect(result.selected.hunks).toEqual([{kind:'replace',oldFrom:9,oldTo:11,newFrom:19,newTo:20}])
  const empty=reviewSnapshots(doc([p()]),doc([p(t('🇨🇦'))]),'0')
  expect(empty.selected.hunks).toEqual([{kind:'insert',oldFrom:1,oldTo:1,newFrom:1,newTo:5}])
})
