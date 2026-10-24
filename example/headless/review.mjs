import {readSnapshot} from './schema.mjs'
import {reviewDocuments} from './model-review.mjs'
export {parseEventPath, refineSelected} from './model-review.mjs'

// Preserve the original fixed-schema consumer contract.
export function reviewSnapshots(oldJSON, newJSON, eventPath, options = {maxDepth: 2, maxCells: 100000}) {
  return reviewDocuments(readSnapshot(oldJSON), readSnapshot(newJSON), eventPath, options)
}
