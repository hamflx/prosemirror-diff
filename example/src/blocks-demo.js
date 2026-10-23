import {compareDocumentBlocks} from '../../src/blocks.js'
import {scenarios} from './blocks-scenarios.js'
import './blocks-demo.css'

const byId = id => document.getElementById(id)
const select = byId('scenario')
const budget = byId('budget')
const previous = byId('previous')
const next = byId('next')
const list = byId('changes')
const targets = {old: [], new: []}
const boundaries = {old: new Map(), new: new Map()}
const buttons = []
let changes = []
let selected = -1

function element(tag, text) {
  const node = document.createElement(tag)
  if (text !== undefined) node.textContent = text
  return node
}

// This renderer is intentionally limited to the fixture schema. It renders
// each original independently; UI labels/markers are outside the PM documents.
function renderNode(node) {
  if (node.type.name === 'image') {
    const figure = element('figure')
    const img = element('img')
    img.src = node.attrs.src
    img.alt = node.attrs.alt
    figure.append(img, element('figcaption', node.attrs.alt))
    return figure
  }
  if (node.type.name === 'container') {
    const container = element('div')
    container.className = 'strict-container'
    container.append(element('span', 'Container · exactly one child'))
    node.forEach(child => container.append(renderNode(child)))
    return container
  }
  const text = element(node.type.name === 'heading' ? 'h3' : 'p', node.textContent || 'Empty paragraph')
  if (!node.textContent) text.className = 'empty-block'
  return text
}

function render(doc, side, panel) {
  panel.replaceChildren()
  targets[side] = []
  boundaries[side].clear()
  const addBoundary = position => {
    const marker = element('div')
    marker.className = 'position-marker'
    marker.dataset.position = String(position)
    marker.hidden = true
    boundaries[side].set(position, marker)
    panel.append(marker)
  }
  doc.forEach((node, position) => {
    addBoundary(position)
    const block = element('div')
    block.className = 'block'
    block.dataset.from = String(position)
    block.dataset.to = String(position + node.nodeSize)
    const label = element('span', `${node.type.name} [${position}, ${position + node.nodeSize})`)
    label.className = 'block-label'
    block.append(label, renderNode(node))
    panel.append(block)
    targets[side].push({element: block, from: position, to: position + node.nodeSize})
  })
  addBoundary(doc.content.size)
  if (!doc.childCount) panel.append(element('p', 'Empty document'))
}

function activate(index, scroll = false) {
  selected = index >= 0 && index < changes.length ? index : -1
  const change = changes[selected]
  buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === selected)))
  for (const side of ['old', 'new']) {
    let first
    for (const marker of boundaries[side].values()) {
      marker.hidden = true
      marker.textContent = ''
    }
    for (const target of targets[side]) {
      const active = !!change && target.from >= change[`${side}From`] && target.to <= change[`${side}To`]
      target.element.classList.toggle('selected-change', active)
      if (active && !first) first = target.element
    }
    if (change && change[`${side}From`] === change[`${side}To`]) {
      const position = change[`${side}From`]
      const marker = boundaries[side].get(position)
      marker.hidden = false
      marker.textContent = `${side === 'old' ? 'Insertion' : 'Deletion'} point at ${position} · empty range [${position}, ${position})`
      first = marker
    }
    if (scroll && first) first.scrollIntoView({block: 'nearest', inline: 'nearest'})
  }
  previous.disabled = selected <= 0
  next.disabled = selected < 0 || selected >= changes.length - 1
  byId('status').textContent = change ? `Change ${selected + 1} of ${changes.length} · ${change.kind} · located on both sides` : 'No block changes'
}

function load() {
  const scenario = scenarios.find(item => item.id === select.value)
  changes = []
  buttons.length = 0
  list.replaceChildren()
  byId('scenario-note').textContent = scenario.note
  const error = byId('error')
  error.hidden = true
  error.textContent = ''
  let result
  try {
    result = compareDocumentBlocks(scenario.oldDoc, scenario.newDoc, {maxCells: Number(budget.value)})
    changes = result.changes
  } catch (cause) {
    error.hidden = false
    error.textContent = `Comparison unavailable: ${cause.message}`
  }
  const precision = byId('precision')
  precision.classList.toggle('fallback', !!result?.fallback)
  precision.textContent = !result ? 'No comparison result' : result.fallback
    ? 'Coarse fallback: the changed middle is one range; it may include unchanged blocks.'
    : 'No budget fallback: exact block matches retained. Nested edits still replace whole blocks.'
  render(scenario.oldDoc, 'old', byId('before'))
  render(scenario.newDoc, 'new', byId('after'))
  changes.forEach((change, index) => {
    const item = element('li')
    const button = element('button', `${index + 1}. ${change.kind} · ${change.before.length} before / ${change.after.length} after`)
    button.type = 'button'
    button.addEventListener('click', () => activate(index, true))
    buttons.push(button)
    item.append(button, element('p', `Before [${change.oldFrom}, ${change.oldTo}) → After [${change.newFrom}, ${change.newTo})`))
    list.append(item)
  })
  activate(changes.length ? 0 : -1)
  if (!result) byId('status').textContent = 'Comparison unavailable · no change list'
}

for (const scenario of scenarios) {
  const option = element('option', scenario.title)
  option.value = scenario.id
  select.append(option)
}
select.addEventListener('change', load)
budget.addEventListener('change', load)
previous.addEventListener('click', () => activate(selected - 1, true))
next.addEventListener('click', () => activate(selected + 1, true))
load()
