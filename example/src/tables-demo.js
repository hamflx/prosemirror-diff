import samples from '../table-review/samples.json'
import {createTableReview} from './table-review-controller.js'
import './tables-demo.css'
const select = /** @type {HTMLSelectElement} */ (document.getElementById('scenario'))
const budget = /** @type {HTMLSelectElement} */ (document.getElementById('budget'))
const beforeInput = /** @type {HTMLTextAreaElement} */ (document.getElementById('before-json'))
const afterInput = /** @type {HTMLTextAreaElement} */ (document.getElementById('after-json'))
beforeInput.value=JSON.stringify(samples[0].before,null,2)
afterInput.value=JSON.stringify(samples[0].after,null,2)
const invalid = structuredClone(samples[0])
invalid.name = 'invalid-grid'
const invalidRow = invalid.before.content[1].content[0]
if ('content' in invalidRow) invalidRow.content.pop()
const examples = [...samples,{name:'identical',before:samples[0].before,after:samples[0].before},invalid]
for(const sample of examples) {
  const option=document.createElement('option');option.value=sample.name;option.textContent=sample.name.replaceAll('-',' ')
  select.append(option)
}
const localOption=document.createElement('option');localOption.value='local-json';localOption.textContent='Local JSON inputs';select.append(localOption)
const review=createTableReview(document.getElementById('table-review'))
const load=()=>{
  const options={maxDepth:4,maxCells:Number(budget.value)}
  if(select.value==='local-json')review.loadJSON(beforeInput.value,afterInput.value,options)
  else review.load(examples.find(sample=>sample.name===select.value),options)
}
beforeInput.oninput=afterInput.oninput=()=>{select.value='local-json';review.cancel()}
document.getElementById('compare-json').onclick=()=>{select.value='local-json';load()}
select.onchange=budget.onchange=load
window.addEventListener('pagehide',()=>review.dispose(),{once:true})
load()
