import {reviewTables} from '../table-snapshots/review.mjs'
import {parseTableInputs} from './table-json-input.js'
self.onmessage = ({data}) => {
  try {
    const pair=data.json ? parseTableInputs(data.json.before,data.json.after) : data
    self.postMessage({ok:true,report:reviewTables(pair.before,pair.after,undefined,data.options)})
  }
  catch (error) { self.postMessage({ok:false,error:error instanceof Error ? error.message : 'Invalid snapshot pair'}) }
}
