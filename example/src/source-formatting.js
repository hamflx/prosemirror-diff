import {prepareTextChange} from './text-review.js'

// Source inventory only: never align marks across sides or infer editing history.
// Eligibility and the selected-text size limit match the existing text adapter.
export function sourceFormatting(change) {
  const kind = 'source-inventory'
  try {
    const prepared = prepareTextChange(change)
    if (!prepared.supported) return {kind, coverage: 'unsupported', reason: prepared.reason}
    for (const [node, from] of [[change.before[0], change.oldFrom], [change.after[0], change.newFrom]]) {
      if (!Number.isSafeInteger(from) || from < 0 || !Number.isSafeInteger(from + node.nodeSize)) {
        return {kind, coverage: 'unavailable', reason: 'Source formatting requires safe original node positions. Complete parent event retained.'}
      }
    }
    const collect = (node, start) => {
      const runs = []
      node.forEach((child, offset) => {
        const marks = child.marks.map(mark => {
          // Copy validated model values, never overridable serializer output.
          // Recheck primitives so no nested reference can escape the inventory.
          const attrs = Object.entries(mark.attrs).filter(([, value]) => value !== undefined)
          if (attrs.some(([, value]) => value !== null && typeof value !== 'string')) {
            throw new TypeError('Unsupported source mark attribute')
          }
          return {type: mark.type.name, ...(attrs.length ? {attrs: Object.fromEntries(attrs)} : {})}
        })
        runs.push({from: start + offset, to: start + offset + child.nodeSize, text: child.text, marks})
      })
      return {from: start, to: start + node.content.size, runs}
    }
    return {kind, coverage: 'source-text-runs',
      reason: 'Independent original text-run formatting on each side, including unmarked text. Not a mark diff, identity mapping or edit history; block attributes are outside this inventory.',
      coordinates: 'Half-open original UTF-16 ranges. Mark boundaries may split a grapheme; these ranges are not widened to grapheme boundaries.',
      old: collect(change.before[0], prepared.oldStart), new: collect(change.after[0], prepared.newStart)}
  } catch {
    return {kind, coverage: 'unavailable', reason: 'Source formatting preparation or snapshot failed. No inventory is claimed; complete parent event retained.'}
  }
}
