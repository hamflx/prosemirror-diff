import {compareDocumentBlocks} from '../../src/blocks.js'
import {scenarios} from './blocks-scenarios.js'
import {element, renderDocument, boundaryKey, changeEntries} from './blocks-view.js'
import {createTextReview} from './text-review-view.js'
import {createSelectedReview} from './selected-review.js'
import './blocks-demo.css'

const byId = id => document.getElementById(id)
const select = /** @type {HTMLSelectElement} */ (byId('scenario'))
const budget = /** @type {HTMLSelectElement} */ (byId('budget'))
const depth = /** @type {HTMLSelectElement} */ (byId('depth'))
const previous = /** @type {HTMLButtonElement} */ (byId('previous'))
const next = /** @type {HTMLButtonElement} */ (byId('next'))
const list = byId('changes')
const views = {}
const buttons = []
let entries = []
let selected = -1
let textReview

function activate(index, scroll = false) {
  selected = index >= 0 && index < entries.length ? index : -1
  const entry = entries[selected], change = entry?.change
  buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === selected)))
  for (const side of ['old', 'new']) {
    let first
    const {boundaries, targets} = views[side]
    for (const marker of boundaries.values()) {
      marker.hidden = true
      marker.textContent = ''
    }
    for (const target of targets) {
      const active = !!entry && target.scope === entry.scopes[side] &&
        target.from >= change[`${side}From`] && target.to <= change[`${side}To`]
      target.element.classList.toggle('selected-change', active)
      if (active && !first) first = target.element
    }
    if (change && change[`${side}From`] === change[`${side}To`]) {
      const position = change[`${side}From`]
      const marker = boundaries.get(boundaryKey(entry.scopes[side], position))
      marker.hidden = false
      marker.textContent = `${side === 'old' ? 'Insertion' : 'Deletion'} point at ${position} · empty range [${position}, ${position})`
      first = marker
    }
    if (scroll && first) first.scrollIntoView({block: 'nearest', inline: 'nearest'})
  }
  previous.disabled = selected <= 0
  next.disabled = selected < 0 || selected >= entries.length - 1
  byId('status').textContent = entry
    ? `Change ${selected + 1} of ${entries.length} · item ${entry.label} · ${change.kind} · located on both sides`
    : 'No block changes'
  textReview.select(entry, views)
}

function renderList() {
  const childLists = new Map()
  for (const entry of entries) {
    const {change, label, parent, index} = entry
    const item = element('li')
    item.dataset.change = label
    const button = element('button', `${label}. ${change.kind} · ${change.before.length} before / ${change.after.length} after`)
    button.type = 'button'
    button.addEventListener('click', () => activate(index, true))
    buttons.push(button)
    item.append(button, element('p', `Before [${change.oldFrom}, ${change.oldTo}) → After [${change.newFrom}, ${change.newTo})`))
    if (change.details) {
      const note = element('p', change.details.truncated
        ? 'Depth limit reached here. Empty details do not mean equal contents; the complete parent event remains.'
        : change.details.fallback
          ? 'Local coarse fallback: this child layer may include unchanged blocks. The complete parent event remains.'
          : 'Child layer retained exact block matches. Deeper layers have their own precision status.')
      note.className = 'detail-status'
      if (change.details.fallback || change.details.truncated) note.classList.add('limited')
      item.append(note)
      if (change.details.changes.length) {
        const children = element('ol')
        children.className = 'detail-list'
        childLists.set(entry, children)
        item.append(children)
      }
    }
    const destination = parent ? childLists.get(parent) : list
    destination.append(item)
  }
}

function load() {
  textReview?.dispose()
  const scenario = scenarios.find(item => item.id === select.value)
  entries = []
  buttons.length = 0
  list.replaceChildren()
  byId('scenario-note').textContent = scenario.note
  const error = byId('error')
  error.hidden = true
  error.textContent = ''
  let result, summary
  try {
    result = compareDocumentBlocks(scenario.oldDoc, scenario.newDoc, {
      maxCells: Number(budget.value), maxDepth: Number(depth.value)
    })
    const flattened = changeEntries(result)
    entries = flattened.entries
    summary = flattened.summary
  } catch (cause) {
    error.hidden = false
    error.textContent = `Comparison unavailable: ${cause.message}`
  }
  const precision = byId('precision')
  const limited = summary && (summary.rootFallback || summary.nestedFallbacks || summary.truncated)
  precision.classList.toggle('fallback', !!limited)
  precision.textContent = !summary ? 'No comparison result' : [
    summary.rootFallback ? 'Coarse fallback at root: the changed middle may include unchanged blocks.' : 'Root has no budget fallback.',
    `${summary.nestedFallbacks} nested fallback layer(s); ${summary.truncated} depth-limited event(s).`,
    depth.value === '0' ? 'Nested details off (depth 0).' : 'Parent events remain complete; details are informational, not additional edits.'
  ].join(' ')
  views.old = renderDocument(scenario.oldDoc, byId('before'))
  views.new = renderDocument(scenario.newDoc, byId('after'))
  textReview = createSelectedReview(createTextReview())
  renderList()
  activate(entries.length ? 0 : -1)
  if (!result) byId('status').textContent = 'Comparison unavailable · no change list'
}

for (const scenario of scenarios) {
  const option = element('option', scenario.title)
  option.value = scenario.id
  select.append(option)
}
select.addEventListener('change', load)
budget.addEventListener('change', load)
depth.addEventListener('change', load)
previous.addEventListener('click', () => activate(selected - 1, true))
next.addEventListener('click', () => activate(selected + 1, true))
load()
