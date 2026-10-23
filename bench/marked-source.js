// The revision label below identifies the measured candidate; update it manually
// when measuring another revision. It is not automatic checkout detection.
// rAF timestamp differences are diagnostic only, not latency or physical paint.
import {Schema} from 'prosemirror-model'
import {renderTextSource, renderMarkDescriptions} from '../example/src/text-source-view.js'
const schema=new Schema({nodes:{doc:{content:'paragraph+'},paragraph:{content:'text*'},text:{}},marks:{strong:{},em:{},link:{attrs:{href:{},title:{default:null}}}}})
const length=6000,text='ab'.repeat(length/2)
const definitions=[['plain',length,()=>[]],['single-strong',length,()=>[schema.mark('strong')]],['60-runs',100,i=>[schema.mark(i%2?'em':'strong')]],['6000-runs',1,i=>[schema.mark(i%2?'em':'strong')]],['6000-two-marks',1,i=>[schema.mark('strong'),schema.mark('link',{href:`https://example.org/${i%2}`,title:`title ${i%2}`})]]]
const fixtures=definitions.map(([name,size,marks])=>{const content=[];for(let i=0;i<length;i+=size)content.push(schema.text(text.slice(i,i+size),marks(i/size)));const node=schema.node('paragraph',null,content);node.check();return{name,node}})
const byId=id=>document.getElementById(id),source=byId('source'),attributes=byId('attributes')
for(const f of fixtures)byId('fixture').add(new Option(f.name,f.name))
const tasks=[],supported=PerformanceObserver.supportedEntryTypes.includes('longtask')
if(supported)new PerformanceObserver(list=>tasks.push(...list.getEntries().map(x=>({start:x.startTime,duration:x.duration})))).observe({type:'longtask',buffered:true})
const environment={userAgent:navigator.userAgent,longTaskSupported:supported,revision:'c9083affa918a1c9e0f5b531f6c9194d9586d597',scope:'actual renderer only; one side; production bundle',throttling:'No throttling configured by page; external DevTools configuration not observable'}
byId('environment').textContent=JSON.stringify(environment)
const observations=[];window.densityResult={environment,observations}
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve)),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const range={from:1501,to:4501,start:1,label:'selection'}
function counts(){let n=0,w=document.createTreeWalker(source,NodeFilter.SHOW_TEXT);while(w.nextNode())n++;return{elements:source.querySelectorAll('*').length,textNodes:n,fragments:source.querySelectorAll('.selected-text-change').length,attributeRows:attributes.querySelectorAll('li').length}}
byId('run').onclick=async()=>{
 const fixture=fixtures.find(f=>f.name===byId('fixture').value),operation=byId('operation').value
 for(const el of document.querySelectorAll('select,button'))el.disabled=true
 try{
  for(let round=0;round<4;round++){
   byId('status').textContent=`Running ${fixture.name} / ${operation}, ${round===0?'warmup':`sample ${round}`}`
   source.replaceChildren();attributes.replaceChildren()
   if(operation!=='render')renderTextSource(source,fixture.node,operation==='restore'?range:undefined)
   // Preparation is outside the measurement; allow its task and frames to settle.
   await frame();await frame();await delay(180)
   const visibilityStart=document.visibilityState,start=performance.now()
   if(operation==='attributes')attributes.append(renderMarkDescriptions(fixture.node,0))
   else renderTextSource(source,fixture.node,operation==='half'?range:operation==='small'?{from:3001,to:3002,start:1,label:'selection'}:undefined)
   const methodEnd=performance.now(),raf1=await frame(),raf2=await frame(),windowEnd=performance.now()
   await delay(180)
   const row={fixture:fixture.name,operation,round,warmup:round===0,utf16:length,runs:fixture.node.childCount,visibilityStart,visibilityEnd:document.visibilityState,start,methodEnd,windowEnd,methodMs:methodEnd-start,firstRafMs:raf1-start,secondRafMs:raf2-start,longTasks:supported?tasks.filter(t=>t.start<windowEnd&&t.start+t.duration>start):null,counts:counts(),sourcePreserved:source.textContent===text}
   if(!row.sourcePreserved)throw Error('Source text mismatch')
   observations.push(row)
  }
  const measured=observations.slice(-3),median=key=>measured.map(r=>r[key]).sort((a,b)=>a-b)[1]
  byId('summary').textContent=JSON.stringify({fixture:fixture.name,operation,samples:3,methodMedianMs:median('methodMs'),firstRafMedianMs:median('firstRafMs'),secondRafMedianMs:median('secondRafMs'),counts:measured[0].counts},null,2)
  byId('status').textContent='Complete; raw samples retained. Choose another operation or fixture.'
 }catch(error){byId('status').textContent=`Measurement failed: ${error.message}`}
 finally{byId('raw').textContent=JSON.stringify(window.densityResult,null,2);for(const el of document.querySelectorAll('select,button'))el.disabled=false}
}
