import {Schema} from 'prosemirror-model'
import {compareDocumentMetadata, compareNodeMetadata} from '../../src/metadata.js'

// Small, explicit fixture schema: no diffMark or editor instance is required.
export const schema = new Schema({
  nodes: {
    doc: {content: 'block+'},
    paragraph: {group: 'block', content: 'inline*'},
    image: {group: 'block', attrs: {src: {}, alt: {default: ''}}},
    text: {group: 'inline'}
  },
  marks: {strong: {}, link: {attrs: {href: {}}}}
})
const text = (value, marks = []) => schema.text(value, marks)
const paragraph = content => schema.node('paragraph', null, content)
const document = content => schema.node('doc', null, content)
const image = updated => schema.node('image', {
  src: updated ? new URL('../assets/cover-after.svg', import.meta.url).href : new URL('../assets/cover-before.svg', import.meta.url).href,
  alt: updated ? 'Blue cover with a pale circle' : 'Green cover with a pale circle'
})
const bold = updated => paragraph([text('A '), text('clear decision', updated ? [schema.mark('strong')] : []), text(' matters.')])
const link = updated => paragraph([text('Read the '), text('project notes', [schema.mark('link', {
  href: updated ? 'https://example.org/notes/revised' : 'https://example.org/notes/original'
})]), text('.')])
const pair = (id, title, build) => ({id, title, oldDoc: document(build(false)), newDoc: document(build(true))})
const selectedParagraph = updated => paragraph([
  text('Review '), text('these notes', updated ? [schema.mark('strong')] : []),
  text(' at '), text('project notes', [schema.mark('link', {
    href: updated ? 'https://example.org/notes/revised' : 'https://example.org/notes/original'
  })]), text('.')
])
const oldIntro = paragraph(text('Old intro.'))
const newIntro = paragraph(text('Updated introduction.'))
export const scenarios = [
  pair('combined', 'Formatting, link and image', updated => [bold(updated), link(updated), image(updated)]),
  pair('bold', 'Add bold formatting', updated => [bold(updated)]),
  pair('link', 'Change a link target', updated => [link(updated)]),
  pair('image', 'Change image attributes', updated => [image(updated)]),
  {id: 'selected-node', title: 'Caller-selected paragraph (other edits excluded)',
    oldDoc: document([oldIntro, selectedParagraph(false), paragraph(text('Pending.'))]),
    newDoc: document([newIntro, selectedParagraph(true), paragraph(text('Ready for review.'))]),
    // Explicit fixture correspondence, not inferred from the surrounding edits.
    scope: {oldIndex: 1, newIndex: 1, oldFrom: oldIntro.nodeSize, newFrom: newIntro.nodeSize}},
  pair('unchanged', 'Identical documents', () => [bold(false)]),
  {id: 'unsupported', title: 'Text edit (outside scope)',
    oldDoc: document([paragraph(text('The text stays the same.'))]),
    newDoc: document([paragraph(text('The text has changed.'))])}
]

export function compareScenario(scenario) {
  if (!scenario.scope) return compareDocumentMetadata(scenario.oldDoc, scenario.newDoc)
  const {oldIndex, newIndex, oldFrom, newFrom} = scenario.scope
  return compareNodeMetadata(scenario.oldDoc.child(oldIndex), scenario.newDoc.child(newIndex), {oldFrom, newFrom})
}

/** Split a text node at event boundaries so each highlighted fragment is exact. */
export function textSegments(node, start, changes, side) {
  const end = start + node.nodeSize
  const boundaries = new Set([start, end])
  for (const change of changes) {
    for (const position of [change[`${side}From`], change[`${side}To`]]) {
      if (position > start && position < end) boundaries.add(position)
    }
  }
  const sorted = [...boundaries].sort((a, b) => a - b)
  return sorted.slice(0, -1).map((from, index) => ({
    from, to: sorted[index + 1], text: node.text.slice(from - start, sorted[index + 1] - start), marks: node.marks
  }))
}

export function rangeMatches(from, to, change, side) {
  return from >= change[`${side}From`] && to <= change[`${side}To`]
}
