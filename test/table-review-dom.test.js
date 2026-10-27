// @vitest-environment jsdom
import {beforeEach,expect,it,vi} from 'vitest'
import {readFileSync} from 'node:fs'
import samples from '../example/table-review/samples.json'
import {reviewTables} from '../example/table-snapshots/review.mjs'
import {schema,loadSnapshot,preflight} from '../example/table-snapshots/schema.mjs'
import {Fragment,DOMSerializer} from 'prosemirror-model'
import {renderTableSource} from '../example/src/table-source-view.js'
import {createTableReview} from '../example/src/table-review-controller.js'
const html=readFileSync('example/tables.html','utf8')
beforeEach(()=>{document.body.innerHTML=html;Element.prototype.scrollIntoView=vi.fn()})
const root=()=>document.getElementById('table-review')
function harness() {
  const workers=[]
  const controller=createTableReview(root(),{workerFactory:()=>{
    const worker={postMessage:vi.fn(),terminate:vi.fn(),onmessage:null,onerror:null};workers.push(worker);return worker
  }})
  return {controller,workers,reply:(index,report)=>workers[index].onmessage({data:{ok:true,report}})}
}
for(const sample of samples) it(`preserves valid original grids, spans, ranges and reconstruction: ${sample.name}`,()=>{
  const input=JSON.stringify(sample),report=reviewTables(sample.before,sample.after)
  expect(report.tableValidation.grids).toHaveLength(2)
  const a=schema.nodeFromJSON(report.snapshots.before),b=schema.nodeFromJSON(report.snapshots.after)
  let rebuilt=Fragment.empty,end=0
  for(const change of report.blocks.changes) {rebuilt=rebuilt.append(a.content.cut(end,change.oldFrom)).append(Fragment.fromArray(change.after.map(n=>schema.nodeFromJSON(n))));end=change.oldTo}
  expect(rebuilt.append(a.content.cut(end)).eq(b.content)).toBe(true)
  for(const [side,json] of [['before',sample.before],['after',sample.after]]) {
    const targets=renderTableSource(document.getElementById(side),json,side)
    const doc=schema.nodeFromJSON(json),expected=[],spans=[]
    doc.descendants((node,pos)=>{
      if(!node.isText)expected.push([pos,pos+node.nodeSize,node.type.name])
      if(['table_cell','table_header'].includes(node.type.name))spans.push([node.attrs.colspan,node.attrs.rowspan])
    })
    expect(targets.map(t=>[t.from,t.to,t.type]).sort()).toEqual(expected.sort())
    const table=document.querySelector(`#${side} table`)
    expect(table.querySelector('tbody').parentElement).toBe(table)
    expect(table.querySelectorAll('div')).toHaveLength(0)
    for(const row of table.querySelectorAll('tr')) {
      expect(row.parentElement.tagName).toBe('TBODY')
      expect([...row.children].every(c=>['TD','TH'].includes(c.tagName))).toBe(true)
    }
    expect([...table.querySelectorAll('td,th')].map(c=>[c.colSpan,c.rowSpan])).toEqual(spans)
    // Exercise official table NodeSpec.toDOM with the preserved old model lock,
    // independently of this custom renderer and its compatibility assertion.
    const serializer=new DOMSerializer({...DOMSerializer.nodesFromSchema(schema),paragraph:()=>['p',0]},
      {strong:()=>['strong',0],em:()=>['em',0],code:()=>['code',0],link:()=>['span',0]})
    const official=serializer.serializeFragment(doc.content,{document})
    expect([...official.querySelectorAll('td,th')].map(c=>[c.colSpan,c.rowSpan])).toEqual(spans)
  }
  expect(JSON.stringify(sample)).toBe(input)
})
it('navigates retained events and keeps raw report; changing scenarios clears everything while pending',()=>{
  const h=harness(),report=reviewTables(samples[0].before,samples[0].after)
  h.controller.load(samples[0]);h.reply(0,report)
  expect(document.getElementById('raw').textContent).toBe(JSON.stringify(report,null,2))
  const buttons=[...document.querySelectorAll('#changes button')]
  expect(buttons.length).toBeGreaterThan(1)
  document.getElementById('next').click()
  expect(buttons[1].getAttribute('aria-pressed')).toBe('true')
  expect(document.getElementById('before-location').textContent).toContain('[')
  h.controller.load(samples[1])
  expect(document.querySelectorAll('#before table,#after table,#changes button,.range-selected')).toHaveLength(0)
  expect(document.getElementById('raw').textContent).toBe('')
})
it('ignores obsolete success/error callbacks after switching and disposal',()=>{
  const h=harness(),report=reviewTables(samples[0].before,samples[0].after)
  h.controller.load(samples[0]);h.controller.load(samples[1])
  h.reply(0,report);h.workers[0].onerror()
  expect(document.querySelectorAll('table')).toHaveLength(0)
  h.reply(1,report);expect(document.querySelectorAll('table')).toHaveLength(2)
  h.controller.dispose();h.reply(1,report)
  expect(document.querySelectorAll('table')).toHaveLength(0)
  expect(h.workers.every(w=>w.terminate.mock.calls.length>0)).toBe(true)
})
it('rejects invalid grid, reports worker failure and recovers on next scenario',()=>{
  const invalid=structuredClone(samples[0].before);invalid.content[1].content[0].content.pop()
  expect(()=>preflight(loadSnapshot(invalid,'before'),loadSnapshot(samples[0].after,'after'))).toThrow()
  const h=harness();h.controller.load(samples[0]);h.workers[0].onmessage({data:{ok:false,error:'before: grid'}})
  expect(document.getElementById('error').textContent).toBe('before: grid')
  expect(document.querySelectorAll('table')).toHaveLength(0)
  h.controller.load(samples[0]);h.reply(1,reviewTables(samples[0].before,samples[0].after))
  expect(document.getElementById('error').hidden).toBe(true)
  expect(document.querySelectorAll('table')).toHaveLength(2)
})
it('coarse budget keeps complete tables and explicit fallback, with no invented cell mapping',()=>{
  const h=harness();h.controller.load(samples[0]);h.reply(0,reviewTables(samples[0].before,samples[0].after,undefined,{maxDepth:4,maxCells:0}))
  expect(document.getElementById('status').textContent).toContain('Coarse alignment fallback')
  expect(document.querySelectorAll('table')).toHaveLength(2)
})
it('literal link data cannot create navigating anchors or HTML',()=>{
  const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'<script>bad</script>',marks:[{type:'link',attrs:{href:'javascript:alert(1)',title:'data'}}]}]}]}
  renderTableSource(document.getElementById('before'),doc,'Before')
  expect(document.querySelectorAll('#before a,#before script')).toHaveLength(0)
  expect(document.getElementById('before').textContent).toBe('<script>bad</script>')
})
it('rejects non-text marks rather than silently dropping formatting',()=>{
  const json=structuredClone(samples[0].before)
  json.content[1].marks=[{type:'strong'}]
  expect(()=>renderTableSource(document.getElementById('before'),json,'Before')).toThrow('non-text')
  expect(document.querySelectorAll('#before table')).toHaveLength(0)
})
