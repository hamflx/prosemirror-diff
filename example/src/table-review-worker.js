import {schema} from '../table-snapshots/schema.mjs'
import {equalBlockAnchors} from './paired-layout.js'
import {reviewTables} from '../table-snapshots/review.mjs'
import {parseTableInputs} from './table-json-input.js'
self.onmessage = ({data}) => {
  try {
    const pair=data.json ? parseTableInputs(data.json.before,data.json.after) : data
    const report = reviewTables(pair.before,pair.after,data.kind === 'metadata' ? data.eventPath : undefined,data.options)
    self.postMessage(data.kind === 'metadata' ? {ok:true,selected:report.selected} : {ok:true,report,anchors:equalBlockAnchors(schema.nodeFromJSON(pair.before),schema.nodeFromJSON(pair.after))})
  }
  catch (error) { self.postMessage({ok:false,error:error instanceof Error ? error.message : 'Invalid snapshot pair'}) }
}
