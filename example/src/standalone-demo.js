export function mountStandaloneDemo(mount){
  const root=document.body
  const template=[...root.childNodes].filter(node=>node.nodeName!=='SCRIPT').map(node=>node.cloneNode(true))
  let view=mount(root)
  const resume=event=>{if(event.persisted){root.replaceChildren(...template.map(node=>node.cloneNode(true)));view=mount(root)}}
  const leave=event=>{view.dispose();if(!event.persisted){window.removeEventListener('pageshow',resume);window.removeEventListener('pagehide',leave)}}
  window.addEventListener('pageshow',resume);window.addEventListener('pagehide',leave)
}
