import {equalBlockAnchors,mountPairedLayout} from './paired-layout.js'
import {scenarios, compareScenario, textSegments, rangeMatches} from './metadata-scenarios.js'
import './metadata-demo.css'

export function mountMetadataDemo(root) {

const byId = id => root.querySelector("#" + id)
const select = byId('scenario')
const previous = byId('previous')
const next = byId('next')
const list = byId('changes')
let pairedLayout
const blockTargets={old:[],new:[]}
let changes = []
let selected = -1
const targets = {old: [], new: []}
const buttons = []
const element = (tag, text) => {
  const result = document.createElement(tag)
  if (text !== undefined) result.textContent = text
  return result
}

// Renderer intentionally supports only the fixed fixture schema above.
function render(doc, side, container) {
  container.replaceChildren()
  targets[side] = []
  blockTargets[side]=[]
  doc.forEach((block, offset) => {
    if (block.type.name === 'image') {
      const figure = element('figure')
      const img = element('img')
      img.src = block.attrs.src
      img.alt = block.attrs.alt
      figure.append(img, element('figcaption', block.attrs.alt))
      container.append(figure)
      blockTargets[side].push({from:offset,element:figure})
      targets[side].push({element: figure, from: offset, to: offset + block.nodeSize})
      return
    }
    const paragraph = element('p')
    block.forEach((node, inlineOffset) => {
      for (const segment of textSegments(node, offset + 1 + inlineOffset, changes, side)) {
        const span = element('span')
        let content = document.createTextNode(segment.text)
        for (const mark of segment.marks) {
          const wrapper = element(mark.type.name === 'strong' ? 'strong' : 'a')
          if (mark.type.name === 'link') {
            wrapper.href = mark.attrs.href
            wrapper.title = mark.attrs.href + ' (demo link; ordinary click disabled)'
            wrapper.addEventListener('click', event => event.preventDefault())
          }
          wrapper.append(content)
          content = wrapper
        }
        span.append(content)
        paragraph.append(span)
        targets[side].push({element: span, from: segment.from, to: segment.to})
      }
    })
    container.append(paragraph)
    blockTargets[side].push({from:offset,element:paragraph})
  })
}

function activate(index, scroll = false) {
  selected = index
  buttons.forEach((button, position) => button.setAttribute('aria-pressed', String(position === index)))
  for (const side of ['old', 'new']) {
    let first
    for (const target of targets[side]) {
      const active = index >= 0 && rangeMatches(target.from, target.to, changes[index], side)
      target.element.classList.toggle('selected-change', active)
      if (active && !first) first = target.element
    }
    if (scroll && first) first.scrollIntoView({block: 'nearest', inline: 'nearest'})
  }
  previous.disabled = index <= 0
  next.disabled = index < 0 || index >= changes.length - 1
  byId('status').textContent = changes.length ? `Change ${index + 1} of ${changes.length} · located on both sides` : 'No metadata changes'
}

function load() {
  pairedLayout?.dispose()
  const scenario = scenarios.find(item => item.id === select.value)
  changes = []
  buttons.length = 0
  list.replaceChildren()
  const error = byId('error')
  error.hidden = true
  error.textContent = ''
  const scope = byId('comparison-scope')
  scope.classList.toggle('selected-scope', Boolean(scenario.scope))
  if (scenario.scope) {
    const {oldIndex, newIndex, oldFrom, newFrom} = scenario.scope
    scope.textContent = `Selected paragraph only. Before [${oldFrom}, ${oldFrom + scenario.oldDoc.child(oldIndex).nodeSize}) / After [${newFrom}, ${newFrom + scenario.newDoc.child(newIndex).nodeSize}). Other text edits are NOT compared. This fixed pair is explicitly chosen by the caller; no automatic matching.`
  } else {
    scope.textContent = 'Whole-document metadata comparison. Both documents must have identical text and structure; text or structural edits are rejected.'
  }
  byId('changes-title').textContent = scenario.scope ? 'Metadata changes in selected paragraph only' : 'Changes'
  try {
    changes = compareScenario(scenario)
  } catch (cause) {
    error.textContent = `Comparison unavailable: ${cause.message}`
    error.hidden = false
  }
  render(scenario.oldDoc, 'old', byId('before'))
  render(scenario.newDoc, 'new', byId('after'))
  const anchors=!scenario.scope&&error.hidden ? blockTargets.old.map((t,i)=>[t.element,blockTargets.new[i]?.element]) : equalBlockAnchors(scenario.oldDoc,scenario.newDoc).map(([a,b])=>[blockTargets.old.find(t=>t.from===a)?.element,blockTargets.new.find(t=>t.from===b)?.element])
  pairedLayout=mountPairedLayout([byId('before'),byId('after')],anchors)
  changes.forEach((change, index) => {
    const item = element('li')
    const button = element('button', `${index + 1}. ${change.nodeType} ${change.kind === 'marks' ? 'formatting / link' : 'attributes'}`)
    button.type = 'button'
    button.addEventListener('click', () => activate(index, true))
    buttons.push(button)
    item.append(button, element('p', `Before [${change.oldFrom}, ${change.oldTo}) → After [${change.newFrom}, ${change.newTo})`))
    const values = element('div')
    values.className = 'values'
    for (const [label, value] of [['Before', change.before], ['After', change.after]]) {
      const detail = element('div')
      detail.append(element('h3', label), element('pre', JSON.stringify(value, null, 2)))
      values.append(detail)
    }
    item.append(values)
    list.append(item)
  })
  activate(changes.length ? 0 : -1)
  if (!error.hidden) byId('status').textContent = 'Outside metadata-only scope · no change list'
}

for (const scenario of scenarios) {
  const option = element('option', scenario.title)
  option.value = scenario.id
  select.append(option)
}
select.addEventListener('change', load)
previous.addEventListener('click', () => activate(selected - 1, true))
next.addEventListener('click', () => activate(selected + 1, true))
load()

return {dispose(){pairedLayout?.dispose();root.replaceChildren()}}
}
