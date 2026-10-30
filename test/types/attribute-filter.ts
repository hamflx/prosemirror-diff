import {compareDocumentBlocks, compareDocumentMetadata, compareNodeMetadata, diffEditor} from '../..'
import type {Node, Schema} from 'prosemirror-model' with {"resolution-mode": "import"}
declare const node: Node, schema: Schema
const ignoreAttributes = ['id'] as const
const result = compareDocumentBlocks(node, node, {ignoreAttributes})
const policy: string[] | undefined = result.comparison?.ignoredAttributes
compareDocumentMetadata(node, node, {ignoreAttributes})
compareNodeMetadata(node, node, {ignoreAttributes, oldFrom: 2, newFrom: 8})
// @ts-expect-error Filter entries must be strings.
compareDocumentBlocks(node, node, {ignoreAttributes: [1]})
// @ts-expect-error Filter must be an array.
compareDocumentMetadata(node, node, {ignoreAttributes: 'id'})
// @ts-expect-error Legacy mixed-document rendering does not accept this option.
diffEditor(schema, node.toJSON(), node.toJSON(), {ignoreAttributes})
void policy
