import {expect,it} from 'vitest'
import {Schema} from 'prosemirror-model'
import {spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {sourceFormatting} from '../example/src/source-formatting.js'
import {reviewSnapshots} from '../example/headless/review.mjs'
const schema=new Schema({nodes:{doc:{content:'block+'},paragraph:{group:'block',content:'inline*'},text:{group:'inline'},token:{inline:true,group:'inline',atom:true},hard_break:{inline:true,group:'inline'}},marks:{strong:{},em:{},code:{excludes:'_'},link:{attrs:{href:{},title:{default:null}}},unknown:{}}})
const t=(text,marks=[])=>schema.text(text,marks)
const p=content=>schema.node('paragraph',null,content)
const change=(before,after)=>({kind:'replace',before:[before],after:[after],oldFrom:8,newFrom:18})
const fixture=name=>JSON.parse(readFileSync(new URL('../example/headless/'+name+'.json',import.meta.url),'utf8'))
const before=fixture('formatting-old'),after=fixture('formatting-new')
function verifySide(side,node,start) {
  expect(side.from).toBe(start);expect(side.to).toBe(start+node.content.size)
  expect(side.runs.map(run=>run.text).join('')).toBe(node.textContent)
  let position=start
  node.forEach((child,offset,index)=>{
    const run=side.runs[index]
    expect(run).toEqual({from:start+offset,to:start+offset+child.text.length,text:child.text,marks:JSON.parse(JSON.stringify(child.marks.map(mark=>mark.toJSON())))})
    expect(run.from).toBe(position);position=run.to
  })
  expect(position).toBe(side.to)
}
it('adds independent mixed-source inventories without changing partial coverage or default output',()=>{
  const baseline=reviewSnapshots(before,after,'1')
  const opted=reviewSnapshots(before,after,'1',undefined,{formatting:true})
  expect(baseline.selected.coverage).toBe('text-only-partial')
  expect(Object.hasOwn(baseline.selected,'sourceFormatting')).toBe(false)
  expect(reviewSnapshots(before,after,'1',undefined,{formatting:false})).toEqual(baseline)
  const {sourceFormatting:inventory,...selected}=opted.selected
  expect({...opted,selected}).toEqual(baseline)
  expect(inventory.kind).toBe('source-inventory')
  expect(inventory.old.runs[0]).toEqual({from:9,to:10,text:'e',marks:[]})
  expect(inventory.old.runs[1]).toEqual({from:10,to:11,text:'\u0301',marks:[{type:'strong'}]})
  expect(inventory.new.from).toBe(19)
  expect(inventory.old.runs[2].marks[0].attrs).toEqual({href:'/old',title:'Old link'})
  expect(JSON.parse(JSON.stringify(opted))).toEqual(opted)
})
it('keeps mark boundaries inside a ZWJ grapheme and independent UTF-16 sides',()=>{
  const a=p([t('👩'),t('\u200d',[schema.mark('strong')]),t('👩',[schema.mark('em')])])
  const b=p([t('👩\u200d👧',[schema.mark('link',{href:'/new'})])])
  const result=sourceFormatting(change(a,b))
  verifySide(result.old,a,9);verifySide(result.new,b,19)
  expect(result.old.runs.map(run=>[run.from,run.to])).toEqual([[9,11],[11,12],[12,14]])
})
it('does not infer identity or mark deletion from repeated aa to a',()=>{
  const a=p([t('a',[schema.mark('strong')]),t('a')]),b=p(t('a'))
  const result=sourceFormatting(change(a,b))
  verifySide(result.old,a,9);verifySide(result.new,b,19)
  expect(result.reason).toContain('Not a mark diff')
  expect(Object.keys(result)).not.toContain('changes')
})
it('keeps exclusive code and detached link snapshots without altering source nodes',()=>{
  const a=p([t('cat',[schema.mark('code')]),t(' link',[schema.mark('link',{href:'/old',title:'<literal>'})])])
  const b=p([t('cart',[schema.mark('code')]),t(' link',[schema.mark('link',{href:'/new'})])])
  const saved=JSON.stringify([a.toJSON(),b.toJSON()])
  const result=sourceFormatting(change(a,b))
  verifySide(result.old,a,9);verifySide(result.new,b,19)
  result.old.runs[1].marks[0].attrs.href='mutated'
  result.old.runs[0].marks.push({type:'strong'})
  result.new.runs.length=0
  expect(JSON.stringify([a.toJSON(),b.toJSON()])).toBe(saved)
  a.check();b.check()
})
it.each(['token','hard_break','unknown','oversize'])('does not claim a full inventory for %s',kind=>{
  const a=kind==='unknown'?p(t('a',[schema.mark('unknown')])):kind==='oversize'?p(t('x'.repeat(10001))):p([t('a'),schema.node(kind)])
  const result=sourceFormatting(change(a,a))
  expect(result.coverage).toBe('unsupported');expect(result.reason.length).toBeGreaterThan(0)
  expect(result.old).toBeUndefined();expect(result.new).toBeUndefined()
})
it('handles empty sources and explicit not-selected without implying no formatting changes elsewhere',()=>{
  const result=sourceFormatting(change(p(),p(t('flag'))))
  expect(result.old).toEqual({from:9,to:9,runs:[]})
  expect(reviewSnapshots(before,after,undefined,undefined,{formatting:true}).selected.sourceFormatting.coverage).toBe('not-selected')
})
it('runs opt-in CLI and preserves the exact default report',()=>{
  const cli=fileURLToPath(new URL('../example/headless/cli.mjs',import.meta.url))
  const files=['formatting-old','formatting-new'].map(name=>fileURLToPath(new URL('../example/headless/'+name+'.json',import.meta.url)))
  const run=(args)=>spawnSync(process.execPath,[cli,...files,...args],{encoding:'utf8'})
  const plain=run(['1']),formatted=run(['1','--formatting'])
  expect(plain.status,plain.stderr).toBe(0);expect(formatted.status,formatted.stderr).toBe(0)
  expect(JSON.parse(plain.stdout)).toEqual(reviewSnapshots(before,after,'1'))
  const report=JSON.parse(formatted.stdout)
  expect(report.selected.sourceFormatting.old.runs.length).toBe(5)
  expect(report.selected.coverage).toBe('text-only-partial')
  const missing=run(['--formatting'])
  expect(missing.status).not.toBe(0);expect(missing.stdout).toBe('')
  expect(missing.stderr).toContain('requires an explicit event path')
  for(const args of [['1','--formatting','--formatting'],['1','--unknown'],['--unknown']]) {
    const invalid=run(args);expect(invalid.status).not.toBe(0);expect(invalid.stdout).toBe('')
  }
})
it('reports preparation/snapshot or unsafe-position failures as unavailable rather than empty inventories',()=>{
  const mark=schema.mark('link',{href:'/old'})
  const a=p(t('old',[mark])),b=p(t('new'))
  let reads=0
  Object.defineProperty(mark.attrs,'href',{enumerable:true,get(){if(reads++)throw new Error('private serializer detail');return '/old'}})
  const result=sourceFormatting(change(a,b))
  expect(result.coverage).toBe('unavailable');expect(result.old).toBeUndefined()
  expect(result.reason).not.toContain('private serializer detail')
  for(const oldFrom of [-1,NaN,Number.MAX_SAFE_INTEGER,'1']) {
    expect(sourceFormatting({...change(b,b),oldFrom}).coverage).toBe('unavailable')
  }
})

it('does not invoke a custom serializer or retain its nested objects',()=>{
  const mark=schema.mark('link',{href:'/actual'})
  const shared={nested:'not supported'}
  mark.toJSON=()=>({type:'link',attrs:{href:shared}})
  const result=sourceFormatting(change(p(t('old',[mark])),p(t('new'))))
  expect(result.old.runs[0].marks).toEqual([{type:'link',attrs:{href:'/actual',title:null}}])
  result.old.runs[0].marks[0].attrs.href='changed'
  expect(mark.attrs.href).toBe('/actual');expect(shared).toEqual({nested:'not supported'})
})
