import {supportedTextMark} from './text-mark-support.js'

function marked(content, marks) {
  for (const mark of [...marks].reverse()) {
    const known = supportedTextMark(mark)
    const tag = known && ['strong', 'em', 'code'].includes(mark.type.name) ? mark.type.name : 'span'
    const wrapper = document.createElement(tag)
    wrapper.dataset.mark = mark.type.name
    if (known) wrapper.dataset.markAttrs = JSON.stringify(mark.attrs)
    if (!known) wrapper.className = 'unsupported-mark'
    else if (mark.type.name === 'link') wrapper.className = 'non-navigating-link'
    wrapper.append(content)
    content = wrapper
  }
  return content
}

// Keep original runs separate from temporary decorations. Reusing the same PM
// node restores original DOM objects, then changes only intersecting text leaves.
const sources = new WeakMap()

function initialize(target, node) {
  target.replaceChildren()
  const state = {node, runs: [], tops: [], undo: []}
  node.forEach((child, offset) => {
    let top
    if (child.isText) {
      const text = document.createTextNode(child.text)
      top = marked(text, child.marks)
      state.runs.push({from: offset, to: offset + child.text.length, child, text, top})
    } else {
      top = document.createElement(child.type.name === 'hard_break' ? 'br' : 'span')
      if (child.type.name !== 'hard_break') {
        top.className = 'inline-token'
        top.textContent = '[' + (child.attrs.label ?? child.type.name) + ']'
      }
    }
    state.tops.push(top)
    target.append(top)
  })
  sources.set(target, state)
  return state
}

function replaceTemporarily(state, target, original, replacements) {
  const parent = original.parentNode
  original.replaceWith(...replacements)
  state.undo.push(() => {
    // A caller may have replaced the whole target since the last decoration.
    if (!target.contains(replacements[0]) || replacements.some((part, i) =>
      part.parentNode !== parent || (i > 0 && replacements[i - 1].nextSibling !== part))) return
    parent.insertBefore(original, replacements[0])
    replacements.forEach(part => part.remove())
  })
}

export function renderTextSource(target, node, range) {
  let state = sources.get(target)
  if (state?.node === node) {
    state.undo.reverse().forEach(undo => undo())
    state.undo = []
    // Detect caller-cleared/replaced source DOM before reusing cached leaves.
    if (target.childNodes.length !== state.tops.length ||
        state.tops.some((top, i) => target.childNodes[i] !== top) ||
        state.runs.some(run => !target.contains(run.text) || run.text.data !== run.child.text)) state = undefined
  } else state = undefined
  if (!state) state = initialize(target, node)
  if (!range) return
  const from = range.from - range.start, to = range.to - range.start
  if (from === to) {
    const marker = document.createElement('span')
    marker.className = 'text-position-marker'
    Object.assign(marker.dataset, {from: String(range.from), to: String(range.to)})
    marker.setAttribute('role', 'img')
    marker.setAttribute('aria-label', range.label)
    const run = state.runs.find(run => run.from <= from && from < run.to)
    if (run && from > run.from) {
      // Split just this run, placing the point outside its original marks.
      const split = from - run.from
      replaceTemporarily(state, target, run.top, [
        marked(document.createTextNode(run.child.text.slice(0, split)), run.child.marks),
        marker,
        marked(document.createTextNode(run.child.text.slice(split)), run.child.marks)
      ])
    } else {
      target.insertBefore(marker, run?.top ?? null)
      state.undo.push(() => marker.remove())
    }
    return marker
  }
  let first
  for (const run of state.runs) {
    if (run.to <= from) continue
    if (run.from >= to) break
    const a = Math.max(from, run.from), b = Math.min(to, run.to)
    const highlight = document.createElement('span')
    highlight.className = 'selected-text-change'
    Object.assign(highlight.dataset, {from: String(range.start + a), to: String(range.start + b)})
    highlight.append(document.createTextNode(run.child.text.slice(a - run.from, b - run.from)))
    const parts = []
    if (a > run.from) parts.push(document.createTextNode(run.child.text.slice(0, a - run.from)))
    parts.push(highlight)
    if (b < run.to) parts.push(document.createTextNode(run.child.text.slice(b - run.from)))
    replaceTemporarily(state, target, run.text, parts)
    first ??= highlight
  }
  return first
}

export function renderMarkDescriptions(node, from) {
  const descriptions = document.createElement('ul')
  descriptions.className = 'mark-descriptions'
  node.forEach((child, offset) => {
    for (const mark of child.marks) {
      if (mark.type.name !== 'link' && supportedTextMark(mark)) continue
      const item = document.createElement('li')
      const scope = `[${from + 1 + offset}, ${from + 1 + offset + child.nodeSize})`
      item.textContent = supportedTextMark(mark)
        ? `Link ${scope}: href ${JSON.stringify(mark.attrs.href)}; title ${JSON.stringify(mark.attrs.title ?? null)}. Display only; no navigation.`
        : `Unsupported mark ${mark.type.name} ${scope}: text is shown, but its formatting is not interpreted.`
      descriptions.append(item)
    }
  })
  return descriptions
}
