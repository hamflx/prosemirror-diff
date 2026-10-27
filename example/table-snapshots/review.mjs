import {reviewDocuments} from '../headless/model-review.mjs'
import {loadSnapshot, preflight, limits} from './schema.mjs'
export function reviewTables(beforeJSON, afterJSON, eventPath, options={maxDepth:4,maxCells:100000}, consumerOptions={formatting:false}) {
  const before=loadSnapshot(beforeJSON,'before'), after=loadSnapshot(afterJSON,'after')
  const validation=preflight(before,after)
  return {...reviewDocuments(before.doc,after.doc,eventPath,options,consumerOptions),format:'official-table-snapshot-review-v1',
    tableValidation:{...validation,limits,positionConvention:'table outer positions are document positions; problem.pos is relative to table content. Problems without pos retain their original row/n fields.'}}
}
