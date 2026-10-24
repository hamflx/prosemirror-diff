// A directory of retained report events, not a fresh comparison or schema check.
export const directoryLimits = Object.freeze({fileBytes: 8 * 1024 * 1024, entries: 10000, depth: 32})
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const integer = value => Number.isSafeInteger(value) && value >= 0
function requireValue(condition, reason) {
  if (!condition) throw new TypeError('Invalid saved report: ' + reason)
}
export function eventDirectory(report) {
  requireValue(object(report), 'expected an object')
  requireValue(['fixed-schema-snapshot-review-v1', 'official-table-snapshot-review-v1'].includes(report.format), 'unsupported format')
  requireValue(typeof report.equal === 'boolean' && report.coverage === 'block-tree', 'equal/coverage')
  requireValue(object(report.snapshots) && object(report.snapshots.before) && object(report.snapshots.after), 'snapshots context')
  requireValue(object(report.options) && integer(report.options.maxDepth) && report.options.maxDepth <= 32 && integer(report.options.maxCells) && report.options.maxCells <= 1000000, 'options')
  const entries = []
  function visit(layer, prefix, parent) {
    requireValue(object(layer) && Array.isArray(layer.changes) && typeof layer.fallback === 'boolean', 'layer')
    if (parent) {
      requireValue(typeof layer.truncated === 'boolean', 'details.truncated')
      requireValue(!layer.truncated || (layer.changes.length === 0 && !layer.fallback), 'truncated details must have no children or fallback')
    }
    let oldEnd = 0, newEnd = 0
    for (let index = 0; index < layer.changes.length; index++) {
      requireValue(prefix.length <= directoryLimits.depth, 'directory depth limit')
      const change = layer.changes[index]
      requireValue(object(change) && ['insert', 'delete', 'replace'].includes(change.kind), 'event kind')
      for (const key of ['oldFrom', 'oldTo', 'newFrom', 'newTo']) requireValue(integer(change[key]), 'event position')
      requireValue(change.oldFrom <= change.oldTo && change.newFrom <= change.newTo, 'reversed range')
      requireValue(change.oldFrom >= oldEnd && change.newFrom >= newEnd, 'unordered or overlapping events')
      oldEnd = change.oldTo; newEnd = change.newTo
      if (parent) requireValue(change.oldFrom > parent.oldFrom && change.oldTo < parent.oldTo && change.newFrom > parent.newFrom && change.newTo < parent.newTo, 'details outside parent content')
      for (const key of ['before', 'after']) requireValue(Array.isArray(change[key]) && change[key].every(node => object(node) && typeof node.type === 'string' && node.type.length > 0), 'event node types')
      const beforeEmpty = change.before.length === 0, afterEmpty = change.after.length === 0
      requireValue(beforeEmpty === (change.oldFrom === change.oldTo) && afterEmpty === (change.newFrom === change.newTo), 'range/node count mismatch')
      requireValue(change.kind === 'insert' ? beforeEmpty && !afterEmpty : change.kind === 'delete' ? !beforeEmpty && afterEmpty : !beforeEmpty && !afterEmpty, 'kind/range mismatch')
      const path = [...prefix, index]
      requireValue(entries.length < directoryLimits.entries, 'directory entry limit')
      const hasDetails = Object.hasOwn(change, 'details')
      if (hasDetails) requireValue(change.kind === 'replace' && change.before.length === 1 && change.after.length === 1 && object(change.details), 'details require a one-to-one replacement')
      entries.push({path: path.join('.'), depth: prefix.length, kind: change.kind,
        old: {from: change.oldFrom, to: change.oldTo, count: change.before.length, nodeTypes: change.before.map(node => node.type)},
        new: {from: change.newFrom, to: change.newTo, count: change.after.length, nodeTypes: change.after.map(node => node.type)},
        layerFallback: layer.fallback,
        details: hasDetails ? {present: true, childCount: change.details.changes?.length, truncated: change.details.truncated, fallback: change.details.fallback} : {present: false}})
      if (hasDetails) visit(change.details, path, change)
    }
  }
  visit(report.blocks, [], null)
  return {format: 'snapshot-event-directory-v1', reportFormat: report.format, equal: report.equal,
    rootFallback: report.blocks.fallback, options: {maxDepth: report.options.maxDepth, maxCells: report.options.maxCells},
    coordinates: 'Original half-open ProseMirror positions (text uses UTF-16). Paths are zero-based and valid only for the same report, snapshots and options; not node identities.',
    coverage: 'Retained parent and nested events, not an additive edit count. No comparison or schema/grid revalidation performed.', entries}
}
