import {compareDocumentMetadata} from '../../src/metadata.js'

// Compare plain detached metadata by value, including absent vs undefined keys.
function equal(a, b) {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && a.length !== b.length) return false
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every(key =>
    Object.hasOwn(b, key) && equal(a[key], b[key]))
}

/**
 * Example-only whole-document metadata review policy. Raw records are retained.
 * @param {import('prosemirror-model').Node} before
 * @param {import('prosemirror-model').Node} after
 * @param {string[]} [ignoredMarks]
 * @returns {import('./annotation-policy.mjs').AnnotationReview}
 */
export function reviewAnnotations(before, after, ignoredMarks = []) {
  if (!before?.type?.schema || !after?.type?.schema || before.type.schema !== after.type.schema ||
      before.type !== before.type.schema.topNodeType || after.type !== after.type.schema.topNodeType) {
    throw new TypeError('Expected document roots from the same schema instance')
  }
  if (!Array.isArray(ignoredMarks)) throw new TypeError('ignoredMarks must be an array')
  const names = [...ignoredMarks]
  if (names.some(name => typeof name !== 'string' ||
      !Object.hasOwn(before.type.schema.marks, name)) || new Set(names).size !== names.length) {
    throw new TypeError('ignoredMarks must contain distinct mark names defined by the schema')
  }
  const failed = reason => ({coverage: /** @type {const} */ ('unavailable'), reason,
    ignoredMarks: names, hiddenRecordIndices: [], visibleRecordIndices: []})
  // Bound admitted model size, not attribute bytes, execution time or memory.
  // Iterative traversal avoids adding our own recursive admission stack.
  let nodes = 0, text = 0
  for (const root of [before, after]) {
    const stack = [root]
    while (stack.length) {
      const node = stack.pop()
      if (++nodes > 20000 || (text += node.isText ? node.nodeSize : 0) > 100000) {
        return failed('Model admission limit exceeded; no metadata records classified')
      }
      // Refuse before allocating a stack proportional to a huge child list.
      if (nodes + stack.length + node.childCount > 20000) return failed('Model admission limit exceeded; no metadata records classified')
      for (let i = node.childCount - 1; i >= 0; i--) stack.push(node.child(i))
    }
  }
  let records
  try { records = compareDocumentMetadata(before, after) }
  catch { return failed('Metadata comparison failed or text/structure differs; no records classified') }
  const hiddenRecordIndices = [], visibleRecordIndices = []
  records.forEach((record, i) => {
    const hidden = record.kind === 'marks' && names.length > 0 && equal(
      record.before.filter(mark => !names.includes(mark.type)),
      record.after.filter(mark => !names.includes(mark.type)))
    ;(hidden ? hiddenRecordIndices : visibleRecordIndices).push(i)
  })
  return {coverage: 'metadata', ignoredMarks: names, records, hiddenRecordIndices, visibleRecordIndices,
    classification: records.length === 0 ? 'unchanged' : visibleRecordIndices.length === 0 ? 'annotation-only' : 'visible'}
}
