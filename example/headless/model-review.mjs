import {compareDocumentBlocks} from '../../src/blocks.js'
import {compareNodeMetadata} from '../../src/metadata.js'
import {reviewTextChange} from '../src/text-review.js'
import {sourceFormatting} from '../src/source-formatting.js'

export function parseEventPath(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)(\.(0|[1-9]\d*))*$/.test(value)) {
    throw new RangeError('Event path must be zero-based integers separated by dots, for example 0.0')
  }
  const path = value.split('.').map(Number)
  if (!path.every(Number.isSafeInteger)) throw new RangeError('Event path index is too large')
  return path
}
function serializeLayer(layer) {
  return {...layer, changes: layer.changes.map(change => ({...change,
    before: change.before.map(node => node.toJSON()), after: change.after.map(node => node.toJSON()),
    ...(change.details ? {details: serializeLayer(change.details)} : {})
  }))}
}
function selectEvent(result, path) {
  let layer = result, change
  for (let i = 0; i < path.length; i++) {
    change = layer.changes[path[i]]
    if (!change) throw new RangeError('Event path does not exist in the retained comparison tree')
    if (i < path.length - 1) {
      if (!change.details || change.details.truncated) throw new RangeError('Event path descends into absent or depth-limited details')
      layer = change.details
    }
  }
  return change
}
export function refineSelected(change) {
  const unavailable = reason => ({coverage: 'unavailable', reason})
  if (change.kind !== 'replace' || change.before.length !== 1 || change.after.length !== 1) {
    return {coverage: 'block-only', reason: 'Refinement requires a selected one-to-one replacement. Complete parent event retained.'}
  }
  try {
    const records = compareNodeMetadata(change.before[0], change.after[0], {oldFrom: change.oldFrom, newFrom: change.newFrom})
    return {coverage: 'metadata', reason: 'Identical text and structure; metadata covers this selected node only, not the whole document.', records}
  } catch (error) {
    // This exact internal message is intentionally isolated here. Other validation
    // or snapshot errors must not become a misleading text-only result.
    if (!(error instanceof RangeError) || error.message !== 'Metadata comparison requires identical node structure and text') {
      return unavailable('Selected-node metadata validation or snapshot failed; no refinement result is claimed.')
    }
  }
  try {
    const text = reviewTextChange(change)
    if (!text.supported) return {coverage: 'block-only', reason: 'Metadata requires identical text and structure. ' + text.reason}
    return {coverage: 'text-only-partial',
      reason: 'Grapheme text correspondence only. Formatting is not independently compared; ranges do not establish character identity or edit history.',
      precision: 'May be coarse or nonminimal; the text algorithm does not expose fallback status.',
      ...text}
  } catch {
    return unavailable('Selected text refinement failed; complete parent event retained.')
  }
}

// Example helper, not a new library API. Options are useful for reproducible tests;
// the CLI intentionally fixes depth and cell budget rather than exposing a framework.
export function reviewDocuments(oldDoc, newDoc, eventPath, options = {maxDepth: 2, maxCells: 100000}, consumerOptions = {formatting: false}) {
  const result = compareDocumentBlocks(oldDoc, newDoc, options)
  const path = eventPath === undefined ? undefined : parseEventPath(eventPath)
  const selected = path ? {path, ...refineSelected(selectEvent(result, path))}
    : {coverage: 'not-selected', reason: 'No event selected. Choose a zero-based path from blocks.changes and nested details.changes.'}
  return {
    format: 'fixed-schema-snapshot-review-v1', equal: oldDoc.eq(newDoc),
    coverage: 'block-tree',
    reason: 'Complete parent events retained. Nested details are informational, not additional edits to accumulate or apply. Empty details do not imply equality.',
    coordinates: 'Half-open original ProseMirror positions; text positions use UTF-16 code units.',
    options: {maxDepth: options.maxDepth ?? 0, maxCells: options.maxCells ?? 100000},
    snapshots: {before: oldDoc.toJSON(), after: newDoc.toJSON()},
    blocks: serializeLayer(result), selected: consumerOptions.formatting === true ? {...selected, sourceFormatting: path
      ? sourceFormatting(selectEvent(result, path))
      : {kind: 'source-inventory', coverage: 'not-selected', reason: 'Select an event before requesting its source formatting inventory.'}} : selected
  }
}
