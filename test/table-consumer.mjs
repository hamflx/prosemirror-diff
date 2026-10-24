import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve,dirname,basename,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {TableMap,CellSelection,mergeCells} from 'prosemirror-tables'
import {EditorState} from 'prosemirror-state'
import {schema,limits,SnapshotError,loadSnapshot} from '../example/table-snapshots/schema.mjs'
import {reviewTables} from '../example/table-snapshots/review.mjs'
import {reviewSnapshots} from '../example/headless/review.mjs'
import {reviewDocuments} from '../example/headless/model-review.mjs'
import {readSnapshot} from '../example/headless/schema.mjs'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const cli=resolve(root,'example/table-snapshots/cli.mjs')
const temp=mkdtempSync(join(tmpdir(),'pm-table-consumer-'))
const text=(value,marks)=>({type:'text',text:value,...(marks?{marks}:{})})
const p=(value,marks)=>({type:'paragraph',...(value?{content:[text(value,marks)]}:{})})
const cell=(value,attrs={},marks)=>({type:'table_cell',attrs,content:[p(value,marks)]})
const table=rows=>({type:'table',content:rows.map(cells=>({type:'table_row',content:cells}))})
const doc=t=>({type:'doc',content:[p('Before'),t]})
const basic=()=>table([[cell('A'),cell('B')],[cell('C'),cell('D')]])
const results=[]
let fileIndex=0
function command(before,after,path,formatting=false) {
  const files=[before,after].map(value=>{const file=join(temp,`${fileIndex++}.json`);writeFileSync(file,typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value));return file})
  return spawnSync(process.execPath,[cli,...files,...(path===undefined?[]:[path]),...(formatting?['--formatting']:[])],{encoding:'utf8',maxBuffer:8*1024*1024})
}
function test(name,fn){fn();results.push({name,status:'pass'})}
function rejected(before,after,type,side='after',outer=8) {
  const result=command(before,after)
  assert.notEqual(result.status,0);assert.equal(result.stdout,'')
  // Node may warn about source ESM detection before this structured error.
  const line=result.stderr.trim().split('\n').findLast(line=>line.startsWith('{'))
  const error=JSON.parse(line)
  assert.equal(error.side,side);assert.equal(error.tableOuter,outer);assert.equal(error.problem.type,type)
  return error
}
try {
  test('real CLI saved fixtures and nested metadata',()=>{
    const before=JSON.parse(readFileSync(resolve(root,'example/table-snapshots/old.json'),'utf8'))
    const after=JSON.parse(readFileSync(resolve(root,'example/table-snapshots/new.json'),'utf8'))
    const result=command(before,after,'0.0.0.0');assert.equal(result.status,0,result.stderr)
    const report=JSON.parse(result.stdout)
    assert.equal(report.selected.coverage,'metadata');assert.equal(report.selected.records[0].oldFrom,12)
    assert.equal(report.selected.records[0].oldTo,20)
    assert.equal(report.tableValidation.grids[0].outer,8)
    assert.equal(report.tableValidation.grids[0].width,2)
    assert.equal(report.blocks.changes[0].before[0].type,'table')
  })
  test('text-only Unicode with mixed marks and independent leading offset',()=>{
    const a=doc(table([[cell('e\u0301')]])),b=doc(table([[cell('é',{},[{type:'strong'}])]]))
    b.content.unshift(p('Inserted'))
    const report=reviewTables(a,b,'1.0.0.0')
    assert.equal(report.selected.coverage,'text-only-partial')
    assert.deepEqual(report.selected.hunks,[{kind:'replace',oldFrom:12,oldTo:14,newFrom:22,newTo:23}])
    assert.equal(report.tableValidation.grids[1].outer,18)
  })
  test('href snapshots remain literal and both positions preserved',()=>{
    const link=href=>doc(table([[cell('A',{},[{type:'link',attrs:{href,title:'<literal>'}}])]]))
    const report=reviewTables(link('javascript:<old>'),link('javascript:<new>'),'0.0.0.0')
    assert.equal(report.selected.coverage,'metadata')
    assert.equal(report.selected.records[0].before[0].attrs.href,'javascript:<old>')
    assert.equal(report.selected.records[0].after[0].attrs.href,'javascript:<new>')
  })
  for(const axis of ['horizontal','vertical'])test('official mergeCells '+axis,()=>{
    const before=loadSnapshot(doc(basic()),'before').doc
    const state=EditorState.create({schema,doc:before,selection:CellSelection.create(before,10,axis==='horizontal'?15:22)})
    let transaction;assert.equal(mergeCells(state,tr=>{transaction=tr}),true);assert.ok(transaction)
    const after=transaction.doc
    assert.deepEqual(Array.from({length:after.child(1).firstChild.firstChild.childCount},(_,i)=>after.child(1).firstChild.firstChild.child(i).textContent),axis==='horizontal'?['A','B']:['A','C'])
    const report=reviewTables(before.toJSON(),after.toJSON(),'0')
    assert.equal(report.selected.coverage,'block-only')
    assert.equal(report.tableValidation.grids[1].width,2)
    assert.deepEqual(report.snapshots.after,after.toJSON())
  })
  test('coarse and shallow reports retain originals and explicit precision',()=>{
    const a=doc(basic()),b=doc(table([[cell('A'),cell('Changed')],[cell('C'),cell('D')]]))
    const coarse=reviewTables(a,b,'0',{maxDepth:4,maxCells:0});assert.equal(coarse.blocks.fallback,true)
    const shallow=reviewTables(a,b,undefined,{maxDepth:1,maxCells:100000})
    const row=shallow.blocks.changes[0].details.changes[0]
    assert.deepEqual(row.details,{changes:[],fallback:false,truncated:true})
    assert.equal(row.before[0].content[1].content[0].content[0].text,'B')
    assert.equal(shallow.equal,false)
  })
  test('canonical JSON round trip and equal does not skip invalid grids',()=>{
    const report=reviewTables(doc(basic()),doc(basic()))
    assert.equal(report.equal,true)
    const round=JSON.parse(JSON.stringify(report))
    assert.deepEqual(reviewTables(round.snapshots.before,round.snapshots.after).snapshots,report.snapshots)
    const invalid=doc(table([[cell('A'),cell('B')],[cell('C')]]))
    assert.throws(()=>reviewTables(invalid,invalid),SnapshotError)
  })
  test('unequal-width reports official row/n without invented cell pos',()=>{
    const error=rejected(doc(basic()),doc(table([[cell('A'),cell('B')],[cell('C')]])),'grid')
    assert.deepEqual(error.problem.problems,[{type:'missing',row:1,n:1}])
  })
  test('overlong rowspan gives actual table-relative cell position',()=>{
    const error=rejected(doc(basic()),doc(table([[cell('A',{rowspan:2})]])),'overlong_rowspan')
    assert.equal(error.problem.pos,1);assert.equal(error.problem.n,1)
  })
  test('both sides complete allocation preflight before any TableMap call',()=>{
    const original=TableMap.get;let calls=0;TableMap.get=(...args)=>{calls++;return original.apply(TableMap,args)}
    try {
      assert.throws(()=>reviewTables(doc(basic()),doc(table([[cell('X',{colspan:1000000000})]]))),SnapshotError)
      const rows=Array.from({length:80},()=>[cell('x')]);assert.throws(()=>reviewTables(doc(table(rows)),doc(table(rows))),SnapshotError)
      assert.equal(calls,0)
    } finally {TableMap.get=original}
  })
  for(const span of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1])test('reject unsafe span '+span,()=>rejected(doc(table([[cell('X',{colspan:span})]])),doc(basic()),'unsafe-span','before'))
  test('reject safe but excessive span and combined conservative budget',()=>{
    rejected(doc(basic()),doc(table([[cell('X',{colspan:1000000000})]])),'grid-budget')
    const rows=Array.from({length:80},()=>[cell('x')]);rejected(doc(table(rows)),doc(table(rows)),'grid-budget')
  })
  test('schema unknown attributes and invalid model preserve side/table position',()=>{
    rejected(doc(basic()),doc(table([[cell('X',{unknown:1})]])),'schema')
    rejected(doc(basic()),doc({type:'table',content:[{type:'table_row',content:[{type:'table_cell',content:[]}]}]}),'model')
    rejected(doc(basic()),doc(table([[{type:'table_cell',content:[basic()]}]])),'nested-table')
    rejected(doc(basic()),doc(table([[cell('X',{colwidth:[1,2]})]])),'schema')
  })
  test('malformed and oversized input fail atomically before JSON/model allocation',()=>{
    rejected('{',doc(basic()),'json','before',null)
    rejected(' '.repeat(limits.fileBytes+1),doc(basic()),'file-budget','before',null)
  })
  test('second-table diagnostics preserve original outer position',()=>{
    const before=doc(basic()), after={type:'doc',content:[p('Before'),basic(),p('Gap'),table([[cell('A'),cell('B')],[cell('C')]])]}
    rejected(before,after,'grid','after',39)
  })
  test('invalid UTF-8 and selection path leave stdout empty',()=>{
    rejected(Buffer.from([0xc3,0x28]),doc(basic()),'json','before',null)
    const result=command(doc(basic()),doc(basic()),'99')
    assert.notEqual(result.status,0);assert.equal(result.stdout,'')
    assert.ok(result.stderr.includes('Event path does not exist'))
  })
  test('opt-in source inventory for a mixed table cell preserves default report',()=>{
    const before=JSON.parse(readFileSync(resolve(root,'example/table-snapshots/formatting-old.json'),'utf8'))
    const after=JSON.parse(readFileSync(resolve(root,'example/table-snapshots/formatting-new.json'),'utf8'))
    const plain=command(before,after,'1.0.0.0'), opted=command(before,after,'1.0.0.0',true)
    assert.equal(plain.status,0,plain.stderr);assert.equal(opted.status,0,opted.stderr)
    const baseline=JSON.parse(plain.stdout),report=JSON.parse(opted.stdout)
    assert.equal(report.selected.coverage,'text-only-partial')
    const {sourceFormatting:inventory,...selected}=report.selected
    assert.deepEqual({...report,selected},baseline)
    assert.deepEqual(inventory.old.runs[0],{from:12,to:13,text:'e',marks:[]})
    assert.deepEqual(inventory.old.runs[1],{from:13,to:14,text:'\u0301',marks:[{type:'strong'}]})
    assert.equal(inventory.new.from,22)
    assert.equal(inventory.old.runs[2].marks[0].attrs.href,'/old')
    assert.deepEqual(JSON.parse(JSON.stringify(report)),report)
    const missing=command(before,after,undefined,true)
    assert.notEqual(missing.status,0);assert.equal(missing.stdout,'')
  })
  test('unsupported atom does not acquire a complete source inventory',()=>{
    const before=doc(table([[cell('same')]])),after=doc(table([[cell('same')]]))
    after.content[1].content[0].content[0].content[0].content.push({type:'inline_token',attrs:{label:'new'}})
    const result=command(before,after,'0.0.0.0',true)
    assert.equal(result.status,0,result.stderr)
    const report=JSON.parse(result.stdout)
    assert.equal(report.selected.coverage,'block-only')
    assert.equal(report.selected.sourceFormatting.coverage,'unsupported')
    assert.equal(report.selected.sourceFormatting.old,undefined)
  })
  test('original headless contract survives extraction and CLI still runs',()=>{
    const before={type:'doc',content:[p('old')]},after={type:'doc',content:[p('new')]}
    assert.deepEqual(reviewSnapshots(before,after,'0'),reviewDocuments(readSnapshot(before),readSnapshot(after),'0'))
    assert.deepEqual(reviewSnapshots(before,after,undefined,{}),reviewDocuments(readSnapshot(before),readSnapshot(after),undefined,{}))
    const oldCLI=resolve(root,'example/headless/cli.mjs')
    const result=spawnSync(process.execPath,[oldCLI,resolve(root,'example/headless/old.json'),resolve(root,'example/headless/new.json'),'0.0.0'],{encoding:'utf8'})
    assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).selected.coverage,'metadata')
  })
  console.log(JSON.stringify({cases:results.length,results},null,2))
} finally {
  const target=resolve(temp)
  assert.equal(dirname(target),resolve(tmpdir()));assert.ok(basename(target).startsWith('pm-table-consumer-'))
  rmSync(target,{recursive:true,force:true})
}
