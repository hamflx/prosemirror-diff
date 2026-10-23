import {Schema} from 'prosemirror-model'

export const schema = new Schema({nodes: {
  doc: {content: 'block*'},
  paragraph: {group: 'block', content: 'text*'},
  heading: {group: 'block', content: 'text*'},
  container: {group: 'block', content: 'block'},
  image: {group: 'block', attrs: {src: {}, alt: {default: ''}}},
  text: {}
}})
const p = value => schema.node('paragraph', null, value ? schema.text(value) : null)
const doc = nodes => schema.node('doc', null, nodes)
const image = revised => schema.node('image', {
  src: revised ? new URL('../assets/cover-after.svg', import.meta.url).href : new URL('../assets/cover-before.svg', import.meta.url).href,
  alt: revised ? 'Revised blue cover' : 'Original green cover'
})
const scenario = (id, title, note, before, after) => ({id, title, note, oldDoc: doc(before), newDoc: doc(after)})

export const scenarios = [
  scenario('insert', 'Insert a paragraph', 'The Before side has an empty insertion range between unchanged blocks.',
    [p('Opening'), p('Closing')], [p('Opening'), p('New paragraph'), p('Closing')]),
  scenario('delete', 'Delete a paragraph', 'The After side marks the position where the deleted block used to be.',
    [p('Opening'), p('Removed paragraph'), p('Closing')], [p('Opening'), p('Closing')]),
  scenario('empty-block', 'Insert an empty block', 'An empty paragraph still occupies two ProseMirror positions and is a real block.',
    [p('Opening'), image(false)], [p('Opening'), p(''), image(false)]),
  scenario('image', 'Replace image attributes', 'Image attributes participate in exact block equality; the image is a one-position leaf.',
    [p('Cover'), image(false)], [p('Cover'), image(true)]),
  scenario('strict-container', 'Replace a strict container child', 'Each container permits exactly one child. Both originals stay valid; no mixed document is created.',
    [schema.node('container', null, schema.node('heading', null, schema.text('Same title')))],
    [schema.node('container', null, p('Same title'))]),
  scenario('repeated', 'Align repeated blocks', 'Equal repeated text does not prove identity. This deterministic result uses deletion/insertion, not move events.',
    [p('A'), p('B'), p('A')], [p('B'), p('A'), p('B')]),
  scenario('budget', 'Compare alignment budgets', 'Default alignment keeps the middle anchor. Zero cells combines the changed middle into one coarse replacement.',
    [p('Old opening'), p('Unchanged anchor'), p('Old ending')],
    [p('New opening'), p('Unchanged anchor'), p('New ending')]),
  scenario('empty-document', 'Insert into an empty document', 'An empty document has a boundary at position zero. The marker is still locatable.',
    [], [p('First paragraph')]),
  scenario('unchanged', 'Identical documents', 'No block changes: there are no selected ranges or active navigation controls.',
    [p('Unchanged'), image(false)], [p('Unchanged'), image(false)])
]
