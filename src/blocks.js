/** @typedef {import('prosemirror-model').Node} Node */
/** @typedef {{kind: 'insert'|'delete'|'replace', oldFrom: number, oldTo: number, newFrom: number, newTo: number, before: Node[], after: Node[]}} BlockChange */

/**
 * Compare top-level blocks without constructing a mixed document.
 * Nodes in before/after are shared immutable ProseMirror values, not JSON copies.
 * Equal blocks anchor a longest common subsequence. Ties consume the old block
 * first; this is a positional correspondence, not identity or move detection.
 * @param {Node} oldDoc
 * @param {Node} newDoc
 * @param {{maxCells?: number}} [options]
 * @returns {{changes: BlockChange[], fallback: boolean}}
 */
export function compareDocumentBlocks(oldDoc, newDoc, options = {}) {
  if (!oldDoc || !newDoc || oldDoc.type?.schema?.topNodeType !== oldDoc.type ||
      newDoc.type?.schema?.topNodeType !== newDoc.type ||
      typeof oldDoc.check !== 'function' || typeof newDoc.check !== 'function') {
    throw new TypeError('Expected ProseMirror document nodes')
  }
  if (oldDoc.type.schema !== newDoc.type.schema) throw new TypeError('Documents must use the same schema instance')
  oldDoc.check()
  newDoc.check()
  if (!oldDoc.sameMarkup(newDoc)) throw new RangeError('Block comparison requires identical document-level markup')
  const maxCells = options.maxCells === undefined ? 100000 : options.maxCells
  if (!Number.isInteger(maxCells) || maxCells < 0 || maxCells > 1000000) {
    throw new RangeError('maxCells must be an integer from 0 through 1000000')
  }
  /** @param {Node} doc */
  const collect = doc => {
    /** @type {Node[]} */
    const nodes = []
    const positions = [0]
    doc.forEach(node => {
      if (!node.isBlock) throw new RangeError('Block comparison requires top-level block children')
      nodes.push(node)
      positions.push(positions[positions.length - 1] + node.nodeSize)
    })
    return {nodes, positions}
  }
  const old = collect(oldDoc), next = collect(newDoc)
  let start = 0, oldEnd = old.nodes.length, newEnd = next.nodes.length
  while (start < oldEnd && start < newEnd && old.nodes[start].eq(next.nodes[start])) start++
  while (oldEnd > start && newEnd > start && old.nodes[oldEnd - 1].eq(next.nodes[newEnd - 1])) {
    oldEnd--
    newEnd--
  }
  /** @type {BlockChange[]} */
  const changes = []
  const emit = (oldStart, oldTo, newStart, newTo) => {
    if (oldStart === oldTo && newStart === newTo) return
    changes.push({
      kind: oldStart === oldTo ? 'insert' : newStart === newTo ? 'delete' : 'replace',
      oldFrom: old.positions[oldStart], oldTo: old.positions[oldTo],
      newFrom: next.positions[newStart], newTo: next.positions[newTo],
      before: old.nodes.slice(oldStart, oldTo), after: next.nodes.slice(newStart, newTo)
    })
  }
  const rows = oldEnd - start, columns = newEnd - start
  if (!rows || !columns) {
    emit(start, oldEnd, start, newEnd)
    return {changes, fallback: false}
  }
  // Bound matrix allocation and equality comparisons, not total elapsed time.
  // Validation, equality of large subtrees, prefix/suffix and output are extra.
  if ((rows + 1) * (columns + 1) > maxCells) {
    emit(start, oldEnd, start, newEnd)
    return {changes, fallback: true}
  }
  const width = columns + 1
  const scores = new Uint32Array((rows + 1) * width)
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = columns - 1; j >= 0; j--) {
      scores[i * width + j] = old.nodes[start + i].eq(next.nodes[start + j])
        ? 1 + scores[(i + 1) * width + j + 1]
        : Math.max(scores[(i + 1) * width + j], scores[i * width + j + 1])
    }
  }
  let i = 0, j = 0, oldGap = start, newGap = start
  while (i < rows && j < columns) {
    if (old.nodes[start + i].eq(next.nodes[start + j])) {
      emit(oldGap, start + i, newGap, start + j)
      oldGap = start + ++i
      newGap = start + ++j
    } else if (scores[(i + 1) * width + j] >= scores[i * width + j + 1]) {
      i++
    } else {
      j++
    }
  }
  emit(oldGap, oldEnd, newGap, newEnd)
  return {changes, fallback: false}
}
