import samples from '../table-review/samples.json'
import {createTableReview} from './table-review-controller.js'
import './tables-demo.css'
const select = /** @type {HTMLSelectElement} */ (document.getElementById('scenario'))
const budget = /** @type {HTMLSelectElement} */ (document.getElementById('budget'))
const invalid = structuredClone(samples[0])
invalid.name = 'invalid-grid'
const invalidRow = invalid.before.content[1].content[0]
if ('content' in invalidRow) invalidRow.content.pop()
const examples = [...samples,{name:'identical',before:samples[0].before,after:samples[0].before},invalid]
for(const sample of examples) {
  const option=document.createElement('option');option.value=sample.name;option.textContent=sample.name.replaceAll('-',' ')
  select.append(option)
}
const review=createTableReview(document.getElementById('table-review'))
const load=()=>review.load(examples.find(sample=>sample.name===select.value),{maxDepth:4,maxCells:Number(budget.value)})
select.onchange=budget.onchange=load
window.addEventListener('pagehide',()=>review.dispose(),{once:true})
load()
