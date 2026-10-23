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

export function renderMarkDescriptions(node, from, label = node.type.name + ' at ' + from) {
  const records = []
  node.forEach((child, offset) => {
    for (const mark of child.marks) {
      if (mark.type.name !== 'link' && supportedTextMark(mark)) continue
      records.push({mark, from: from + 1 + offset, to: from + 1 + offset + child.nodeSize})
    }
  })
  const list = document.createElement('ul')
  list.className = 'mark-descriptions'
  function row({mark, from, to}) {
    const item = document.createElement('li')
    const scope = '[' + from + ', ' + to + ')'
    item.textContent = supportedTextMark(mark)
      ? 'Link ' + scope + ': href ' + JSON.stringify(mark.attrs.href) + '; title ' + JSON.stringify(mark.attrs.title ?? null) + '. Display only; no navigation.'
      : 'Unsupported mark ' + mark.type.name + ' ' + scope + ': text is shown, but its formatting is not interpreted.'
    return item
  }
  if (records.length <= 50) {
    list.append(...records.map(row))
    return list
  }
  const group = document.createElement('div')
  group.className = 'mark-descriptions mark-description-pages'
  list.className = 'mark-description-list'
  group.setAttribute('role', 'group')
  group.setAttribute('aria-label', 'Mark descriptions for ' + label)
  const unsupported = records.filter(record => !supportedTextMark(record.mark))
  if (unsupported.length) {
    const warning = document.createElement('p')
    warning.className = 'mark-description-warning'
    const names = [...new Set(unsupported.map(record => record.mark.type.name))].join(', ')
    warning.textContent = unsupported.length + ' unsupported mark records (' + names + '). Their formatting is not interpreted; all records remain available across the pages.'
    group.append(warning)
  }
  const status = document.createElement('p')
  status.className = 'mark-description-status'
  status.setAttribute('aria-live', 'polite')
  status.setAttribute('aria-atomic', 'true')
  const controls = document.createElement('div')
  controls.className = 'mark-description-controls'
  const previous = document.createElement('button'), next = document.createElement('button')
  previous.type = next.type = 'button'
  previous.textContent = 'Previous descriptions'
  next.textContent = 'Next descriptions'
  previous.setAttribute('aria-label', 'Previous mark descriptions for ' + label)
  next.setAttribute('aria-label', 'Next mark descriptions for ' + label)
  let page = 0
  function show() {
    const start = page * 50, end = Math.min(start + 50, records.length)
    list.replaceChildren(...records.slice(start, end).map(row))
    status.textContent = 'Showing ' + (start + 1) + '-' + end + ' of ' + records.length + ' mark descriptions. Page ' + (page + 1) + ' of ' + Math.ceil(records.length / 50) + '. All records are retained.'
    previous.disabled = page === 0
    next.disabled = end === records.length
    if (document.activeElement === next && next.disabled) previous.focus()
    if (document.activeElement === previous && previous.disabled) next.focus()
  }
  previous.onclick = () => { if (page > 0) { page--; show() } }
  next.onclick = () => { if ((page + 1) * 50 < records.length) { page++; show() } }
  controls.append(previous, next)
  group.append(status, controls, list)
  show()
  return group
}
