import {diff_match_patch} from 'diff-match-patch'
import {diffArrays} from 'diff'
import {Fragment, Node} from 'prosemirror-model'
import {splitGraphemes} from 'unicode-segmenter/grapheme'
import {DiffType} from "./DiffType.js";

const MAX_EDIT_LENGTH = 2000
const DIFF_TIMEOUT_MS = 1000

const createDiffOptions = deadline => ({
  maxEditLength: MAX_EDIT_LENGTH,
  timeout: Math.max(1, deadline - Date.now())
})

const createSegmenter = granularity => {
  try {
    return typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter('en', {granularity})
      : null
  } catch (_) {
    return null
  }
}

const wordSegmenter = createSegmenter('word')
const unicodeWordCharacter = (() => {
  try {
    return new RegExp('[\\p{L}\\p{M}\\p{N}_]', 'u')
  } catch (_) {
    return /\w/
  }
})()

const classifyGrapheme = grapheme => {
  const firstCharacter = String.fromCodePoint(grapheme.codePointAt(0))
  if (/\s/.test(firstCharacter)) {
    return 'space'
  }
  return unicodeWordCharacter.test(firstCharacter) ? 'word' : 'other'
}

const fallbackTokenizeText = text => {
  const tokens = []
  let tokenText = ''
  let tokenType = null
  let tokenStart = 0
  let offset = 0

  for (const grapheme of splitGraphemes(text)) {
    const characterType = classifyGrapheme(grapheme)
    if (tokenText && characterType !== tokenType) {
      tokens.push({text: tokenText, start: tokenStart, end: offset})
      tokenText = ''
      tokenStart = offset
    }
    tokenType = characterType
    tokenText += grapheme
    offset += grapheme.length
  }

  if (tokenText) {
    tokens.push({text: tokenText, start: tokenStart, end: offset})
  }
  return tokens
}

/**
 * Splits text into words, whitespace and punctuation without losing offsets.
 */
export const tokenizeText = (text, segmenter = wordSegmenter) => {
  if (typeof text !== 'string') {
    throw new TypeError('text must be a string')
  }
  if (!text) {
    return []
  }
  if (!segmenter) {
    return fallbackTokenizeText(text)
  }
  return [...segmenter.segment(text)].flatMap(({segment, index}) => (
    fallbackTokenizeText(segment).map(token => ({
      text: token.text,
      start: index + token.start,
      end: index + token.end
    }))
  ))
}

const tokenizeGraphemes = text => [...splitGraphemes(text)]

const mergeDiffSegments = segments => {
  const merged = []
  for (const segment of segments) {
    if (!segment.text) {
      continue
    }
    const previous = merged[merged.length - 1]
    if (previous && previous.type === segment.type && previous.level === segment.level) {
      previous.text += segment.text
    } else {
      merged.push({...segment})
    }
  }
  return merged
}

const safeReplacement = (oldText, newText, level) => mergeDiffSegments([
  {type: DiffType.Deleted, text: oldText, level},
  {type: DiffType.Inserted, text: newText, level}
])

const boundaryFallback = (oldTokens, newTokens, changeLevel, unchangedLevel = changeLevel) => {
  let prefixLength = 0
  const maxPrefixLength = Math.min(oldTokens.length, newTokens.length)
  while (prefixLength < maxPrefixLength && oldTokens[prefixLength] === newTokens[prefixLength]) {
    prefixLength++
  }

  let suffixLength = 0
  const maxSuffixLength = maxPrefixLength - prefixLength
  while (suffixLength < maxSuffixLength &&
    oldTokens[oldTokens.length - suffixLength - 1] === newTokens[newTokens.length - suffixLength - 1]) {
    suffixLength++
  }

  const oldMiddleEnd = oldTokens.length - suffixLength
  const newMiddleEnd = newTokens.length - suffixLength
  return mergeDiffSegments([
    {type: DiffType.Unchanged, text: oldTokens.slice(0, prefixLength).join(''), level: unchangedLevel},
    {type: DiffType.Deleted, text: oldTokens.slice(prefixLength, oldMiddleEnd).join(''), level: changeLevel},
    {type: DiffType.Inserted, text: newTokens.slice(prefixLength, newMiddleEnd).join(''), level: changeLevel},
    {type: DiffType.Unchanged, text: oldTokens.slice(oldMiddleEnd).join(''), level: unchangedLevel}
  ])
}

const changeText = change => Array.isArray(change.value)
  ? change.value.join('')
  : change.value

const changeType = change => change.added
  ? DiffType.Inserted
  : change.removed
    ? DiffType.Deleted
    : DiffType.Unchanged

const diffReplacement = (oldText, newText, deadline, level = 'char', fallbackLevel = 'word') => {
  const oldGraphemes = tokenizeGraphemes(oldText)
  const newGraphemes = tokenizeGraphemes(newText)
  const changes = Date.now() < deadline
    ? diffArrays(oldGraphemes, newGraphemes, createDiffOptions(deadline))
    : undefined
  if (!changes) {
    return boundaryFallback(oldGraphemes, newGraphemes, fallbackLevel, level)
  }
  return mergeDiffSegments(changes.map(change => ({
    type: changeType(change),
    text: changeText(change),
    level
  })))
}

/**
 * Diffs text directly at extended grapheme boundaries, without word alignment.
 * Result text is preserved exactly; no Unicode normalization is applied.
 */
export const diffGraphemes = (oldText, newText) => {
  if (typeof oldText !== 'string' || typeof newText !== 'string') {
    throw new TypeError('oldText and newText must be strings')
  }
  if (!oldText && !newText) {
    return []
  }
  return diffReplacement(oldText, newText, Date.now() + DIFF_TIMEOUT_MS, 'grapheme', 'grapheme')
}

/**
 * Locates changes at word boundaries and refines replacement groups by grapheme.
 * Every result can reconstruct the source texts by excluding insertions or deletions.
 */
export const diffWordsWithDetail = (oldText, newText) => {
  if (typeof oldText !== 'string' || typeof newText !== 'string') {
    throw new TypeError('oldText and newText must be strings')
  }
  if (!oldText && !newText) {
    return []
  }

  const deadline = Date.now() + DIFF_TIMEOUT_MS
  const oldTokens = tokenizeText(oldText).map(({text}) => text)
  const newTokens = tokenizeText(newText).map(({text}) => text)
  const changes = diffArrays(oldTokens, newTokens, createDiffOptions(deadline))
  if (!changes) {
    return boundaryFallback(oldTokens, newTokens, 'word')
  }

  const result = []
  for (let index = 0; index < changes.length;) {
    const change = changes[index]
    if (!change.added && !change.removed) {
      result.push({type: DiffType.Unchanged, text: changeText(change), level: 'word'})
      index++
      continue
    }

    let deletedText = ''
    let insertedText = ''
    while (index < changes.length && (changes[index].added || changes[index].removed)) {
      const changedText = changeText(changes[index])
      if (changes[index].removed) {
        deletedText += changedText
      } else {
        insertedText += changedText
      }
      index++
    }

    if (deletedText && insertedText) {
      result.push(...diffReplacement(deletedText, insertedText, deadline))
    } else {
      result.push(...safeReplacement(deletedText, insertedText, 'word'))
    }
  }
  return mergeDiffSegments(result)
}

const getDiffLevel = options => {
  const level = options?.level ?? 'char'
  if (level !== 'char' && level !== 'word' && level !== 'grapheme') {
    throw new RangeError("options.level must be 'char', 'word', or 'grapheme'")
  }
  return level
}

const patchDocumentNodeUnchecked = (schema, oldNode, newNode, options = {}) => {
  getDiffLevel(options)
  assertNodeTypeEqual(oldNode, newNode)

  const finalLeftChildren = []
  const finalRightChildren = []

  const oldChildren = normalizeNodeContent(oldNode)
  const newChildren = normalizeNodeContent(newNode)
  const oldChildLen = oldChildren.length
  const newChildLen = newChildren.length
  const minChildLen = Math.min(oldChildLen, newChildLen)

  let left = 0
  let right = 0

  for (; left < minChildLen; left++) {
    const oldChild = oldChildren[left]
    const newChild = newChildren[left]
    if (!isNodeEqual(oldChild, newChild)) {
      break
    }
    finalLeftChildren.push(...ensureArray(oldChild))
  }

  for (; right + left + 1 < minChildLen; right++) {
    const oldChild = oldChildren[oldChildLen - right - 1]
    const newChild = newChildren[newChildLen - right - 1]
    if (!isNodeEqual(oldChild, newChild)) {
      break
    }
    finalRightChildren.unshift(...ensureArray(oldChild))
  }

  const diffOldChildren = oldChildren.slice(left, oldChildLen - right)
  const diffNewChildren = newChildren.slice(left, newChildLen - right)
  if (diffOldChildren.length && diffNewChildren.length) {
    const matchedNodes = matchNodes(schema, diffOldChildren, diffNewChildren).sort((a, b) => b.count - a.count)
    const bestMatch = matchedNodes[0]
    if (bestMatch) {
      const {oldStartIndex, newStartIndex, oldEndIndex, newEndIndex} = bestMatch
      const oldBeforeMatchChildren = diffOldChildren.slice(0, oldStartIndex)
      const newBeforeMatchChildren = diffNewChildren.slice(0, newStartIndex)
      finalLeftChildren.push(...patchRemainNodes(schema, oldBeforeMatchChildren, newBeforeMatchChildren, options))
      finalLeftChildren.push(...diffOldChildren.slice(oldStartIndex, oldEndIndex))

      const oldAfterMatchChildren = diffOldChildren.slice(oldEndIndex)
      const newAfterMatchChildren = diffNewChildren.slice(newEndIndex)
      finalRightChildren.unshift(...patchRemainNodes(schema, oldAfterMatchChildren, newAfterMatchChildren, options))
    } else {
      finalLeftChildren.push(...patchRemainNodes(schema, diffOldChildren, diffNewChildren, options))
    }
  } else {
    finalLeftChildren.push(...patchRemainNodes(schema, diffOldChildren, diffNewChildren, options))
  }

  return createNewNodeUnchecked(oldNode, [...finalLeftChildren, ...finalRightChildren])
}

const matchNodes = (schema, oldChildren, newChildren) => {
  const matches = []
  for (let oldStartIndex = 0; oldStartIndex < oldChildren.length; oldStartIndex++) {
    const oldStartNode = oldChildren[oldStartIndex]
    const newStartIndex = findMatchNode(newChildren, oldStartNode)

    if (newStartIndex !== -1) {
      let oldEndIndex = oldStartIndex + 1
      let newEndIndex = newStartIndex + 1
      for (; oldEndIndex < oldChildren.length && newEndIndex < newChildren.length; oldEndIndex++, newEndIndex++) {
        const oldEndNode = oldChildren[oldEndIndex]
        if (!isNodeEqual(newChildren[newEndIndex], oldEndNode)) {
          break
        }
      }
      matches.push({oldStartIndex, newStartIndex, oldEndIndex, newEndIndex, count: newEndIndex - newStartIndex})
    }
  }
  return matches
}

const findMatchNode = (children, node, startIndex = 0) => {
  for (let i = startIndex; i < children.length; i++) {
    if (isNodeEqual(children[i], node)) {
      return i
    }
  }
  return -1
}

const patchRemainNodes = (schema, oldChildren, newChildren, options = {}) => {
  const level = getDiffLevel(options)
  const finalLeftChildren = []
    const finalRightChildren = []
  const oldChildLen = oldChildren.length
    const newChildLen = newChildren.length
  let left = 0
  let right = 0
  while (oldChildLen - left - right > 0 && newChildLen - left - right > 0) {
    const leftOldNode = oldChildren[left]
    const leftNewNode = newChildren[left]
    const rightOldNode = oldChildren[oldChildLen - right - 1]
    const rightNewNode = newChildren[newChildLen - right - 1]
    let updateLeft = !isTextNode(leftOldNode) && matchNodeType(leftOldNode, leftNewNode)
    let updateRight = !isTextNode(rightOldNode) && matchNodeType(rightOldNode, rightNewNode)
    if (Array.isArray(leftOldNode) && Array.isArray(leftNewNode)) {
      finalLeftChildren.push(...patchTextNodesUnchecked(schema, leftOldNode, leftNewNode, options))
      left += 1
      continue
    }

    if (updateLeft && updateRight) {
      const equalityLeft = computeChildEqualityFactor(leftOldNode, leftNewNode)
      const equalityRight = computeChildEqualityFactor(rightOldNode, rightNewNode)
      if (equalityLeft < equalityRight) {
        updateLeft = false
      } else {
        updateRight = false
      }
    }
    if (updateLeft) {
      finalLeftChildren.push(patchDocumentNodeUnchecked(schema, leftOldNode, leftNewNode, options))
      left += 1
    } else if (updateRight) {
      finalRightChildren.unshift(patchDocumentNodeUnchecked(schema, rightOldNode, rightNewNode, options))
      right += 1
    } else {
      // Normalized text runs are arrays, while inline leaves are single nodes.
      // Expand either side before recursively marking a structural replacement.
      finalLeftChildren.push(...ensureArray(leftOldNode).map(node => createDiffNodeUnchecked(schema, node, DiffType.Deleted, level)))
      finalLeftChildren.push(...ensureArray(leftNewNode).map(node => createDiffNodeUnchecked(schema, node, DiffType.Inserted, level)))
      left += 1
      // delete and insert
    }
  }

  const deleteNodeLen = oldChildLen - left - right
  const insertNodeLen = newChildLen - left - right
  if (deleteNodeLen) {
    finalLeftChildren.push(...oldChildren.slice(left, left + deleteNodeLen).flat().map(node => createDiffNodeUnchecked(schema, node, DiffType.Deleted, level)))
  }

  if (insertNodeLen) {
    finalRightChildren.unshift(...newChildren.slice(left, left + insertNodeLen).flat().map(node => createDiffNodeUnchecked(schema, node, DiffType.Inserted, level)))
  }

  return [...finalLeftChildren, ...finalRightChildren]
}

const patchTextNodesUnchecked = (schema, oldNode, newNode, options = {}) => {
  const level = getDiffLevel(options)
  const oldText = oldNode.map(n => getNodeText(n)).join('')
  const newText = newNode.map(n => getNodeText(n)).join('')
  const diff = level === 'word'
    ? diffWordsWithDetail(oldText, newText)
    : level === 'grapheme'
      ? diffGraphemes(oldText, newText)
      : new diff_match_patch().diff_main(oldText, newText)
  let oldLen = 0
  let newLen = 0
  const res = diff.map(d => {
    const type = Array.isArray(d) ? d[0] : d.type
    const content = Array.isArray(d) ? d[1] : d.text
    const segmentLevel = Array.isArray(d) ? 'char' : d.level
    const node = createTextNodeUnchecked(schema, content, type !== DiffType.Unchanged ? createDiffMark(schema, type, segmentLevel) : [])
    const oldFrom = oldLen
    const oldTo = oldFrom + (type === DiffType.Inserted ? 0 : content.length)
    const newFrom = newLen
    const newTo = newFrom + (type === DiffType.Deleted ? 0 : content.length)
    oldLen = oldTo
    newLen = newTo
    return {node, type, oldFrom, oldTo, newFrom, newTo}
  }).map(({node, type, oldFrom, oldTo, newFrom, newTo}) => {
    if (type === DiffType.Deleted) {
      const textItems = findTextNodes(oldNode, oldFrom, oldTo).filter(n => Object.keys(n.node.attrs ?? {}).length || n.node.marks?.length)
      return applyTextNodeAttrsMarks(schema, node, oldFrom, textItems)
    } else {
      const textItems = findTextNodes(newNode, newFrom, newTo).filter(n => Object.keys(n.node.attrs ?? {}).length || n.node.marks?.length)
      return applyTextNodeAttrsMarks(schema, node, newFrom, textItems)
    }
  })
  return res.flat(Infinity)
}

const findTextNodes = (textNodes, from, to) => {
  const result = []
  let start = 0
  for (let i = 0; i < textNodes.length && start < to; i++) {
    const node = textNodes[i]
    const text = getNodeText(node)
    const end = start + text.length
    const intersect = (start >= from && start < to) ||
      (end > from && end <= to) ||
      (start <= from && end >= to)
    if (intersect) {
      result.push({node, from: start, to: end})
    }
    start += text.length
  }
  return result
}

const applyTextNodeAttrsMarks = (schema, node, base, textItems) => {
  if (!textItems.length) {
    return node
  }

  const baseMarks = node.marks ?? []
  const firstItem = textItems[0]
  const nodeText = getNodeText(node)
  const nodeEnd = base + nodeText.length
  const result = []
  if (firstItem.from - base > 0) {
    result.push(createTextNodeUnchecked(schema, nodeText.slice(0, firstItem.from - base), baseMarks))
  }
  for (let i = 0; i < textItems.length; i++) {
    const {from, node: textNode, to} = textItems[i]
    result.push(createTextNodeUnchecked(schema, nodeText.slice(Math.max(from, base) - base, to - base), [...baseMarks, ...(textNode.marks ?? [])]))
    const nextFrom = i + 1 < textItems.length ? textItems[i + 1].from : nodeEnd
    if (nextFrom > to) {
      result.push(createTextNodeUnchecked(schema, nodeText.slice(to - base, nextFrom - base), baseMarks))
    }
  }
  return result
}

export const computeChildEqualityFactor = (node1, node2) => {
  return 0
}

export const assertNodeTypeEqual = (node1, node2) => {
  if (getNodeProperty(node1, 'type') !== getNodeProperty(node2, 'type')) {
    throw new Error(`node type not equal: ${node1.type} !== ${node2.type}`)
  }
}

export const ensureArray = (value) => {
  return Array.isArray(value) ? value : [value]
}

export const isNodeEqual = (node1, node2) => {
  const isNode1Array = Array.isArray(node1)
  const isNode2Array = Array.isArray(node2)
  if (isNode1Array !== isNode2Array) {
    return false
  }
  if (isNode1Array) {
    return node1.length === node2.length && node1.every((node, index) => isNodeEqual(node, node2[index]))
  }

  const type1 = getNodeProperty(node1, 'type')
  const type2 = getNodeProperty(node2, 'type')
  if (type1 !== type2) {
    return false
  }
  if (isTextNode(node1)) {
    const text1 = getNodeProperty(node1, 'text')
    const text2 = getNodeProperty(node2, 'text')
    if (text1 !== text2) {
      return false
    }
  }
  const attrs1 = getNodeAttributes(node1)
  const attrs2 = getNodeAttributes(node2)
  const attrs = [...new Set([...Object.keys(attrs1), ...Object.keys(attrs2)])]
  for (const attr of attrs) {
    if (attrs1[attr] !== attrs2[attr]) {
      return false
    }
  }
  const marks1 = getNodeMarks(node1)
  const marks2 = getNodeMarks(node2)
  if (marks1.length !== marks2.length) {
    return false
  }
  for (let i = 0; i < marks1.length; i++) {
    if (!isNodeEqual(marks1[i], marks2[i])) {
      return false
    }
  }
  const children1 = getNodeChildren(node1)
  const children2 = getNodeChildren(node2)
  if (children1.length !== children2.length) {
    return false
  }
  for (let i = 0; i < children1.length; i++) {
    if (!isNodeEqual(children1[i], children2[i])) {
      return false
    }
  }
  return true
}

export const normalizeNodeContent = node => {
  const content = getNodeChildren(node) ?? []
  const res = []
  for (let i = 0; i < content.length; i++) {
    const child = content[i]
    if (isTextNode(child)) {
      const textNodes = []
      for (let textNode = content[i]; i < content.length && isTextNode(textNode); textNode = content[++i]) {
        textNodes.push(textNode)
      }
      i--
      res.push(textNodes)
    } else {
      res.push(child)
    }
  }
  return res
}

export const getNodeProperty = (node, property) => {
  if (property === 'type') {
    return node.type?.name
  }
  return node[property]
}
export const getNodeAttribute = (node, attribute) => node.attrs ? node.attrs[attribute] : undefined
export const getNodeAttributes = node => node.attrs ? node.attrs : undefined
export const getNodeMarks = node => node.marks ?? []
export const getNodeChildren = node => node.content?.content ?? []
export const getNodeText = node => node.text
export const isTextNode = node => node.type?.name === 'text'
export const matchNodeType = (node1, node2) => node1.type?.name === node2.type?.name || (Array.isArray(node1) && Array.isArray(node2))
/**
 * @param {Node} oldNode
 * @param {Node[]} children
 */
const createNewNodeUnchecked = (oldNode, children) => {
  if (!oldNode.type) {
    throw new Error('oldNode.type is undefined')
  }
  return oldNode.copy(Fragment.fromArray(children))
}
const createDiffNodeUnchecked = (schema, node, type, level = 'char') => {
  return mapDocumentNode(node, node => {
    if (isTextNode(node)) {
      return createTextNodeUnchecked(schema, getNodeText(node), [...(node.marks || []), createDiffMark(schema, type, level)])
    }
    return node
  })
}
function mapDocumentNode (node, mapper) {
  const copy = node.copy(
    Fragment.from(
      node.content.content.map(
        node => mapDocumentNode(node, mapper)
      ).filter(n => n)
    )
  )
  return mapper(copy) || copy
}
export const createDiffMark = (schema, type, level = 'char') => {
  if (type === DiffType.Inserted || type === DiffType.Deleted) {
    return schema.mark('diffMark', {type, level})
  }
  throw new Error('type is not valid')
}
const createTextNodeUnchecked = (schema, content, marks = []) => {
  return schema.text(content, marks)
}

// Full recursive checks belong at public boundaries, never at each internal layer.
// Node.check validates content/mark sets and, in versions supporting it,
// schema-defined attribute validators. It is not general-purpose JSON validation.
const checkedNode = (node, phase) => {
  try { node.check() } catch (error) {
    if (!(error instanceof RangeError)) throw error
    throw new RangeError(phase + ': ' + error.message, {cause: error})
  }
  return node
}
const inputNode = node => checkedNode(node, 'Invalid input node')
const outputNode = node => checkedNode(node, 'Diff output cannot be represented in the original schema')

export const patchDocumentNode = (schema, oldNode, newNode, options = {}) => {
  getDiffLevel(options)
  inputNode(oldNode)
  inputNode(newNode)
  return outputNode(patchDocumentNodeUnchecked(schema, oldNode, newNode, options))
}

export const patchTextNodes = (schema, oldNodes, newNodes, options = {}) => {
  getDiffLevel(options)
  oldNodes.forEach(inputNode)
  newNodes.forEach(inputNode)
  return patchTextNodesUnchecked(schema, oldNodes, newNodes, options).map(outputNode)
}

export const createDiffNode = (schema, node, type, level = 'char') => {
  inputNode(node)
  return outputNode(createDiffNodeUnchecked(schema, node, type, level))
}

/** @param {Node} oldNode @param {Node[]} children */
export const createNewNode = (oldNode, children) => {
  if (!oldNode.type) throw new Error('oldNode.type is undefined')
  // Replaced content may be an invalid placeholder; only the completed copy
  // needs to be valid. Keep this helper useful for repairing that content.
  return outputNode(createNewNodeUnchecked(oldNode, children))
}

// With no parent context, only the returned text node's own mark set is checked.
export const createTextNode = (schema, content, marks = []) =>
  outputNode(createTextNodeUnchecked(schema, content, marks))

export const diffEditor = (schema, oldDoc, newDoc, options = {}) => {
  getDiffLevel(options)
  const oldNode = Node.fromJSON(schema, oldDoc)
  const newNode = Node.fromJSON(schema, newDoc)
  return patchDocumentNode(schema, oldNode, newNode, options)
}

// 最终目的：给老的文档添加 mark 标记删除和新增。
