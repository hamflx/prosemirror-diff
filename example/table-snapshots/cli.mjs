import {open} from 'node:fs/promises'
import {reviewTables} from './review.mjs'
import {limits, SnapshotError} from './schema.mjs'
async function input(path,side) {
  let handle
  try {
    handle=await open(path,'r')
    if((await handle.stat()).size>limits.fileBytes) throw new SnapshotError(side,null,'file-budget')
    // Bounded reads also handle a file that grows after stat without readFile's
    // unbounded allocation. UTF-8 and JSON are checked before constructing nodes.
    const buffer=Buffer.alloc(limits.fileBytes+1)
    let count=0
    while(count<buffer.length) {
      const {bytesRead}=await handle.read(buffer,count,buffer.length-count,null)
      if(!bytesRead) break
      count+=bytesRead
    }
    if(count>limits.fileBytes) throw new SnapshotError(side,null,'file-budget')
    try { return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,count))) }
    catch { throw new SnapshotError(side,null,'json',{reason:'Expected valid UTF-8 JSON'}) }
  } catch(error) {
    if(error instanceof SnapshotError) throw error
    throw new SnapshotError(side,null,'file',{reason:'Cannot read input file'})
  } finally { await handle?.close() }
}
try {
  const args=process.argv.slice(2)
  const formatting=args.at(-1)==='--formatting'
  if(formatting) args.pop()
  if(formatting&&args.length!==3) throw new Error('--formatting requires an explicit event path')
  if(args.length<2||args.length>3) throw new Error('Usage: node cli.mjs BEFORE.json AFTER.json [ZERO_BASED_EVENT_PATH]')
  const before=await input(args[0],'before'),after=await input(args[1],'after')
  const report=JSON.stringify(reviewTables(before,after,args[2],undefined,{formatting}),null,2)
  process.stdout.write(report+'\n')
} catch(error) {
  process.stderr.write(JSON.stringify(error instanceof SnapshotError ? error.diagnostic : {problem:{type:'comparison',reason:error.message}})+'\n')
  process.exitCode=1
}
