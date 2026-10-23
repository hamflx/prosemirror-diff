import type {Node, Mark, Schema, Attrs} from 'prosemirror-model' with {"resolution-mode": "import"}

export declare const DiffType: {Unchanged: 0; Deleted: -1; Inserted: 1}
export type DiffOperation = -1 | 0 | 1
export type DiffLevel = 'char' | 'word' | 'grapheme'
export interface DiffOptions {level?: DiffLevel}
export interface TextSegment {type: DiffOperation; text: string; level: DiffLevel}
export interface TextToken {text: string; start: number; end: number}
export interface WordSegmenter {
  segment(text: string): Iterable<{segment: string; index: number}>
}
export interface NodeJSON {
  type: string
  attrs?: Record<string, unknown>
  content?: NodeJSON[]
  marks?: {type: string; attrs?: Record<string, unknown>}[]
  text?: string
}
export declare function tokenizeText(text: string, segmenter?: WordSegmenter | null): TextToken[]
export declare function diffGraphemes(oldText: string, newText: string): (TextSegment & {level: 'grapheme'})[]
export declare function diffWordsWithDetail(oldText: string, newText: string): TextSegment[]
export declare function diffEditor(schema: Schema, oldDoc: NodeJSON, newDoc: NodeJSON, options?: DiffOptions): Node
export declare function patchDocumentNode(schema: Schema, oldNode: Node, newNode: Node, options?: DiffOptions): Node
export declare function patchTextNodes(schema: Schema, oldNodes: readonly Node[], newNodes: readonly Node[], options?: DiffOptions): Node[]
export declare function createDiffNode(schema: Schema, node: Node, type: -1 | 1, level?: DiffLevel): Node
export declare function createDiffMark(schema: Schema, type: -1 | 1, level?: DiffLevel): Mark
export declare function createNewNode(oldNode: Node, children: readonly Node[]): Node
export declare function createTextNode(schema: Schema, content: string, marks?: readonly Mark[] | null): Node
export declare function computeChildEqualityFactor(node1: Node, node2: Node): number
export declare function assertNodeTypeEqual(node1: Node | Mark, node2: Node | Mark): void
export declare function ensureArray<T>(value: T[]): T[]
export declare function ensureArray<T>(value: readonly T[]): readonly T[]
export declare function ensureArray<T>(value: T): T extends readonly unknown[] ? T : T[]
export declare function isNodeEqual(node1: Node | Mark | readonly (Node | Mark)[], node2: Node | Mark | readonly (Node | Mark)[]): boolean
export declare function normalizeNodeContent(node: Node): (Node | Node[])[]
export declare function getNodeProperty(node: Node | Mark, property: 'type'): string
export declare function getNodeProperty<T extends Node | Mark, K extends keyof T>(node: T, property: K): K extends 'type' ? string : T[K]
export declare function getNodeAttribute(node: Node | Mark, attribute: string): unknown
export declare function getNodeAttributes(node: Node | Mark): Attrs
export declare function getNodeMarks(node: Node | Mark): readonly Mark[]
export declare function getNodeChildren(node: Node | Mark): readonly Node[]
export declare function getNodeText(node: Node): string | undefined
export declare function isTextNode(node: Node | Mark): boolean
export declare function matchNodeType(node1: Node | Mark | readonly (Node | Mark)[], node2: Node | Mark | readonly (Node | Mark)[]): boolean

/** Detached plain data; runtime validation still rejects cycles and non-finite numbers. */
export type MetadataValue = null | undefined | string | boolean | number | MetadataValue[] | MetadataAttrs
export interface MetadataAttrs {[key: string]: MetadataValue}
export interface MetadataMark {type: string; attrs?: MetadataAttrs}
export interface MetadataRange {
  nodeType: string
  oldFrom: number; oldTo: number; newFrom: number; newTo: number
}
export type MetadataChange = MetadataRange & (
  {kind: 'attrs'; before: MetadataAttrs; after: MetadataAttrs} |
  {kind: 'marks'; before: MetadataMark[]; after: MetadataMark[]}
)
/** Requires matching schema, structure and text at runtime. */
export declare function compareDocumentMetadata(oldDoc: Node, newDoc: Node): MetadataChange[]
export interface NodeMetadataOptions {oldFrom?: number; newFrom?: number}
/** Caller selects corresponding non-text, non-document nodes; offsets are outer starts. */
export declare function compareNodeMetadata(oldNode: Node, newNode: Node, options?: NodeMetadataOptions): MetadataChange[]
export interface BlockOptions {maxCells?: number; maxDepth?: number}
export interface BlockDetails {changes: BlockChange[]; fallback: boolean; truncated: boolean}
export interface BlockChange {
  kind: 'insert' | 'delete' | 'replace'
  oldFrom: number; oldTo: number; newFrom: number; newTo: number
  before: Node[]; after: Node[]; details?: BlockDetails
}
export interface BlockComparison {changes: BlockChange[]; fallback: boolean}
export declare function compareDocumentBlocks(oldDoc: Node, newDoc: Node, options?: BlockOptions): BlockComparison
