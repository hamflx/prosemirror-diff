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

// Re-render original runs, splitting only at the requested text range. A grapheme
// can cross run/mark boundaries; its logical range remains whole in the list.
// Attribute descriptions live outside this element so source text stays exact.
export function renderTextSource(target, node, range) {
  target.replaceChildren()
  const from = range ? range.from - range.start : -1
  const to = range ? range.to - range.start : -1
  let offset = 0, markerPlaced = false, first
  const point = position => {
    if (!range || from !== to || position !== from || markerPlaced) return
    const marker = document.createElement('span')
    marker.className = 'text-position-marker'
    Object.assign(marker.dataset, {from: String(range.from), to: String(range.to)})
    marker.setAttribute('role', 'img')
    marker.setAttribute('aria-label', range.label)
    target.append(marker)
    markerPlaced = true
    first = marker
  }
  node.forEach(child => {
    if (child.isText) {
      const end = offset + child.text.length
      const cuts = [...new Set([offset, end, from, to].filter(p => p >= offset && p <= end))].sort((a, b) => a - b)
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i], b = cuts[i + 1]
        point(a)
        let content = document.createTextNode(child.text.slice(a - offset, b - offset))
        if (range && from !== to && a >= from && b <= to) {
          const highlight = document.createElement('span')
          highlight.className = 'selected-text-change'
          Object.assign(highlight.dataset, {from: String(range.start + a), to: String(range.start + b)})
          highlight.append(content)
          content = highlight
          first ??= highlight
        }
        target.append(marked(content, child.marks))
      }
      offset = end
      point(offset)
    } else {
      const token = document.createElement(child.type.name === 'hard_break' ? 'br' : 'span')
      if (child.type.name !== 'hard_break') {
        token.className = 'inline-token'
        token.textContent = `[${child.attrs.label ?? child.type.name}]`
      }
      target.append(token)
      offset += child.nodeSize
    }
  })
  point(offset)
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
