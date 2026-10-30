// @vitest-environment jsdom
import {test,expect,vi} from 'vitest'
import html from '../example/lab.html?raw'
test('same-document navigation retains seven capabilities and disposes pending Workers',async()=>{
 document.body.innerHTML=new DOMParser().parseFromString(html,'text/html').body.innerHTML
 const workers=[]
 class WorkerStub {constructor(){workers.push(this)}postMessage(){}terminate(){this.terminated=true}}
 vi.stubGlobal('Worker',WorkerStub)
 const go=hash=>{history.replaceState(null,'',hash);window.dispatchEvent(new HashChangeEvent('hashchange'))}
 history.replaceState(null,'','#home')
 await import('../example/src/showcase.js')
 expect(document.querySelector('#home').hidden).toBe(false)
 go('#docs');expect(document.querySelector('#docs').hidden).toBe(false)
 go('#examples/aligned');expect(document.querySelectorAll('.aligned-pane')).toHaveLength(2)
 expect(document.querySelectorAll('#navigation a')).toHaveLength(7)
 go('#examples/attributes')
 const read=()=>JSON.parse(document.querySelector('#workspace > pre').textContent)
 expect(read().events).toHaveLength(0)
 expect(document.querySelector('.split').textContent).toContain('old-id')
 expect(document.querySelector('.split').textContent).toContain('new-id')
 const input=document.querySelector('input[aria-label]');input.value='';input.dispatchEvent(new Event('input'))
 expect(read().events).toHaveLength(1)
 go('#examples/blocks');expect(document.querySelector('#scenario').options.length).toBeGreaterThan(1)
 const scenarioNode=document.querySelector('#scenario');const scroll=vi.fn();document.querySelector('#main').scrollIntoView=scroll
 document.querySelector('.skip').click();expect(location.hash).toBe('#examples/blocks');expect(document.querySelector('#scenario')).toBe(scenarioNode);expect(document.activeElement.id).toBe('main');expect(scroll).toHaveBeenCalled()
 go('#examples/metadata');expect(document.querySelector('#status').textContent).toContain('Change 1 of 3')
 go('#examples/tables');expect(workers.length).toBeGreaterThan(0)
 const pending=workers.at(-1)
 go('#examples/legacy');expect(pending.terminated).toBe(true)
 expect(document.querySelector('#comparison-status').textContent).toContain('available')
 go('#examples/integration');expect(read().format).toBe('fixed-schema-snapshot-review-v1')
 expect(read().selected.coverage).toBe('text-only-partial')
 const policy=()=>JSON.parse(document.querySelectorAll('#workspace > pre')[1].textContent)
 const checks=document.querySelectorAll('#workspace input[type=checkbox]')
 checks[1].checked=true;checks[1].dispatchEvent(new Event('change'))
 expect(policy().hiddenRecordIndices).toHaveLength(1)
 checks[2].checked=true;checks[2].dispatchEvent(new Event('change'))
 expect(policy().coverage).toBe('unavailable')
 go('#examples/metadata');expect(document.querySelector('#scenario').options.length).toBe(7)
 go('#examples/metadata');expect(document.querySelector('#scenario').options.length).toBe(7)
 expect(document.querySelector('iframe')).toBeNull()
 go('#home');expect(document.querySelector('#workspace').children).toHaveLength(0)
 window.dispatchEvent(new Event('pagehide'));vi.unstubAllGlobals()
})

test('a direct example URL mounts on startup and resumes after page cache restoration',async()=>{
 vi.resetModules()
 document.body.innerHTML=new DOMParser().parseFromString(html,'text/html').body.innerHTML
 history.replaceState(null,'','#examples/metadata')
 await import('../example/src/showcase.js')
 expect(document.querySelector('#status').textContent).toContain('Change 1 of 3')
 expect(document.querySelector('#site-navigation a[aria-current=page]').textContent).toBe('示例')
 const leaving=new Event('pagehide');Object.defineProperty(leaving,'persisted',{value:true});window.dispatchEvent(leaving)
 const returning=new Event('pageshow');Object.defineProperty(returning,'persisted',{value:true});window.dispatchEvent(returning)
 expect(document.querySelector('#scenario').options.length).toBe(7)
 history.replaceState(null,'','#examples/unknown');window.dispatchEvent(new HashChangeEvent('hashchange'))
 expect(document.querySelectorAll('.aligned-pane')).toHaveLength(2)
 window.dispatchEvent(new Event('pagehide'))
})
