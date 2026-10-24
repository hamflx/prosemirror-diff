import {afterAll, expect, it} from 'vitest'
import {readFileSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve, dirname, basename, join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {eventDirectory, directoryLimits} from '../example/headless/event-directory.mjs'
import {reviewSnapshots} from '../example/headless/review.mjs'
const before = JSON.parse(readFileSync('example/headless/old.json','utf8'))
const after = JSON.parse(readFileSync('example/headless/new.json','utf8'))
const report = () => reviewSnapshots(before, after)
const temp = mkdtempSync(join(tmpdir(), 'pm-directory-'))
afterAll(() => {
  const target = resolve(temp)
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('pm-directory-')) throw new Error('Unsafe cleanup target')
  rmSync(target,{recursive:true,force:true})
})
const run = (value, raw = false) => {
  const path = join(temp,'report.json')
  writeFileSync(path,raw ? value : JSON.stringify(value))
  return spawnSync(process.execPath,['example/headless/list-events.mjs',path],{encoding:'utf8'})
}
it('lists all four retained paths and feeds every path back to the original CLI', () => {
  const saved = report(), original = JSON.stringify(saved)
  const result = run(saved)
  expect(result.status,result.stderr).toBe(0)
  const directory = JSON.parse(result.stdout)
  expect(directory.entries.map(entry => entry.path)).toEqual(['0','0.0','0.0.0','1'])
  for (const entry of directory.entries) {
    const selected = spawnSync(process.execPath,['example/headless/cli.mjs','example/headless/old.json','example/headless/new.json',entry.path],{encoding:'utf8'})
    expect(selected.status,selected.stderr).toBe(0)
    const output = JSON.parse(selected.stdout)
    let layer = output.blocks, event
    for (const index of output.selected.path) {event = layer.changes[index]; layer = event.details}
    expect([entry.old.from,entry.old.to,entry.new.from,entry.new.to]).toEqual([event.oldFrom,event.oldTo,event.newFrom,event.newTo])
  }
  expect(JSON.stringify(saved)).toBe(original)
  expect(eventDirectory(JSON.parse(original))).toEqual(directory)
})
it('preserves root fallback, truncated parents, and local fallback without claiming equality', () => {
  const coarse = eventDirectory(reviewSnapshots(before,after,undefined,{maxDepth:2,maxCells:0}))
  expect(coarse.rootFallback).toBe(true)
  expect(coarse.entries.every(entry=>entry.layerFallback)).toBe(true)
  const shallow = eventDirectory(reviewSnapshots(before,after,undefined,{maxDepth:1,maxCells:100000}))
  expect(shallow.entries.find(entry=>entry.path==='0.0').details).toEqual({present:true,childCount:0,truncated:true,fallback:false})
  expect(shallow.entries.some(entry=>entry.path==='0.0.0')).toBe(false)
  const local = eventDirectory(reviewSnapshots(before,after,undefined,{maxDepth:2,maxCells:16}))
  expect(local.rootFallback).toBe(false)
  expect(local.entries.find(entry=>entry.path==='0').details.fallback).toBe(true)
  expect(local.entries.find(entry=>entry.path==='0.0').layerFallback).toBe(true)
  const equal = eventDirectory(reviewSnapshots(before,before))
  expect(equal.equal).toBe(true); expect(equal.entries).toEqual([])
})
it('retains empty insert/delete ranges and independent Unicode positions', () => {
  const a = JSON.parse(readFileSync('example/headless/formatting-old.json','utf8'))
  const b = JSON.parse(readFileSync('example/headless/formatting-new.json','utf8'))
  const forward = eventDirectory(reviewSnapshots(a,b)).entries
  const reverse = eventDirectory(reviewSnapshots(b,a)).entries
  expect(forward[0]).toMatchObject({kind:'insert',old:{from:0,to:0,count:0}})
  expect(reverse[0]).toMatchObject({kind:'delete',new:{from:0,to:0,count:0}})
  expect(forward[1].old.from).toBe(8); expect(forward[1].new.from).toBe(18)
})
it.each([
  value=>{value.format='unknown'}, value=>{value.equal='false'},
  value=>{value.blocks.changes[0].oldTo=-1}, value=>{value.blocks.changes[0].oldFrom=1.5},
  value=>{value.blocks.changes[0].before[0].type=[]},
  value=>{value.blocks.changes[0].details.truncated=true},
  value=>{value.blocks.changes[0].details.changes[0].oldFrom=0},
  value=>{value.blocks.changes[0].details=null},
  value=>{value.blocks.changes[0].kind='insert'},
  value=>{value.blocks.changes[1].oldFrom=0}
])('rejects malformed fields atomically', mutate => {
  const saved = report(); mutate(saved)
  expect(()=>eventDirectory(saved)).toThrow()
  const result=run(saved); expect(result.status).not.toBe(0);expect(result.stdout).toBe('');expect(result.stderr).toContain('Event directory failed:')
})
it('rejects invalid UTF8, malformed JSON, oversized files and missing arguments; accepts UTF8 BOM', () => {
  for (const bytes of [Buffer.from([0xff]),Buffer.from('{'),Buffer.alloc(directoryLimits.fileBytes+1,32)]) {
    const result=run(bytes,true);expect(result.status).not.toBe(0);expect(result.stdout).toBe('')
  }
  expect(run(Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(JSON.stringify(report()))]),true).status).toBe(0)
  const missing=spawnSync(process.execPath,['example/headless/list-events.mjs'],{encoding:'utf8'})
  expect(missing.status).not.toBe(0);expect(missing.stdout).toBe('')
})
it('rejects too many entries rather than silently truncating', () => {
  const saved=report()
  saved.blocks.changes=Array.from({length:directoryLimits.entries+1},(_,i)=>({kind:'insert',oldFrom:0,oldTo:0,newFrom:i,newTo:i+1,before:[],after:[{type:'image'}]}))
  expect(()=>eventDirectory(saved)).toThrow('entry limit')
})
it('accepts real depth-32 events with empty truncated details, but rejects deeper entries', () => {
  const nested = text => {
    let node = {type:'paragraph',content:[{type:'text',text}]}
    for(let i=0;i<34;i++) node={type:'container',content:[node]}
    return {type:'doc',content:[node]}
  }
  const saved=reviewSnapshots(nested('old'),nested('new'),undefined,{maxDepth:32,maxCells:100000})
  const directory=eventDirectory(saved)
  expect(directory.entries.length).toBe(33)
  expect(directory.entries.at(-1)).toMatchObject({depth:32,details:{present:true,childCount:0,truncated:true,fallback:false}})
  let layer=saved.blocks
  for(let i=0;i<32;i++) layer=layer.changes[0].details
  const parent=layer.changes[0]
  parent.details={fallback:false,truncated:false,changes:[{kind:'replace',oldFrom:parent.oldFrom+1,oldTo:parent.oldTo-1,newFrom:parent.newFrom+1,newTo:parent.newTo-1,before:[{type:'container'}],after:[{type:'container'}]}]}
  expect(()=>eventDirectory(saved)).toThrow('depth limit')
})
