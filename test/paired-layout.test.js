// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest'
import {Schema} from 'prosemirror-model'
import {equalBlockAnchors,mountPairedLayout} from '../example/src/paired-layout.js'
const schema=new Schema({nodes:{doc:{content:'block*'},paragraph:{group:'block',content:'text*'},section:{group:'block',content:'block*'},text:{}}})
const p=t=>schema.node('paragraph',null,schema.text(t)),doc=(...xs)=>schema.node('doc',null,xs),section=(...xs)=>schema.node('section',null,xs)
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren()})
it('anchors unchanged following blocks and nested children at original offsets',()=>{
 const old=doc(section(p('a'),p('Closing'))),next=doc(section(p('a'),p('insert'),p('Closing')))
 const snapshots=JSON.stringify([old.toJSON(),next.toJSON()])
 expect(equalBlockAnchors(old,next)).toEqual([[1,1],[4,12]])
 expect(JSON.stringify([old.toJSON(),next.toJSON()])).toBe(snapshots)
})
it('keeps repeated-block pairing deterministic and does not identify changed text as equal',()=>{
 expect(equalBlockAnchors(doc(p('a'),p('a'),p('tail')),doc(p('a'),p('b'),p('a'),p('tail')))).toEqual([[0,0],[3,6],[6,9]])
 expect(equalBlockAnchors(doc(p('old')),doc(p('new')))).toEqual([])
})
it('adds exactly the missing vertical space, recomputes without cumulative drift and disposes',()=>{
 const panes=[document.createElement('div'),document.createElement('div')]
 panes.forEach(p=>document.body.append(p))
 const nodes=panes.map(p=>{const n=document.createElement('p');n.textContent='Closing';p.append(n);return n})
 vi.spyOn(Element.prototype,'getBoundingClientRect').mockImplementation(function(){
   const side=panes.indexOf(this.parentElement)
   if(side<0)return {top:0,height:0}
   let top=this.classList.contains('alignment-tail')?200:side?135.25:100
   for(let n=this.previousElementSibling;n;n=n.previousElementSibling)if(n.classList.contains('alignment-spacer'))top+=parseFloat(n.style.height)||0
   return {top,height:25}
 })
 const view=mountPairedLayout(panes,[nodes])
 expect(panes.map(p=>p.style.scrollbarGutter)).toEqual(['stable','stable'])
 expect(panes[0].querySelector('.alignment-spacer').style.height).toBe('35.25px')
 view.measure();expect(panes[0].querySelector('.alignment-spacer').style.height).toBe('35.25px')
 expect(nodes[0].getBoundingClientRect().top).toBe(nodes[1].getBoundingClientRect().top)
 view.dispose();expect(document.querySelector('.alignment-spacer')).toBeNull();expect(panes[0].style.height).toBe('')
})

// Synthetic geometry exercises the layout policy, not browser table rendering.
it('retains original rowspan grid rows while enlarging an existing row, and restores its style',()=>{
 const panes=[document.createElement('div'),document.createElement('div')]
 panes.forEach(pane=>{pane.innerHTML='<table><tbody><tr style="height: 20px;"><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td></tr></tbody></table>';document.body.append(pane)})
 const originals=panes.map(pane=>pane.innerHTML)
 const rows=panes.map(pane=>[...pane.querySelectorAll('tr')])
 vi.spyOn(Element.prototype,'getBoundingClientRect').mockImplementation(function(){
   for(let side=0;side<2;side++){
     if(this===rows[side][0])return {top:0,height:Math.max(side?70:20,parseFloat(this.style.height)||0)}
     if(this===rows[side][1])return {top:rows[side][0].getBoundingClientRect().height,height:20}
   }
   return {top:0,height:0}
 })
 const view=mountPairedLayout(panes,[[rows[0][1],rows[1][1]]])
 try{
   expect(rows[0][0].style.height).toBe('70px')
   expect(rows[0][1].getBoundingClientRect().top).toBe(rows[1][1].getBoundingClientRect().top)
   view.measure()
   expect(rows[0][0].style.height).toBe('70px')
   for(const pane of panes){
     expect(pane.querySelectorAll('tr')).toHaveLength(2)
     expect(pane.querySelectorAll('td')).toHaveLength(3)
     expect(pane.querySelector('td').rowSpan).toBe(2)
     expect(pane.querySelector('table .alignment-spacer')).toBeNull()
   }
 }finally{view.dispose()}
 expect(panes.map(pane=>pane.innerHTML)).toEqual(originals)
})

it('aligns absolute screen positions despite unequal pane tops and remeasures async non-anchor growth',()=>{
 const resize=[],mutations=[]
 vi.stubGlobal('ResizeObserver',class{constructor(callback){this.callback=callback;this.observe=vi.fn();this.disconnect=vi.fn();resize.push(this)}})
 vi.stubGlobal('MutationObserver',class{constructor(callback){this.callback=callback;this.observe=vi.fn();this.disconnect=vi.fn();mutations.push(this)}})
 const panes=[document.createElement('div'),document.createElement('div')]
 panes.forEach(pane=>{const section=document.createElement('section');section.append(pane);document.body.append(section);pane.innerHTML='<div class="changed">changed</div><p>Closing</p>'})
 const nodes=panes.map(pane=>pane.querySelector('p')),changed=panes.map(pane=>pane.querySelector('.changed'))
 let extra=0
 vi.spyOn(Element.prototype,'getBoundingClientRect').mockImplementation(function(){
   const pane=this.closest('section')?.firstElementChild,side=panes.indexOf(pane)
   if(side<0)return {top:0,height:0}
   const start=side?130:100
   if(this===pane)return {top:start,height:200}
   let top=start+50+(side===0?extra:0)
   for(let n=this.previousElementSibling;n;n=n.previousElementSibling)if(n.classList.contains('alignment-spacer'))top+=parseFloat(n.style.height)||0
   return {top,height:25}
 })
 const view=mountPairedLayout(panes,[nodes])
 try{
   expect(nodes[0].getBoundingClientRect().top).toBe(nodes[1].getBoundingClientRect().top)
   expect(panes[0].querySelector('.alignment-spacer').style.height).toBe('30px')
   expect(resize[0].observe).toHaveBeenCalledWith(changed[0])
   extra=40;resize[0].callback()
   expect(nodes[0].getBoundingClientRect().top).toBe(nodes[1].getBoundingClientRect().top)
   expect(panes[0].querySelector('.alignment-spacer').style.height).toBe('0px')
   expect(panes[1].querySelector('.alignment-spacer').style.height).toBe('10px')
   const asyncControl=document.createElement('button');changed[0].append(asyncControl)
   mutations[0].callback()
   expect(resize[0].observe).toHaveBeenCalledWith(asyncControl)
   expect(mutations[0].observe).toHaveBeenCalledWith(panes[0].parentElement,{childList:true,characterData:true,subtree:true})
 }finally{view.dispose()}
 expect(resize[0].disconnect).toHaveBeenCalledOnce()
 expect(mutations[0].disconnect).toHaveBeenCalledOnce()
 mutations[0].callback();resize[0].callback()
 expect(document.querySelector('.alignment-spacer')).toBeNull()
})

it('synchronizes in both directions across repeated mounts and removes listeners, tab stops and tails',()=>{
 const panes=[document.createElement('div'),document.createElement('div')]
 panes[0].setAttribute('tabindex','3')
 panes.forEach(pane=>{document.body.append(pane);Object.defineProperty(pane,'scrollHeight',{value:1000});Object.defineProperty(pane,'clientHeight',{value:100})})
 const add=panes.map(pane=>vi.spyOn(pane,'addEventListener')),remove=panes.map(pane=>vi.spyOn(pane,'removeEventListener'))
 for(let round=0;round<3;round++){
   const view=mountPairedLayout(panes,[])
   panes[0].scrollTop=100+round;panes[0].dispatchEvent(new Event('scroll'))
   expect(panes[1].scrollTop).toBe(100+round)
   panes[1].dispatchEvent(new Event('scroll'))
   panes[1].scrollTop=200+round;panes[1].dispatchEvent(new Event('scroll'))
   expect(panes[0].scrollTop).toBe(200+round)
   view.dispose();view.dispose()
   panes[0].scrollTop=700;panes[0].dispatchEvent(new Event('scroll'))
   expect(panes[1].scrollTop).toBe(200+round)
   expect(panes[0].getAttribute('tabindex')).toBe('3')
   expect(panes[1].hasAttribute('tabindex')).toBe(false)
   expect(document.querySelector('.alignment-tail')).toBeNull()
 }
 for(let side=0;side<2;side++){
   const registered=add[side].mock.calls.filter(([type])=>type==='scroll')
   expect(registered).toHaveLength(3)
   for(const args of registered)expect(remove[side]).toHaveBeenCalledWith(...args)
 }
})
