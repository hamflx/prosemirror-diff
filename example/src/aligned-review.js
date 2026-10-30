import {compareDocumentBlocks} from '../../src/blocks.js'
import {prepareTextChange} from './text-review.js'
import {renderTextSource} from './text-source-view.js'
const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node}

// Whole top-level gaps remain single rows: no inferred row/cell/node identities.
export function alignedRows(before,after,options={}) {
  const result=compareDocumentBlocks(before,after,options), rows=[]
  const old=[],next=[]
  before.forEach((node,from)=>old.push({node,from}))
  after.forEach((node,from)=>next.push({node,from}))
  let a=0,b=0
  for(const change of result.changes){
    while(a<old.length&&old[a].from<change.oldFrom){rows.push({kind:'unchanged',before:[old[a++]],after:[next[b++]]})}
    const left=[],right=[]
    while(a<old.length&&old[a].from<change.oldTo)left.push(old[a++])
    while(b<next.length&&next[b].from<change.newTo)right.push(next[b++])
    rows.push({kind:change.kind,before:left,after:right,change})
  }
  while(a<old.length)rows.push({kind:'unchanged',before:[old[a++]],after:[next[b++]]})
  return {rows,fallback:result.fallback,comparison:result.comparison}
}
function source(node,from,targets){
  const tags={paragraph:'p',heading:'h3',bullet_list:'ul',ordered_list:'ol',list_item:'li',container:'section',section:'section',table:'table',table_row:'tr',table_cell:'td',table_header:'th',image:'figure'}
  const tag=tags[node.type.name]
  if(!tag)throw new RangeError('Unsupported aligned renderer node: '+node.type.name)
  const dom=el(tag);dom.dataset.from=String(from);dom.dataset.to=String(from+node.nodeSize)
  if(node.isTextblock){renderTextSource(dom,node);targets.push({dom,node,from});return dom}
  if(node.type.name==='image'){dom.textContent=`Image: ${node.attrs.alt??''} (${node.attrs.src??''})`;return dom}
  if(tag==='td'||tag==='th'){dom.colSpan=node.attrs.colspan;dom.rowSpan=node.attrs.rowspan}
  let destination=dom
  if(tag==='table'){destination=el('tbody');dom.append(destination)}
  node.forEach((child,offset)=>destination.append(source(child,from+1+offset,targets)))
  return dom
}
export function mountAlignedReview(root,initial) {
  let disposed=false,worker,generation=0,observer,panes=[],pairs=[],listeners=[],active
  const factory=initial.workerFactory??(()=>new Worker(new URL('./text-review-worker.js',import.meta.url),{type:'module'}))
  function cancel(){generation++;worker?.terminate();worker=undefined;if(active){for(const target of active.targets)renderTextSource(target.dom,target.node);active.status.textContent='Text review cleared.';active.controls.replaceChildren();active=undefined}}
  function clear(){cancel();observer?.disconnect();listeners.forEach(([node,fn])=>node.removeEventListener('scroll',fn));listeners=[];root.replaceChildren()}
  function update({before,after,options={}}){
    if(disposed)throw new Error('Aligned review disposed')
    const model=alignedRows(before,after,options)
    clear();root.classList.add('aligned-review')
    root.append(el('p',`Aligned original blocks. ${model.fallback?'Coarse block fallback. ':''}Tables remain whole blocks; row/cell matching is not inferred.`))
    if(model.comparison)root.append(el('p',`Comparison excludes attributes: ${model.comparison.ignoredAttributes.join(', ')}. Aligned unchanged rows may still contain those original attribute differences. Text refinement still requires original matching markup.`))
    const columns=el('div');columns.className='aligned-columns';root.append(columns)
    panes=['Before','After'].map(label=>{const column=el('section');column.append(el('h3',label));const pane=el('div');pane.className='aligned-pane';pane.tabIndex=0;pane.setAttribute('aria-label',label+' document');column.append(pane);columns.append(column);return pane})
    pairs=[]
    const contents=[]
    model.rows.forEach((row,index)=>{
      const targets=[],cells=[]
      for(let side=0;side<2;side++){
        const cell=el('div');cell.className='aligned-row aligned-'+row.kind;cell.dataset.row=String(index)
        const content=el('div');content.className='aligned-content';cell.append(content);contents.push(content)
        const nodes=side===0?row.before:row.after
        if(!nodes.length){const marker=el('p',`${side===0?'Insertion':'Deletion'} point ${side===0?row.change.oldFrom:row.change.newFrom}`);marker.className='aligned-placeholder';content.append(marker)}
        else for(const item of nodes)content.append(source(item.node,item.from,targets))
        panes[side].append(cell);cells.push(cell)
      }
      pairs.push(cells)
      if(row.change){
        const status=el('p'),controls=el('div');status.className='aligned-status';status.setAttribute('aria-live','polite');cells[0].firstChild.append(status,controls)
        const prepared=prepareTextChange(row.change)
        if(!prepared.supported){status.textContent='Complete block only. '+prepared.reason;return}
        const button=el('button','Review text');button.type='button';cells[0].firstChild.insertBefore(button,status)
        status.textContent='Text correspondence only; formatting is preserved, not independently compared.'
        button.onclick=()=>{
          cancel();active={targets,status,controls};const id=generation;status.textContent='Computing text details…'
          try{
            const current=worker=factory()
            const fail=()=>{if(disposed||id!==generation||worker!==current)return;current.terminate();worker=undefined;status.textContent='Text details unavailable; complete originals retained.'}
            current.onerror=fail;current.onmessageerror=fail
            current.onmessage=({data})=>{
              if(disposed||id!==generation||worker!==current||data.requestId!==id)return
              if(data.error||!Array.isArray(data.result?.hunks)){fail();return}
              current.terminate();worker=undefined
              const hunks=data.result.hunks;let selected=0
              const prev=el('button','Previous text change'),next=el('button','Next text change');prev.type=next.type='button'
              const display=()=>{
                for(const target of targets)renderTextSource(target.dom,target.node)
                const hunk=hunks[selected]
                if(hunk)for(let side=0;side<2;side++){
                  const target=targets[side],prefix=side===0?'old':'new'
                  renderTextSource(target.dom,target.node,{from:hunk[prefix+'From'],to:hunk[prefix+'To'],start:target.from+1,label:prefix+' text boundary'})
                }
                status.textContent=hunk?`Text ${selected+1}/${hunks.length}: Before [${hunk.oldFrom}, ${hunk.oldTo}), After [${hunk.newFrom}, ${hunk.newTo}). Formatting not independently compared; correspondence may be coarse.`:'No text difference; formatting may differ. Complete originals retained.'
                const focused=document.activeElement
                prev.disabled=selected===0;next.disabled=selected>=hunks.length-1
                if(focused===next&&next.disabled&&!prev.disabled)prev.focus()
                else if(focused===prev&&prev.disabled&&!next.disabled)next.focus()
                measure()
              }
              prev.onclick=()=>{if(selected>0){selected--;display()}};next.onclick=()=>{if(selected<hunks.length-1){selected++;display()}}
              controls.append(prev,next);display()
            }
            current.postMessage({requestId:id,...prepared})
          }catch{worker?.terminate();worker=undefined;status.textContent='Text details unavailable; complete originals retained.'}
        }
      }
    })
    let expected=[null,null]
    panes.forEach((pane,side)=>{
      const handler=()=>{
        if(disposed)return
        if(expected[side]!==null&&Math.abs(pane.scrollTop-expected[side])<1){expected[side]=null;return}
        expected[side]=null
        const other=panes[1-side],row=pairs.find(pair=>pair[side].offsetTop+pair[side].offsetHeight>pane.scrollTop)
        const max=Math.max(0,pane.scrollHeight-pane.clientHeight),otherMax=Math.max(0,other.scrollHeight-other.clientHeight)
        let target=max?pane.scrollTop/max*otherMax:0
        if(row){const from=row[side],to=row[1-side];target=to.offsetTop+(pane.scrollTop-from.offsetTop)/Math.max(1,from.offsetHeight)*to.offsetHeight}
        target=Math.max(0,Math.min(otherMax,target));if(Math.abs(other.scrollTop-target)>0.5){expected[1-side]=target;other.scrollTop=target}
      };pane.addEventListener('scroll',handler);listeners.push([pane,handler])
    })
    if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(measure);contents.forEach(node=>observer.observe(node))}
    measure()
  }
  function measure(){for(const pair of pairs){const height=Math.max(...pair.map(cell=>{
    const style=getComputedStyle(cell)
    const extra=['borderTopWidth','borderBottomWidth','paddingTop','paddingBottom'].reduce((total,key)=>total+(parseFloat(style[key])||0),0)
    return cell.firstChild.getBoundingClientRect().height+extra
  }));for(const cell of pair)if(cell.style.minHeight!==height+'px')cell.style.minHeight=height+'px'}}
  update(initial)
  return {update,dispose(){if(disposed)return;disposed=true;clear();root.classList.remove('aligned-review')}}
}
