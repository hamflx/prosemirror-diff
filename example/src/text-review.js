import {diffGraphemes} from '../../src/diff.js'
import {DiffType} from '../../src/DiffType.js'

// Example-only adapter: the caller has already selected a block correspondence.
// It does not pair nodes, support marks/atoms, or expose a public comparison API.
export function reviewTextChange(change) {
  const unavailable = reason => ({supported: false, reason})
  if (!change || change.kind !== 'replace' || change.before.length !== 1 || change.after.length !== 1) {
    return unavailable('Select a single-block replacement to inspect text.')
  }
  const oldNode = change.before[0], newNode = change.after[0]
  if (!oldNode.isTextblock || !newNode.isTextblock || oldNode.isAtom || newNode.isAtom || !oldNode.sameMarkup(newNode)) {
    return unavailable('Text details require matching textblock markup and non-atom blocks.')
  }
  for (const node of [oldNode, newNode]) {
    let plain = true
    node.forEach(child => { if (!child.isText || child.marks.length) plain = false })
    if (!plain) return unavailable('Text details do not support text marks, inline atoms or other inline nodes.')
  }
  if (oldNode.content.size + newNode.content.size > 20000) {
    return unavailable('Text details are limited to 20,000 combined UTF-16 positions. The complete block event remains available.')
  }
  const oldText = oldNode.textContent, newText = newNode.textContent
  const oldStart = change.oldFrom + 1, newStart = change.newFrom + 1
  let oldPosition = oldStart, newPosition = newStart, pending
  const hunks = []
  const flush = () => {
    if (!pending) return
    pending.oldTo = oldPosition
    pending.newTo = newPosition
    pending.kind = pending.oldFrom === pending.oldTo ? 'insert' : pending.newFrom === pending.newTo ? 'delete' : 'replace'
    hunks.push(pending)
    pending = undefined
  }
  for (const segment of diffGraphemes(oldText, newText)) {
    if (segment.type === DiffType.Unchanged) flush()
    else if (!pending) pending = {oldFrom: oldPosition, newFrom: newPosition}
    if (segment.type !== DiffType.Inserted) oldPosition += segment.text.length
    if (segment.type !== DiffType.Deleted) newPosition += segment.text.length
  }
  flush()
  return {supported: true, oldText, newText, oldStart, newStart, hunks}
}
