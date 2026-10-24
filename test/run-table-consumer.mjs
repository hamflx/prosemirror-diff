import {execFileSync} from 'node:child_process'
import {cpSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const npm=process.argv[2]||process.env.npm_execpath
if(!npm) throw new Error('Pass the absolute path to npm-cli.js')
execFileSync(process.execPath,['example/table-snapshots/setup.mjs',resolve(npm)],{cwd:root,stdio:['ignore','inherit','inherit']})
const cell=resolve(root,'logs/table-consumer')
mkdirSync(resolve(cell,'test'),{recursive:true})
cpSync(resolve(root,'test/table-consumer.mjs'),resolve(cell,'test/table-consumer.mjs'))
const result=execFileSync(process.execPath,['test/table-consumer.mjs'],{cwd:cell,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','inherit']})
writeFileSync(resolve(cell,'result.json'),result)
console.log(result)
