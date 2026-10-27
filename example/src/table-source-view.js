// Render only the validated fixed-schema originals. Never insert wrappers between
// table/tbody/tr/cells. Positions are original document offsets, not grid slots.
export function renderTableSource(host, doc, side) {
  const targets = []
  const element = (tag, text) => {
    const node = document.createElement(tag)
    if (text !== undefined) node.textContent = text
    return node
  }
  function render(node, from) {
    if (node.type === 'text') {
      let text = document.createTextNode(node.text)
      for (const mark of node.marks || []) {
        const tag = {strong:'strong',em:'em',code:'code',link:'span'}[mark.type]
        if (!tag) throw new RangeError('Unsupported rendered mark')
        const wrapper = element(tag)
        if (mark.type === 'link') {
          wrapper.className = 'literal-link'
          wrapper.title = `Link data only: ${mark.attrs.href}; title: ${mark.attrs.title ?? ''}`
        }
        wrapper.append(text); text = wrapper
      }
      return {element:text,size:node.text.length}
    }
    if (node.marks?.length) throw new RangeError('Rendering marks on non-text nodes is unsupported')
    const tag = {paragraph:'p',table:'table',table_row:'tr',table_cell:'td',table_header:'th',hard_break:'br',inline_token:'span'}[node.type]
    if (!tag) throw new RangeError('Unsupported rendered node')
    const dom = element(tag)
    const leaf = node.type === 'hard_break' || node.type === 'inline_token'
    let content = dom, pos = from + 1
    if (node.type === 'table') {
      dom.append(element('caption', `${side} table · original position ${from}`))
      content = element('tbody'); dom.append(content)
    }
    if (node.type === 'table_cell' || node.type === 'table_header') {
      dom.setAttribute('colspan', String(node.attrs.colspan))
      dom.setAttribute('rowspan', String(node.attrs.rowspan))
      // Preserve colwidth data; this example does not infer CSS column sizing.
      dom.dataset.colwidth = JSON.stringify(node.attrs.colwidth)
    }
    if (node.type === 'inline_token') dom.textContent = `[${node.attrs.label}]`
    for (const child of node.content || []) {
      const rendered = render(child, pos)
      content.append(rendered.element); pos += rendered.size
    }
    const size = leaf ? 1 : pos - from + 1
    dom.dataset.from = String(from); dom.dataset.to = String(from + size)
    dom.dataset.nodeType = node.type
    targets.push({element:dom,from,to:from+size,type:node.type})
    return {element:dom,size}
  }
  const fragment = document.createDocumentFragment()
  let pos = 0
  for (const node of doc.content || []) {
    const rendered = render(node,pos)
    if (node.type === 'table') {
      const scroll = element('div'); scroll.className = 'table-scroll'
      scroll.tabIndex = 0; scroll.setAttribute('role','region')
      scroll.setAttribute('aria-label', `${side} table at ${pos}; scroll horizontally if needed`)
      scroll.append(rendered.element); fragment.append(scroll)
    } else fragment.append(rendered.element)
    pos += rendered.size
  }
  host.replaceChildren(fragment)
  return targets
}

export function locateTableRange(targets, range) {
  for (const target of targets) target.element.classList.remove('range-selected')
  if (range.from === range.to) {
    // Show the boundary numerically outside the grid; highlight a containing
    // table only as context, never manufacture a row/cell at an empty position.
    const table = targets.find(t => t.type === 'table' && t.from <= range.from && range.to <= t.to)
    table?.element.classList.add('range-selected')
    return {element:table?.element,located:true,boundary:true}
  }
  const contained = targets.filter(t => t.from >= range.from && t.to <= range.to)
  const top = contained.filter(t => !contained.some(parent => parent !== t && parent.from < t.from && parent.to > t.to))
  for (const target of top) target.element.classList.add('range-selected')
  return {element:top[0]?.element,located:top.length>0,boundary:false}
}
