// @vitest-environment jsdom
import {beforeEach,expect,it,vi} from 'vitest'
import {readFileSync} from 'node:fs'
import samples from '../example/table-review/samples.json'
import {reviewTables} from '../example/table-snapshots/review.mjs'
import {createTableReview} from '../example/src/table-review-controller.js'
beforeEach(()=>{document.body.innerHTML=readFileSync('example/tables.html','utf8');Element.prototype.scrollIntoView=vi.fn()})
function harness(pair) {
  const main=[],details=[]
  const factory=list=>()=>{const w={postMessage:vi.fn(),terminate:vi.fn(),onmessage:null,onerror:null};list.push(w);return w}
  const controller=createTableReview(document.getElementById('table-review'),{workerFactory:factory(main),metadataWorkerFactory:factory(details)})
  const report=reviewTables(pair.before,pair.after,undefined,{maxDepth:4,maxCells:100000})
  controller.load(pair);main[0].onmessage({data:{ok:true,report}})
  const reply=index=>{const request=details[index].postMessage.mock.calls[0][0];const result=reviewTables(request.before,request.after,request.eventPath,request.options);details[index].onmessage({data:{ok:true,selected:result.selected}});return result.selected}
  return {controller,details,report,reply}
}
const marks=samples.find(s=>s.name==='marks-only')
for(const reverse of [false,true]) it(`shows strong ${reverse?'removal':'addition'} with exact offsets without rewriting raw or tables`,()=>{
  const pair=reverse?{before:marks.after,after:marks.before}:marks
  const h=harness(pair),before=document.getElementById('before').innerHTML,after=document.getElementById('after').innerHTML
  const detail=h.reply(0)
  expect(detail.coverage).toBe('metadata')
  expect(document.getElementById('metadata-records').textContent).toContain('Before [12, 13) → After [12, 13)')
  expect(document.getElementById('metadata-records').textContent).toContain('strong')
  expect(document.getElementById('raw').textContent).toBe(JSON.stringify(h.report,null,2))
  expect(document.getElementById('before').innerHTML).toBe(before);expect(document.getElementById('after').innerHTML).toBe(after)
})
for(const kind of ['link','colwidth']) it(`shows literal ${kind} before/after attributes`,()=>{
  const before=structuredClone(marks.before),after=structuredClone(marks.before)
  const cell=doc=>doc.content[1].content[0].content[0]
  if(kind==='link') {
    cell(before).content[0].content[0].marks=[{type:'link',attrs:{href:'https://example.org/old'}}]
    cell(after).content[0].content[0].marks=[{type:'link',attrs:{href:'<script>literal</script>'}}]
  } else {
    for (const row of before.content[1].content) row.content[0].attrs.colwidth=[100]
    for (const row of after.content[1].content) row.content[0].attrs.colwidth=[200]
  }
  const h=harness({before,after});expect(h.reply(0).coverage).toBe('metadata')
  expect(document.getElementById('metadata-records').textContent).toContain(kind==='link'?'<script>literal</script>':'colwidth')
  expect(document.querySelectorAll('#metadata-records a,#metadata-records script')).toHaveLength(0)
})
for(const name of ['text-and-marks','row-insert','row-delete']) it(`keeps ${name} conservative and retains original report`,()=>{
  const h=harness(samples.find(s=>s.name===name));expect(h.reply(0).coverage).toBe('block-only')
  expect(document.getElementById('metadata-status').textContent).toContain('Metadata requires identical text and structure')
  expect(document.getElementById('metadata-records').children).toHaveLength(0)
  expect(document.getElementById('raw').textContent).toBe(JSON.stringify(h.report,null,2))
})
it('clears metadata on selection/cancel, ignores stale success and errors, retains tables on metadata failure',()=>{
  const h=harness(marks);h.reply(0)
  document.getElementById('next').click()
  expect(h.details[0].terminate).toHaveBeenCalled()
  expect(document.getElementById('metadata-records').children).toHaveLength(0)
  h.reply(0);h.details[0].onerror()
  expect(document.getElementById('metadata-status').textContent).toContain('Inspecting')
  h.details[1].onmessage({data:{ok:false,error:'validation'}})
  expect(document.getElementById('metadata-status').textContent).toContain('unavailable')
  expect(document.querySelectorAll('table')).toHaveLength(2)
  expect(document.getElementById('raw').textContent).toBe(JSON.stringify(h.report,null,2))
  h.controller.cancel();h.reply(1)
  expect(document.getElementById('metadata-status').textContent).toBe('No event selected.')
  expect(document.querySelectorAll('table')).toHaveLength(0)
})

for(const reverse of [false,true]) it(`shows nested text ${reverse?'deletion':'insertion'} while preserving mixed-format caveats and raw`,()=>{
  const sample=samples.find(s=>s.name==='text-and-marks')
  const pair=reverse?{before:sample.after,after:sample.before}:sample
  const original=JSON.stringify(pair),h=harness(pair)
  for(let i=0;i<3;i++) document.getElementById('next').click()
  const tables=[...document.querySelectorAll('table')].map(t=>t.outerHTML)
  const detail=h.reply(3),panel=document.getElementById('text-records')
  expect(detail.coverage).toBe('text-only-partial');expect(panel.hidden).toBe(false)
  const records=JSON.parse(panel.textContent)
  expect(records).toEqual([{kind:reverse?'delete':'insert',before:{from:12,to:reverse?20:12,text:reverse?'Updated ':''},after:{from:12,to:reverse?12:20,text:reverse?'':'Updated '}}])
  expect(document.getElementById('metadata-status').textContent).toContain('Formatting is not independently compared')
  expect(document.getElementById('metadata-status').textContent).toContain(detail.precision)
  expect(document.getElementById('metadata-records').children).toHaveLength(0)
  expect(document.getElementById('raw').textContent).toBe(JSON.stringify(h.report,null,2))
  expect([...document.querySelectorAll('table')].map(t=>t.outerHTML)).toEqual(tables)
  expect(JSON.stringify(pair)).toBe(original)
  document.getElementById('previous').click()
  expect(panel.hidden).toBe(true);expect(panel.textContent).toBe('')
  h.reply(3);expect(panel.hidden).toBe(true)
  h.reply(4);expect(panel.hidden).toBe(true)
  h.controller.cancel();h.reply(3);expect(panel.hidden).toBe(true)
})
it('renders Unicode and HTML-like snippets literally at original UTF-16 offsets',()=>{
  const before=structuredClone(marks.before),after=structuredClone(marks.before)
  const text='👩‍💻é<script>literal</script>'
  after.content[1].content[0].content[0].content[0].content[0].text=text+'A'
  const h=harness({before,after})
  for(let i=0;i<3;i++) document.getElementById('next').click()
  h.reply(3)
  const panel=document.getElementById('text-records'),records=JSON.parse(panel.textContent)
  expect(records[0].after).toEqual({from:12,to:12+text.length,text})
  expect(panel.querySelectorAll('*')).toHaveLength(0)
  expect(panel.textContent).toContain('<script>literal</script>')
  h.controller.dispose();expect(panel.hidden).toBe(true);expect(panel.textContent).toBe('')
})
it('keeps inline atoms outside text details',()=>{
  const before=structuredClone(marks.before),after=structuredClone(marks.before)
  const paragraph=doc=>doc.content[1].content[0].content[0].content[0]
  paragraph(before).content.push({type:'hard_break'})
  paragraph(after).content.push({type:'hard_break'},{type:'text',text:'B'})
  const h=harness({before,after})
  for(let i=0;i<3;i++) document.getElementById('next').click()
  expect(h.reply(3).coverage).toBe('block-only')
  expect(document.getElementById('text-records').hidden).toBe(true)
})
