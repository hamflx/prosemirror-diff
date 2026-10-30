// @vitest-environment jsdom
import {expect,it,afterEach,vi} from 'vitest'
import {Schema} from 'prosemirror-model'
import {alignedRows,mountAlignedReview} from '../example/src/aligned-review.js'
import {calculateTextReview} from '../example/src/text-review.js'
const schema=new Schema({nodes:{doc:{content:'block*'},paragraph:{group:'block',content:'text*'},text:{},table:{group:'block',content:'table_row+'},table_row:{content:'table_cell+'},table_cell:{content:'paragraph+',attrs:{colspan:{default:1},rowspan:{default:1}}}},marks:{strong:{}}})
const p=text=>schema.node('paragraph',null,text?schema.text(text):null)
const doc=(...nodes)=>schema.node('doc',null,nodes)
const root=()=>{const node=document.createElement('div');document.body.append(node);return node}
const controllers=[]
const mount=(node,input)=>{const view=mountAlignedReview(node,input);controllers.push(view);return view}
const fake=()=>{const workers=[];return {workers,factory:()=>{const worker={terminate:vi.fn(),postMessage:vi.fn()};workers.push(worker);return worker}}}
afterEach(()=>{controllers.forEach(view=>view.dispose());controllers.length=0;document.body.replaceChildren();vi.restoreAllMocks()})
it('retains shared blocks as paired rows and insertion/deletion empty-side placeholders',()=>{
  const before=doc(p('anchor'),p('end')),after=doc(p('anchor'),p('insert'),p('end'))
  const snapshot=JSON.stringify([before.toJSON(),after.toJSON()])
  const model=alignedRows(before,after)
  expect(model.rows.map(row=>row.kind)).toEqual(['unchanged','insert','unchanged'])
  expect(model.rows[2].before[0].node).toBe(before.child(1))
  const node=root(),view=mount(node,{before,after})
  expect(node.querySelector('.aligned-placeholder').textContent).toBe('Insertion point 8')
  view.update({before:after,after:before})
  expect(node.querySelector('.aligned-placeholder').textContent).toBe('Deletion point 8')
  expect(JSON.stringify([before.toJSON(),after.toJSON()])).toBe(snapshot)
})
it('equalizes each paired row height from content without flattening long tables',()=>{
  vi.spyOn(Element.prototype,'getBoundingClientRect').mockImplementation(function(){return {height:this.textContent.includes('tall')?240:30}})
  const table=schema.node('table',null,Array.from({length:50},(_,i)=>schema.node('table_row',null,[schema.node('table_cell',null,p(String(i)))])))
  const node=root();mount(node,{before:doc(p('short'),table),after:doc(p('tall'),table)})
  const rows=node.querySelectorAll('.aligned-row')
  expect(rows[0].style.minHeight).toBe('240px');expect(rows[2].style.minHeight).toBe('240px')
  expect(node.querySelectorAll('table')).toHaveLength(2);expect(node.querySelectorAll('table > tbody > tr')).toHaveLength(100)
  expect(node.querySelector('tbody > .aligned-row')).toBeNull()
})
it('synchronizes both directions and cleans old scroll listeners after update/dispose',()=>{
  const node=root(),input={before:doc(p('a')),after:doc(p('b'))},view=mount(node,input)
  const panes=[...node.querySelectorAll('.aligned-pane')]
  for(const pane of panes){Object.defineProperty(pane,'scrollHeight',{value:1000});Object.defineProperty(pane,'clientHeight',{value:200})}
  panes[0].scrollTop=400;panes[0].dispatchEvent(new Event('scroll'));expect(panes[1].scrollTop).toBe(400)
  panes[1].dispatchEvent(new Event('scroll'));expect(panes[0].scrollTop).toBe(400)
  panes[1].scrollTop=200;panes[1].dispatchEvent(new Event('scroll'));expect(panes[0].scrollTop).toBe(200)
  view.update(input);panes[0].scrollTop=700;panes[0].dispatchEvent(new Event('scroll'));expect(panes[1].scrollTop).toBe(200)
  view.dispose();expect(node.children).toHaveLength(0)
})
it('renders actual Unicode hunk highlights with original format and ignores canceled worker replies',()=>{
  const f=fake(),node=root(),old=schema.node('paragraph',null,schema.text('e\u0301 cat',[schema.mark('strong')])),next=p('é cats')
  const input={before:doc(old),after:doc(next),workerFactory:f.factory};const view=mount(node,input)
  node.querySelector('button').click();const first=f.workers[0],message=first.postMessage.mock.calls[0][0]
  first.onmessage({data:{requestId:message.requestId,result:calculateTextReview(message)}})
  expect([...node.querySelectorAll('.selected-text-change')].map(n=>n.textContent)).toEqual(['e\u0301','é'])
  expect(node.querySelector('strong').textContent).toBe('e\u0301 cat')
  const nextButton=[...node.querySelectorAll('button')].find(n=>n.textContent==='Next text change');nextButton.click()
  expect(node.querySelectorAll('.text-position-marker')).toHaveLength(1)
  expect([...node.querySelectorAll('.selected-text-change')].map(n=>n.textContent)).toEqual(['s'])
  node.querySelector('button').click();const late=f.workers[1],lateMessage=late.postMessage.mock.calls[0][0]
  view.update({before:doc(p('same')),after:doc(p('same'))})
  expect(late.terminate).toHaveBeenCalled()
  late.onmessage({data:{requestId:lateMessage.requestId,result:calculateTextReview(lateMessage)}})
  expect(node.querySelector('.selected-text-change')).toBeNull()
})
it('keeps originals available on worker failure with no synchronous calculation fallback',()=>{
  const f=fake(),node=root();mount(node,{before:doc(p('a')),after:doc(p('b')),workerFactory:f.factory})
  node.querySelector('button').click();f.workers[0].onerror()
  expect(node.textContent).toContain('unavailable');expect(node.querySelectorAll('.aligned-pane p')).not.toHaveLength(0)
})
it('uses paired row anchors instead of only full-document ratio',()=>{
  const node=root();mount(node,{before:doc(p('a'),p('stable')),after:doc(p('b'),p('stable'))})
  const panes=[...node.querySelectorAll('.aligned-pane')],left=panes[0].children,right=panes[1].children
  for(const pane of panes){Object.defineProperty(pane,'scrollHeight',{value:1000});Object.defineProperty(pane,'clientHeight',{value:100})}
  for(const [row,top,height] of [[left[0],0,200],[left[1],200,100],[right[0],0,300],[right[1],300,200]]){
    Object.defineProperty(row,'offsetTop',{value:top});Object.defineProperty(row,'offsetHeight',{value:height})
  }
  panes[0].scrollTop=250;panes[0].dispatchEvent(new Event('scroll'))
  expect(panes[1].scrollTop).toBe(400)
  panes[1].dispatchEvent(new Event('scroll'));expect(panes[0].scrollTop).toBe(250)
})
it('discloses ignored-attribute rows while preserving original nodes and strict text admission',()=>{
  const model=new Schema({nodes:{doc:{content:'paragraph*'},paragraph:{content:'text*',attrs:{id:{default:null}}},text:{}}})
  const left=model.node('doc',null,[model.node('paragraph',{id:'old'},model.text('same'))])
  const right=model.node('doc',null,[model.node('paragraph',{id:'new'},model.text('same'))])
  const node=root(),options={ignoreAttributes:['id']}
  const rows=alignedRows(left,right,options)
  expect(rows.rows).toHaveLength(1);expect(rows.rows[0].kind).toBe('unchanged')
  expect(rows.rows[0].before[0].node.attrs.id).toBe('old');expect(rows.rows[0].after[0].node.attrs.id).toBe('new')
  const view=mount(node,{before:left,after:right,options})
  expect(node.textContent).toContain('Aligned unchanged rows may still contain')
  const changed=model.node('doc',null,[model.node('paragraph',{id:'new'},model.text('different'))])
  view.update({before:left,after:changed,options})
  expect(node.textContent).toContain('matching textblock markup')
  expect(node.querySelector('button')).toBeNull()
})
it('moves user focus to the usable navigation control at either boundary without initial focus theft',()=>{
  const f=fake(),node=root();mount(node,{before:doc(p('e\u0301 cat')),after:doc(p('é cats')),workerFactory:f.factory})
  const launch=node.querySelector('button');launch.focus();launch.click()
  const worker=f.workers[0],message=worker.postMessage.mock.calls[0][0]
  worker.onmessage({data:{requestId:message.requestId,result:calculateTextReview(message)}})
  expect(document.activeElement).toBe(launch)
  const buttons=[...node.querySelectorAll('button')]
  const next=buttons.find(button=>button.textContent==='Next text change'),previous=buttons.find(button=>button.textContent==='Previous text change')
  next.focus();next.click();expect(next.disabled).toBe(true);expect(document.activeElement).toBe(previous)
  previous.click();expect(previous.disabled).toBe(true);expect(document.activeElement).toBe(next)
})
it('includes each border-box row border and padding in the shared outer height',()=>{
  const style=document.createElement('style');style.textContent='.aligned-row{box-sizing:border-box;border-bottom:1px solid blue;padding-top:2px;padding-bottom:3px}';document.head.append(style)
  try{
    vi.spyOn(Element.prototype,'getBoundingClientRect').mockImplementation(function(){return {height:this.textContent.includes('tall')?507:30}})
    const node=root();mount(node,{before:doc(p('short'),p('anchor')),after:doc(p('tall'),p('anchor'))})
    const panes=node.querySelectorAll('.aligned-pane')
    expect(panes[0].children[0].style.minHeight).toBe('513px')
    expect(panes[1].children[0].style.minHeight).toBe('513px')
    expect(panes[0].children[1].style.minHeight).toBe(panes[1].children[1].style.minHeight)
  }finally{style.remove()}
})
