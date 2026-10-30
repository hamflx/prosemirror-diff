import {compareDocumentBlocks} from '../../src/blocks.js'

// Exact content anchors, not node identities. Changed containers are refined
// within the existing bounded comparison contract; raw documents stay intact.
export function equalBlockAnchors(before,after) {
  const result=compareDocumentBlocks(before,after,{maxDepth:32}),pairs=[]
  function visit(left,right,oldStart,newStart,changes){
    const a=[],b=[]
    left.forEach((node,offset)=>a.push({node,from:oldStart+offset}))
    right.forEach((node,offset)=>b.push({node,from:newStart+offset}))
    let i=0,j=0
    for(const change of changes){
      while(i<a.length&&a[i].from<change.oldFrom){pairs.push([a[i++].from,b[j++].from])}
      if(change.details&&!change.details.truncated&&!change.details.fallback)
        visit(change.before[0],change.after[0],change.oldFrom+1,change.newFrom+1,change.details.changes)
      while(i<a.length&&a[i].from<change.oldTo)i++
      while(j<b.length&&b[j].from<change.newTo)j++
    }
    while(i<a.length&&j<b.length)pairs.push([a[i++].from,b[j++].from])
  }
  visit(before,after,0,0,result.changes)
  return pairs
}

export function mountPairedLayout(panes,pairs){
  let disposed=false,measuring=false
  const tabIndexes=panes.map(p=>p.getAttribute('tabindex'))
  const spacers=[],rowStyles=new Map(),oldStyles=panes.map(p=>({height:p.style.height,overflow:p.style.overflow,position:p.style.position}))
  for(const pane of panes){pane.style.height='34rem';pane.style.overflow='auto';pane.style.position='relative';pane.tabIndex=0}
  const anchors=pairs.filter(pair=>pair.every(Boolean)&&!pair.some(n=>['TD','TH'].includes(n.tagName)))
  const spacerFor=node=>{
    let spacer=document.createElement('div'),sizing=spacer
    if(node.tagName==='TR')node=node.closest('table')
    spacer.className='alignment-spacer';spacer.setAttribute('aria-hidden','true')
    spacer.style.margin='0';spacer.style.padding='0';spacer.style.border='0'
    node.before(spacer);spacers.push(spacer);return sizing
  }
  const slots=anchors.map(()=>[null,null])
  const tails=panes.map(p=>{const tail=document.createElement('div');tail.setAttribute('aria-hidden','true');tail.className='alignment-tail';p.append(tail);spacers.push(tail);return tail})
  function measure(){
    if(disposed||measuring)return
    measuring=true
    for(const pair of slots)for(const slot of pair)if(slot)slot.style.height='0px'
    for(const [row,height] of rowStyles)row.style.height=height
    for(const tail of tails)tail.style.height='0px'
    for(let i=0;i<anchors.length;i++){
      const ys=anchors[i].map((node,side)=>node.getBoundingClientRect().top+panes[side].scrollTop)
      const delta=ys[1]-ys[0]
      if(Math.abs(delta)>.25){
        const side=delta>0?0:1,node=anchors[i][side]
        // Never insert rows: that would change the meaning of rowspan.
        const previous=node.tagName==='TR'?node.previousElementSibling:null
        if(previous?.tagName==='TR'){
          if(!rowStyles.has(previous))rowStyles.set(previous,previous.style.height)
          previous.style.height=previous.getBoundingClientRect().height+Math.abs(delta)+'px'
        }else {slots[i][side]??=spacerFor(node);slots[i][side].style.height=Math.abs(delta)+'px'}
      }
    }
    const ends=tails.map((tail,side)=>tail.getBoundingClientRect().top-panes[side].getBoundingClientRect().top+panes[side].scrollTop)
    const longest=Math.max(...ends)
    tails.forEach((tail,side)=>tail.style.height=Math.max(0,longest-ends[side])+'px')
    measuring=false
  }
  let expected=[null,null]
  const handlers=panes.map((pane,side)=>()=>{
    if(disposed)return
    if(expected[side]!==null&&Math.abs(pane.scrollTop-expected[side])<1){expected[side]=null;return}
    expected[side]=null
    const other=panes[1-side],target=Math.min(pane.scrollTop,Math.max(0,other.scrollHeight-other.clientHeight))
    if(Math.abs(other.scrollTop-target)>.5){expected[1-side]=target;other.scrollTop=target}
  })
  panes.forEach((pane,i)=>pane.addEventListener('scroll',handlers[i]))
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure)
  let observed=new Set()
  const observeContents=()=>{
    const current=new Set()
    for(const pane of panes){current.add(pane);for(const node of pane.querySelectorAll('*'))if(!node.classList.contains('alignment-spacer')&&!node.classList.contains('alignment-tail'))current.add(node)}
    for(const node of observed)if(!current.has(node))observer?.unobserve(node)
    for(const node of current)if(!observed.has(node))observer?.observe(node)
    observed=current
  }
  observeContents()
  const mutations=typeof MutationObserver==='undefined'?null:new MutationObserver(()=>{if(disposed)return;observeContents();measure()})
  for(const pane of panes)mutations?.observe(pane.parentElement??pane,{childList:true,characterData:true,subtree:true})
  measure()
  return {measure,dispose(){if(disposed)return;disposed=true;observer?.disconnect();mutations?.disconnect();for(const [row,height] of rowStyles)row.style.height=height;spacers.forEach(n=>n.remove());panes.forEach((p,i)=>{p.removeEventListener('scroll',handlers[i]);Object.assign(p.style,oldStyles[i]);if(tabIndexes[i]===null)p.removeAttribute('tabindex');else p.setAttribute('tabindex',tabIndexes[i])})}}
}
