import {DOMSerializer} from 'prosemirror-model'
import {diffEditor} from '../../src/diff.js'
import {compareLegacyOrExplain} from './legacy-migration.js'
import {schema, scenarios} from './legacy-migration-scenarios.js'
import './metadata-demo.css'

const byId = id => document.getElementById(id)
const select = byId('scenario'), serializer = DOMSerializer.fromSchema(schema)
const render = (node, target) => target.replaceChildren(serializer.serializeFragment(node.content, {document}))

function load() {
  const scenario = scenarios.find(item => item.id === select.value)
  // Preserve the originals and clear any previous combined result before trying.
  render(scenario.oldDoc, byId('before'))
  render(scenario.newDoc, byId('after'))
  byId('combined').replaceChildren()
  byId('comparison-message').textContent = ''
  byId('scenario-note').textContent = scenario.note
  const result = compareLegacyOrExplain(() => diffEditor(schema, scenario.oldDoc.toJSON(), scenario.newDoc.toJSON()))
  byId('comparison-status').dataset.state = result.status
  if (result.status === 'available') {
    render(result.node, byId('combined'))
    byId('comparison-status').textContent = 'Combined result available'
  } else {
    byId('comparison-status').textContent = 'Combined result unavailable; original versions retained'
    byId('comparison-message').textContent = result.message
  }
}

for (const scenario of scenarios) {
  const option = document.createElement('option')
  option.value = scenario.id
  option.textContent = scenario.title
  select.append(option)
}
select.addEventListener('change', load)
load()
