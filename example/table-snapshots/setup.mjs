// Explicit network/setup step. The installed CLI performs no installation.
import {execFileSync} from 'node:child_process'
import {cpSync,mkdirSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const npm=process.argv[2]||process.env.npm_execpath
if(!npm) throw new Error('Pass the absolute path to npm-cli.js')
const runtime=resolve(root,'logs/table-consumer')
mkdirSync(runtime,{recursive:true})
for(const name of ['package.json','package-lock.json']) cpSync(resolve(root,'test/tables-runtime',name),resolve(runtime,name))
execFileSync(process.execPath,[resolve(npm),'ci','--ignore-scripts','--no-audit','--no-fund'],{cwd:runtime,stdio:'inherit'})
cpSync(resolve(root,'index.d.ts'),resolve(runtime,'index.d.ts'))
for(const folder of ['src','example/headless','example/table-snapshots']) cpSync(resolve(root,folder),resolve(runtime,folder),{recursive:true})
mkdirSync(resolve(runtime,'example/src'),{recursive:true})
for(const file of ['text-review.js','text-mark-support.js']) cpSync(resolve(root,'example/src',file),resolve(runtime,'example/src',file))
console.log('Offline CLI ready: '+resolve(runtime,'example/table-snapshots/cli.mjs'))
