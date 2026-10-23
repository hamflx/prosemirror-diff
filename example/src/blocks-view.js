import {renderTextSource, renderMarkDescriptions} from './text-source-view.js'

export function element(tag, text) {
  const node = document.createElement(tag)
  if (text !== undefined) node.textContent = text
  return node
}

export const boundaryKey = (scope, position) => `${scope}:${position}`

// Both inputs are rendered independently. Scope is the absolute start of the
// containing block (-1 for the document), so child and parent targets differ.
export function renderDocument(doc, panel) {
  const targets = []
  const boundaries = new Map()
  panel.replaceChildren()

  function renderChildren(parent, offset, scope, destination) {
    const addBoundary = position => {
      const marker = element('div')
      marker.className = 'position-marker'
      marker.dataset.position = String(position)
      marker.dataset.scope = String(scope)
      marker.hidden = true
      boundaries.set(boundaryKey(scope, position), marker)
      destination.append(marker)
    }
    parent.forEach((node, childOffset) => {
      const from = offset + childOffset, to = from + node.nodeSize
      addBoundary(from)
      const block = element('div')
      block.className = 'block'
      Object.assign(block.dataset, {from: String(from), to: String(to), scope: String(scope), nodeType: node.type.name})
      const label = element('span', `${node.type.name} [${from}, ${to})`)
      label.className = 'block-label'
      block.append(label)
      const target = {element: block, from, to, scope}
      targets.push(target)
      if (node.type.name === 'image') {
        const figure = element('figure')
        const img = element('img')
        img.src = node.attrs.src
        img.alt = node.attrs.alt
        figure.append(img, element('figcaption', node.attrs.alt))
        block.append(figure)
      } else if (node.type.name === 'container' || node.type.name === 'section') {
        const container = element('div')
        container.className = node.type.name === 'container' ? 'strict-container' : 'nested-container'
        container.append(element('span', node.type.name === 'container' ? 'Container · exactly one child' : 'Section · block children'))
        const content = element('div')
        content.className = 'child-content'
        content.dataset.scope = String(from)
        renderChildren(node, from + 1, from, content)
        container.append(content)
        block.append(container)
      } else {
        const text = element(node.type.name === 'heading' ? 'h3' : 'p')
        text.className = 'source-text'
        target.source = text
        renderTextSource(text, node)
        if (!node.childCount) {
          text.classList.add('empty-block')
          block.append(element('span', 'Empty paragraph'))
        }
        block.append(text)
        const descriptions = renderMarkDescriptions(node, from)
        if (descriptions.childNodes.length) block.append(descriptions)
      }
      destination.append(block)
    })
    addBoundary(offset + parent.content.size)
    if (!parent.childCount) destination.append(element('p', scope === -1 ? 'Empty document' : 'Empty container'))
  }

  renderChildren(doc, 0, -1, panel)
  return {targets, boundaries}
}

// Preorder gives navigation an explicit parent-before-child order. The entries
// are informational; parent and child changes must never be applied as edits.
export function changeEntries(result) {
  const entries = []
  const summary = {rootFallback: result.fallback, nestedFallbacks: 0, truncated: 0}
  function visit(changes, parent, scopes, prefix) {
    changes.forEach((change, index) => {
      const label = prefix ? `${prefix}.${index + 1}` : String(index + 1)
      const entry = {change, parent, scopes, label, index: entries.length}
      entries.push(entry)
      if (change.details) {
        if (change.details.fallback) summary.nestedFallbacks++
        if (change.details.truncated) summary.truncated++
        visit(change.details.changes, entry, {old: change.oldFrom, new: change.newFrom}, label)
      }
    })
  }
  visit(result.changes, null, {old: -1, new: -1}, '')
  return {entries, summary}
}
