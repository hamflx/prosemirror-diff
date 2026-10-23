import {Node} from 'prosemirror-model'

const equalValue = (a, b) => {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && a.length !== b.length) return false
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(b, key) && equalValue(a[key], b[key]))
}

// Return detached data, without invoking custom serializers or sharing attrs.
const snapshot = (value, ancestors = new Set()) => {
  if (value === null || ['string', 'boolean', 'undefined'].includes(typeof value)) return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'object' || ancestors.has(value)) {
    throw new TypeError('Metadata must contain acyclic plain data')
  }
  const prototype = Object.getPrototypeOf(value)
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Metadata must contain acyclic plain data')
  }
  ancestors.add(value)
  const copy = Array.isArray(value)
    ? value.map(item => snapshot(item, ancestors))
    : Object.fromEntries(Object.keys(value).map(key => [key, snapshot(value[key], ancestors)]))
  ancestors.delete(value)
  return copy
}

const marksData = node => node.marks.map(mark => mark.toJSON())
const incompatible = () => { throw new RangeError('Metadata comparison requires identical node structure and text') }

/**
 * Compare metadata-only revisions of two documents from the same schema.
 * Returns detached attrs/marks records with half-open ProseMirror positions.
 * Structural/text edits are rejected, not heuristically paired.
 * @param {Node} oldDoc
 * @param {Node} newDoc
 */
export const compareDocumentMetadata = (oldDoc, newDoc) => {
  if (!oldDoc || !newDoc || oldDoc.type?.schema?.topNodeType !== oldDoc.type ||
      newDoc.type?.schema?.topNodeType !== newDoc.type ||
      typeof oldDoc.check !== 'function' || typeof newDoc.check !== 'function') {
    throw new TypeError('Expected ProseMirror document nodes')
  }
  if (oldDoc.type.schema !== newDoc.type.schema) {
    throw new TypeError('Documents must use the same schema instance')
  }
  oldDoc.check()
  newDoc.check()
  return compareMetadata(oldDoc, newDoc, 0, 0, true)
}

/**
 * Compare caller-selected non-text, non-document nodes with identical structure/text.
 * Offsets identify each node's outer start, not its content start.
 * @param {Node} oldNode
 * @param {Node} newNode
 * @param {{oldFrom?: number, newFrom?: number}} [options]
 */
export const compareNodeMetadata = (oldNode, newNode, {oldFrom = 0, newFrom = 0} = {}) => {
  for (const node of [oldNode, newNode]) {
    if (!node || !node.type?.schema || typeof node.check !== 'function') {
      throw new TypeError('Expected ProseMirror nodes')
    }
    if (node.isText) throw new TypeError('Direct text nodes are not supported; compare their parent node')
    if (node.type === node.type.schema.topNodeType) {
      throw new TypeError('Document roots require compareDocumentMetadata')
    }
  }
  if (oldNode.type.schema !== newNode.type.schema) {
    throw new TypeError('Nodes must use the same schema instance')
  }
  for (const {from, node} of [{from: oldFrom, node: oldNode}, {from: newFrom, node: newNode}]) {
    if (!Number.isSafeInteger(from) || from < 0 || !Number.isSafeInteger(from + node.nodeSize)) {
      throw new RangeError('Node ranges must use non-negative safe integer positions without overflow')
    }
  }
  oldNode.check()
  newNode.check()
  return compareMetadata(oldNode, newNode, oldFrom, newFrom, false)
}

const compareMetadata = (oldRoot, newRoot, oldFrom, newFrom, documentRoot) => {
  const changes = []
  const record = (kind, nodeType, oldFrom, oldTo, newFrom, newTo, before, after) => {
    // Snapshot before comparison also rejects cycles and unsupported values.
    before = snapshot(before)
    after = snapshot(after)
    if (!equalValue(before, after)) {
      changes.push({kind, nodeType, oldFrom, oldTo, newFrom, newTo, before, after})
    }
  }

  const compareText = (oldNodes, newNodes, oldStart, newStart) => {
    if (oldNodes.map(n => n.text).join('') !== newNodes.map(n => n.text).join('')) incompatible()
    let i = 0, j = 0, oldOffset = 0, newOffset = 0, offset = 0
    while (i < oldNodes.length && j < newNodes.length) {
      const oldNode = oldNodes[i], newNode = newNodes[j]
      const length = Math.min(oldNode.nodeSize - oldOffset, newNode.nodeSize - newOffset)
      record('marks', 'text', oldStart + offset, oldStart + offset + length,
        newStart + offset, newStart + offset + length, marksData(oldNode), marksData(newNode))
      oldOffset += length
      newOffset += length
      offset += length
      if (oldOffset === oldNode.nodeSize) { i++; oldOffset = 0 }
      if (newOffset === newNode.nodeSize) { j++; newOffset = 0 }
    }
    return offset
  }

  const visit = (oldNode, newNode, oldPos, newPos, root = false) => {
    if (oldNode.type !== newNode.type) incompatible()
    const oldEnd = oldPos + (root ? oldNode.content.size : oldNode.nodeSize)
    const newEnd = newPos + (root ? newNode.content.size : newNode.nodeSize)
    record('attrs', oldNode.type.name, oldPos, oldEnd, newPos, newEnd, oldNode.attrs, newNode.attrs)
    record('marks', oldNode.type.name, oldPos, oldEnd, newPos, newEnd, marksData(oldNode), marksData(newNode))
    let i = 0, j = 0
    let oldChildPos = oldPos + (root ? 0 : 1), newChildPos = newPos + (root ? 0 : 1)
    while (i < oldNode.childCount && j < newNode.childCount) {
      const a = oldNode.child(i), b = newNode.child(j)
      if (a.isText || b.isText) {
        if (!a.isText || !b.isText) incompatible()
        const oldRun = [], newRun = []
        while (i < oldNode.childCount && oldNode.child(i).isText) oldRun.push(oldNode.child(i++))
        while (j < newNode.childCount && newNode.child(j).isText) newRun.push(newNode.child(j++))
        const size = compareText(oldRun, newRun, oldChildPos, newChildPos)
        oldChildPos += size
        newChildPos += size
      } else {
        visit(a, b, oldChildPos, newChildPos)
        oldChildPos += a.nodeSize
        newChildPos += b.nodeSize
        i++; j++
      }
    }
    if (i !== oldNode.childCount || j !== newNode.childCount) incompatible()
  }
  visit(oldRoot, newRoot, oldFrom, newFrom, documentRoot)
  return changes
}
