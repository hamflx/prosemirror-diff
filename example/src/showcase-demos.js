import blocksTemplate from '../blocks.html?raw'
import metadataTemplate from '../metadata.html?raw'
import tablesTemplate from '../tables.html?raw'
import legacyTemplate from '../legacy.html?raw'
import {mountBlocksDemo} from './blocks-demo.js'
import {mountMetadataDemo} from './metadata-demo.js'
import {mountTablesDemo} from './tables-demo.js'
import {mountLegacyDemo} from './legacy-migration-demo.js'

/** @type {Record<string, [string, (root: HTMLElement) => {dispose(): void}, string]>} */
const demos={
  'blocks.html':[blocksTemplate,mountBlocksDemo,'blocks'],
  'metadata.html':[metadataTemplate,mountMetadataDemo,'metadata'],
  'tables.html':[tablesTemplate,mountTablesDemo,'tables'],
  'legacy.html':[legacyTemplate,mountLegacyDemo,'legacy']
}
// Templates are bundled project markup, never user-supplied HTML.
export function mountShowcaseDemo(host,url){
  const [template,mount,name]=demos[url]
  const parsed=new DOMParser().parseFromString(template,'text/html')
  const root=document.createElement('section')
  root.className=`demo-surface demo-${name} capability-demo`
  const content=document.createElement('div');content.className='demo-content'
  content.id=parsed.querySelector('main').id
  content.append(...Array.from(parsed.querySelector('main').childNodes))
  root.append(content);host.append(root)
  const view=mount(root)
  return ()=>{view.dispose();root.remove()}
}
