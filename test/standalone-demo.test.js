// @vitest-environment jsdom
import {it,expect,vi} from 'vitest'
import {mountStandaloneDemo} from '../example/src/standalone-demo.js'
it('restores a standalone example after cached navigation without rerunning script elements',()=>{
 document.body.innerHTML='<main><select><option>one</option></select></main><script type="module" src="unused.js"></script>'
 const dispose=vi.fn(()=>document.body.replaceChildren()),mount=vi.fn(()=>({dispose}))
 mountStandaloneDemo(mount)
 const hide=new Event('pagehide');Object.defineProperty(hide,'persisted',{value:true});window.dispatchEvent(hide)
 expect(dispose).toHaveBeenCalledTimes(1);expect(document.body.children).toHaveLength(0)
 const show=new Event('pageshow');Object.defineProperty(show,'persisted',{value:true});window.dispatchEvent(show)
 expect(mount).toHaveBeenCalledTimes(2);expect(document.querySelectorAll('select option')).toHaveLength(1);expect(document.querySelector('script')).toBeNull()
 window.dispatchEvent(new Event('pagehide'));window.dispatchEvent(show);expect(mount).toHaveBeenCalledTimes(2)
})
