import {compareNodeMetadata, compareDocumentMetadata, compareDocumentBlocks} from '../../src/index.js'
import type {Node} from 'prosemirror-model' with {"resolution-mode": "import"}
declare const node: Node
for (const records of [compareDocumentMetadata(node, node), compareNodeMetadata(node, node)]) {
  const offset: number = records[0].oldFrom
  // @ts-expect-error The source return is not any[].
  const badOffset: string = records[0].oldFrom
  // @ts-expect-error The source record has a real closed shape.
  records[0].nonexistentMethod()
  const record = records[0]
  if (record.kind === 'marks') {
    const name: string = record.after[0].type
    // @ts-expect-error The mark name is not any.
    const badName: number = record.after[0].type
    void [name, badName]
  }
  void [offset, badOffset]
}
// @ts-expect-error A source position must be numeric.
compareNodeMetadata(node, node, {newFrom: '4'})
const blocks = compareDocumentBlocks(node, node)
// @ts-expect-error A block offset is numeric too.
const badBlock: string = blocks.changes[0].newFrom
void badBlock
