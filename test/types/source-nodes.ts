import {compareDocumentBlocks, compareNodeMetadata} from '../../src/index.js'
import type {Node} from 'prosemirror-model' with {"resolution-mode": "import"}
declare const node: Node
// @ts-expect-error Bundler resolution retains real source Node inputs.
compareDocumentBlocks({}, {})
// @ts-expect-error Metadata needs real source Node inputs too.
compareNodeMetadata({}, {})
// @ts-expect-error Preserved block nodes have the real ProseMirror shape.
compareDocumentBlocks(node, node).changes[0].before[0].nonexistentNodeMethod()
