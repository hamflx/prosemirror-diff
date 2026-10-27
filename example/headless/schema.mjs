import {Schema} from 'prosemirror-model'

// This executable example deliberately owns one schema. It never loads user code.
export const schema = new Schema({nodes: {
  doc: {content: 'block*'},
  paragraph: {group: 'block', content: 'inline*', attrs: {align: {default: null}}},
  heading: {group: 'block', content: 'inline*', attrs: {level: {default: 1}}},
  bullet_list: {group: 'block', content: 'list_item+'},
  list_item: {content: 'paragraph block*'},
  container: {group: 'block', content: 'block'},
  image: {group: 'block', attrs: {src: {}, alt: {default: ''}}},
  inline_token: {inline: true, group: 'inline', atom: true, attrs: {label: {}}},
  hard_break: {inline: true, group: 'inline'},
  text: {group: 'inline'}
}, marks: {
  strong: {}, em: {}, code: {excludes: '_'},
  link: {attrs: {href: {}, title: {default: null}}}
}})
const nullableString = value => value === null || typeof value === 'string'
const string = value => typeof value === 'string'
const nodeAttrs = {
  doc: {}, paragraph: {align: value => value === null || ['left', 'center', 'right'].includes(value)},
  heading: {level: value => Number.isInteger(value) && value >= 1 && value <= 6},
  bullet_list: {}, list_item: {}, container: {}, image: {src: string, alt: string},
  inline_token: {label: string}, hard_break: {}, text: {}
}
const markAttrs = {strong: {}, em: {}, code: {}, link: {href: string, title: nullableString}}
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`)
}
function keys(value, allowed, label) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`Unknown ${label} field: ${key}`)
}
function attrs(value, rules) {
  if (value === undefined || value === null) return
  object(value, 'attrs')
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(rules, key) || !rules[key](value[key])) throw new TypeError(`Unknown or invalid attribute: ${key}`)
  }
}
function validateNode(value) {
  object(value, 'node')
  if (typeof value.type !== 'string' || !Object.hasOwn(nodeAttrs, value.type)) throw new TypeError('Unknown node type')
  keys(value, value.type === 'text' ? ['type', 'text', 'marks'] : ['type', 'attrs', 'marks', 'content'], 'node')
  if (value.type === 'text' && typeof value.text !== 'string') throw new TypeError('Text must be a string')
  attrs(value.attrs, nodeAttrs[value.type])
  if (value.marks !== undefined) {
    if (!Array.isArray(value.marks)) throw new TypeError('Marks must be an array')
    for (const mark of value.marks) {
      object(mark, 'mark')
      if (typeof mark.type !== 'string' || !Object.hasOwn(markAttrs, mark.type)) throw new TypeError('Unknown mark type')
      keys(mark, ['type', 'attrs'], 'mark'); attrs(mark.attrs, markAttrs[mark.type])
    }
  }
  if (value.content !== undefined) {
    if (!Array.isArray(value.content)) throw new TypeError('Content must be an array')
    value.content.forEach(validateNode)
  }
}
export function readSnapshot(json) {
  validateNode(json)
  if (json.type !== 'doc') throw new TypeError('Snapshot root must be doc')
  const doc = schema.nodeFromJSON(json)
  doc.check()
  return doc
}
