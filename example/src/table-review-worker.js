import {reviewTables} from '../table-snapshots/review.mjs'
import {parseTableInputs} from './table-json-input.js'
self.onmessage = ({data}) => {
  try {
    const pair=data.json ? parseTableInputs(data.json.before,data.json.after) : data
    const report = reviewTables(pair.before,pair.after,data.kind === 'metadata' ? data.eventPath : undefined,data.options)
    self.postMessage(data.kind === 'metadata' ? {ok:true,selected:report.selected} : {ok:true,report})
  }
  catch (error) { self.postMessage({ok:false,error:error instanceof Error ? error.message : 'Invalid snapshot pair'}) }
}
