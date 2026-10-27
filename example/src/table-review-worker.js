import {reviewTables} from '../table-snapshots/review.mjs'
self.onmessage = ({data}) => {
  try { self.postMessage({ok:true,report:reviewTables(data.before,data.after,undefined,data.options)}) }
  catch (error) { self.postMessage({ok:false,error:error instanceof Error ? error.message : 'Invalid snapshot pair'}) }
}
