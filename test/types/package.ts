import * as api from '../..'
import type {Node, Schema, Mark} from 'prosemirror-model' with {"resolution-mode": "import"}
declare const node: Node, schema: Schema, mark: Mark
const changes: api.MetadataChange[] = api.compareNodeMetadata(node, node, {oldFrom: 3, newFrom: 7})
for (const change of changes) {
  const position: number = change.oldFrom
  if (change.kind === 'marks') {
    const name: string = change.after[0].type
    // @ts-expect-error A mark name is a string, not a numeric offset.
    const badName: number = change.after[0].type
    void [name, badName]
  } else {
    const value: api.MetadataValue = change.before['custom']
    void value
  }
  // @ts-expect-error Range fields are numeric.
  const badPosition: string = change.oldTo
  // @ts-expect-error Metadata has no node methods.
  change.nonexistentMethod()
  void [position, badPosition]
}
api.compareDocumentMetadata(node, node)
const blocks = api.compareDocumentBlocks(node, node, {maxDepth: 2, maxCells: 100})
const before: Node[] = blocks.changes[0].before
const partial: boolean | undefined = blocks.changes[0].details?.truncated
// @ts-expect-error The budget is numeric.
api.compareDocumentBlocks(node, node, {maxCells: '100'})
// @ts-expect-error Node offsets are numeric.
api.compareNodeMetadata(node, node, {oldFrom: '3'})
// @ts-expect-error No unsupported metadata option.
api.compareNodeMetadata(node, node, {maxDepth: 2})
// @ts-expect-error Block changes contain nodes, not metadata snapshots.
const badBefore: string = blocks.changes[0].before[0]
const combined: Node = api.diffEditor(schema, {type: 'doc'}, node.toJSON(), {level: 'grapheme'})
// @ts-expect-error Unsupported diff level.
api.diffEditor(schema, node.toJSON(), node.toJSON(), {level: 'sentence'})
// @ts-expect-error JSON node needs a type.
api.diffEditor(schema, {}, {type: 'doc'})
const text: Node = api.createTextNode(schema, 'text', [mark])
api.createNewNode(node, [text])
api.patchDocumentNode(schema, node, node)
api.patchTextNodes(schema, [text], [text], {level: 'word'})
api.createDiffNode(schema, node, api.DiffType.Inserted)
api.createDiffMark(schema, api.DiffType.Deleted, 'char')
// @ts-expect-error An unchanged operation cannot create a diff mark.
api.createDiffMark(schema, api.DiffType.Unchanged)
const tokens: api.TextToken[] = api.tokenizeText('text', null)
api.tokenizeText('text', {segment: text => [{segment: text, index: 0}]})
const grapheme: 'grapheme' = api.diffGraphemes('a', 'b')[0].level
const words: api.TextSegment[] = api.diffWordsWithDetail('a', 'b')
api.computeChildEqualityFactor(node, node)
api.assertNodeTypeEqual(node, node)
const numbers: number[] = api.ensureArray(1)
declare const readonlyMarks: readonly Mark[], readonlyNodes: readonly Node[]
declare const maybeMarks: Mark | readonly Mark[]
const mutableMarks: Mark[] = api.ensureArray([mark])
const preservedMarks: readonly Mark[] = api.ensureArray(readonlyMarks)
const unionMarks: readonly Mark[] = api.ensureArray(maybeMarks)
const preservedNodes: readonly Node[] = api.ensureArray(readonlyNodes)
// @ts-expect-error A readonly input does not become mutable.
api.ensureArray(readonlyMarks).push(mark)
// @ts-expect-error The result stays one-dimensional, never nested arrays.
const nestedMarks: readonly (readonly Mark[])[] = api.ensureArray(readonlyMarks)
// @ts-expect-error A union with a readonly array cannot promise mutable output.
api.ensureArray(maybeMarks).push(mark)
api.isNodeEqual(readonlyMarks, [mark]); api.isNodeEqual(readonlyNodes, [node])
api.matchNodeType(readonlyMarks, [mark]); api.matchNodeType(readonlyNodes, [node])
api.createNewNode(node, readonlyNodes)
api.patchTextNodes(schema, readonlyNodes, readonlyNodes)
api.createTextNode(schema, 'text', null)
void [mutableMarks, preservedMarks, unionMarks, preservedNodes, nestedMarks]
api.isNodeEqual([node], [node]); api.isNodeEqual(mark, mark)
api.normalizeNodeContent(node)
const typeName: string = api.getNodeProperty(node, 'type')
const nodeSize: number = api.getNodeProperty(node, 'nodeSize')
api.getNodeAttribute(node, 'id'); api.getNodeAttributes(node)
api.getNodeMarks(node); api.getNodeChildren(node); api.getNodeText(node)
api.isTextNode(node); api.matchNodeType([node], [node])
void [before, partial, badBefore, combined, tokens, grapheme, words, numbers, typeName, nodeSize]
