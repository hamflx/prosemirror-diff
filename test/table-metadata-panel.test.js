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
