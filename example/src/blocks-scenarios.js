import {Schema} from 'prosemirror-model'

export const schema = new Schema({nodes: {
  doc: {content: 'block*'},
  paragraph: {group: 'block', content: 'text*'},
  heading: {group: 'block', content: 'text*'},
  container: {group: 'block', content: 'block'},
  section: {group: 'block', content: 'block*'},
  image: {group: 'block', attrs: {src: {}, alt: {default: ''}}},
  text: {}
}})
const p = value => schema.node('paragraph', null, value ? schema.text(value) : null)
const doc = nodes => schema.node('doc', null, nodes)
const section = nodes => schema.node('section', null, nodes)
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
  scenario('nested-details', 'Inspect a changed child block', 'Select depth 1 to keep the parent replacement and inspect the changed paragraph inside the section.',
    [section([p('Keep'), p('Old'), p('Tail')])], [section([p('Keep'), p('Updated'), p('Tail')])]),
  scenario('nested-depth', 'Inspect depth limits', 'At depth 1, a deeper eligible event is truncated. Depth 2 reveals the paragraph range; the parent events remain.',
    [section([section([p('Old')])])], [section([section([p('Updated')])])]),
  scenario('nested-insert', 'Insert inside an empty container', 'Depth 1 locates the empty old range inside the section, not at the document boundary.',
    [section([])], [section([p('')])]),
  scenario('nested-delete', 'Delete inside a container', 'Depth 1 locates the empty new range inside the section, while retaining the parent replacement.',
    [section([p('')])], [section([])]),
  scenario('nested-repeated', 'Align repeated child blocks', 'Depth 1 gives deterministic child deletion/insertion events, not identity or move detection.',
    [section([p('A'), p('B'), p('A')])], [section([p('B'), p('A'), p('B')])]),
  scenario('shared-budget', 'Share budget across sibling details', 'With depth 1 and 20 cells, root alignment and the first child consume the budget; the second child falls back. At 24 cells neither child falls back.',
    [section([p('A')]), p('Anchor'), section([p('B')])],
    [section([p('X')]), p('Anchor'), section([p('Y')])]),
  scenario('unchanged', 'Identical documents', 'No block changes: there are no selected ranges or active navigation controls.',
    [p('Unchanged'), image(false)], [p('Unchanged'), image(false)])
]
