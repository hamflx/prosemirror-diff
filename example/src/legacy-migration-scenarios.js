import {Schema} from 'prosemirror-model'

export const schema = new Schema({nodes: {
  doc: {content: 'block+'},
  paragraph: {group: 'block', content: 'text*', toDOM: () => ['p', 0]},
  heading: {group: 'block', content: 'text*', toDOM: () => ['h3', 0]},
  code_block: {group: 'block', content: 'text*', marks: '', toDOM: () => ['pre', ['code', 0]]},
  container: {group: 'block', content: 'block', toDOM: () => ['section', {class: 'strict-container'}, 0]},
  text: {}
}, marks: {
  strong: {toDOM: () => ['strong', 0]},
  code: {excludes: '_', toDOM: () => ['code', 0]},
  diffMark: {attrs: {type: {default: 0}}, toDOM: mark => [mark.attrs.type === -1 ? 'del' : 'ins', 0]}
}})
const block = (type, text, marks = []) => schema.node(type, null, schema.text(text, marks))
const pair = (id, title, note, before, after) => ({id, title, note,
  oldDoc: schema.node('doc', null, before), newDoc: schema.node('doc', null, after)})
export const scenarios = [
  pair('ordinary', 'Supported formatting', 'Ordinary strong formatting permits a mixed marked result.',
    block('paragraph', 'cat', [schema.mark('strong')]), block('paragraph', 'cart', [schema.mark('strong')])),
  pair('exclusive', 'Exclusive code mark', 'Code excludes other marks. The example preserves code in both originals instead of stripping it.',
    block('paragraph', 'cat', [schema.mark('code')]), block('paragraph', 'cart', [schema.mark('code')])),
  pair('code-block', 'Code block without child marks', 'This code block permits text but disallows child marks. The originals remain valid.',
    block('code_block', 'a'), block('code_block', 'b')),
  pair('strict-container', 'Strict single-child container', 'Each container permits one child; placing both replaced children inside it is invalid.',
    schema.node('container', null, block('heading', 'Same title')),
    schema.node('container', null, block('paragraph', 'Same title')))
]
