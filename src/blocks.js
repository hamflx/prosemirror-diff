import {ignoredAttributes, blockComparator} from './attribute-filter.js'
/** @typedef {import('prosemirror-model').Node} Node */
/** @typedef {{ignoredAttributes: string[]}} ComparisonPolicy */
/** @typedef {{changes: BlockChange[], fallback: boolean, truncated: boolean, comparison?: ComparisonPolicy}} BlockDetails */
/** @typedef {{kind: 'insert'|'delete'|'replace', oldFrom: number, oldTo: number, newFrom: number, newTo: number, before: Node[], after: Node[], details?: BlockDetails}} BlockChange */

/**
 * Compare top-level blocks without constructing a mixed document.
 * Nodes in before/after are shared immutable ProseMirror values, not JSON copies.
 * Equal blocks anchor a longest common subsequence. Ties consume the old block
 * first; this is a positional correspondence, not identity or move detection.
 * @param {Node} oldDoc
 * @param {Node} newDoc
 * @param {{maxCells?: number, maxDepth?: number, ignoreAttributes?: readonly string[]}} [options]
 * @returns {{changes: BlockChange[], fallback: boolean, comparison?: ComparisonPolicy}}
 */
export function compareDocumentBlocks(oldDoc, newDoc, options = {}) {
  const ignored = ignoredAttributes(options)
  const comparator = ignored.size ? blockComparator(ignored) : {
    equal: (a, b) => a.eq(b), sameMarkup: (a, b) => a.sameMarkup(b)
  }
  const comparison = ignored.size ? {ignoredAttributes: [...ignored]} : undefined
  if (!oldDoc || !newDoc || oldDoc.type?.schema?.topNodeType !== oldDoc.type ||
      newDoc.type?.schema?.topNodeType !== newDoc.type ||
      typeof oldDoc.check !== 'function' || typeof newDoc.check !== 'function') {
    throw new TypeError('Expected ProseMirror document nodes')
  }
  if (oldDoc.type.schema !== newDoc.type.schema) throw new TypeError('Documents must use the same schema instance')
  oldDoc.check()
  newDoc.check()
  if (!comparator.sameMarkup(oldDoc, newDoc)) throw new RangeError('Block comparison requires identical document-level markup')
  const maxCells = options.maxCells === undefined ? 100000 : options.maxCells
  if (!Number.isInteger(maxCells) || maxCells < 0 || maxCells > 1000000) {
    throw new RangeError('maxCells must be an integer from 0 through 1000000')
  }
  const maxDepth = options.maxDepth === undefined ? 0 : options.maxDepth
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 32) {
    throw new RangeError('maxDepth must be an integer from 0 through 32')
  }
  const budget = {remaining: maxCells}
  const result = compareChildren(oldDoc, newDoc, 0, 0, budget, comparator.equal, comparison)
  // Keep the default output shape and avoid walking results unless requested.
  if (maxDepth > 0) addDetails(result, maxDepth, budget, comparator, comparison)
  return result
}

/** @param {Node} node */
const blockContainer = node => {
  if (node.isAtom || node.isLeaf || node.inlineContent) return false
  for (let i = 0; i < node.childCount; i++) if (!node.child(i).isBlock) return false
  return true
}

/**
 * Details describe content correspondence, not node identity or transactions.
 * Preserve the complete parent event even when deeper details are unavailable.
 * @param {{changes: BlockChange[], fallback: boolean}} result
 * @param {number} depth
 * @param {{remaining: number}} budget
 */
function addDetails(result, depth, budget, comparator, comparison) {
  // A coarse layer has not established useful anchors; do not refine its gaps.
  if (result.fallback) return
  for (const change of result.changes) {
    if (change.kind !== 'replace' || change.before.length !== 1 || change.after.length !== 1) continue
    const old = change.before[0], next = change.after[0]
    if (!comparator.sameMarkup(old, next) || !blockContainer(old) || !blockContainer(next)) continue
    if (depth === 0) {
      change.details = {changes: [], fallback: false, truncated: true, ...(comparison ? {comparison} : {})}
      continue
    }
    const children = compareChildren(old, next, change.oldFrom + 1, change.newFrom + 1, budget, comparator.equal, comparison)
    change.details = {...children, truncated: false}
    addDetails(children, depth - 1, budget, comparator, comparison)
  }
}

/**
 * Align child blocks in one layer. All layers debit the same matrix budget.
 * @param {Node} oldDoc
 * @param {Node} newDoc
 * @param {number} oldOffset
 * @param {number} newOffset
 * @param {{remaining: number}} budget
 * @param {(a: Node, b: Node) => boolean} equal
 * @param {ComparisonPolicy|undefined} comparison
 * @returns {{changes: BlockChange[], fallback: boolean, comparison?: ComparisonPolicy}}
 */
function compareChildren(oldDoc, newDoc, oldOffset, newOffset, budget, equal, comparison) {
  const finish = (changes, fallback) => ({changes, fallback, ...(comparison ? {comparison} : {})})
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
  while (start < oldEnd && start < newEnd && equal(old.nodes[start], next.nodes[start])) start++
  while (oldEnd > start && newEnd > start && equal(old.nodes[oldEnd - 1], next.nodes[newEnd - 1])) {
    oldEnd--
    newEnd--
  }
  /** @type {BlockChange[]} */
  const changes = []
  const emit = (oldStart, oldTo, newStart, newTo) => {
    if (oldStart === oldTo && newStart === newTo) return
    changes.push({
      kind: oldStart === oldTo ? 'insert' : newStart === newTo ? 'delete' : 'replace',
      oldFrom: oldOffset + old.positions[oldStart], oldTo: oldOffset + old.positions[oldTo],
      newFrom: newOffset + next.positions[newStart], newTo: newOffset + next.positions[newTo],
      before: old.nodes.slice(oldStart, oldTo), after: next.nodes.slice(newStart, newTo)
    })
  }
  const rows = oldEnd - start, columns = newEnd - start
  if (!rows || !columns) {
    emit(start, oldEnd, start, newEnd)
    return finish(changes, false)
  }
  // Bound matrix allocation and equality comparisons, not total elapsed time.
  // Validation, equality of large subtrees, prefix/suffix and output are extra.
  const cells = (rows + 1) * (columns + 1)
  if (cells > budget.remaining) {
    emit(start, oldEnd, start, newEnd)
    return finish(changes, true)
  }
  budget.remaining -= cells
  const width = columns + 1
  const scores = new Uint32Array((rows + 1) * width)
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = columns - 1; j >= 0; j--) {
      scores[i * width + j] = equal(old.nodes[start + i], next.nodes[start + j])
        ? 1 + scores[(i + 1) * width + j + 1]
        : Math.max(scores[(i + 1) * width + j], scores[i * width + j + 1])
    }
  }
  let i = 0, j = 0, oldGap = start, newGap = start
  while (i < rows && j < columns) {
    if (equal(old.nodes[start + i], next.nodes[start + j])) {
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
  return finish(changes, false)
}
