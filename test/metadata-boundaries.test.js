import {describe, expect, it} from 'vitest'
import {Schema} from 'prosemirror-model'
import {compareDocumentMetadata, compareNodeMetadata} from '../src/index.js'

const schema = new Schema({nodes: {
  doc: {content: 'paragraph+'},
  paragraph: {content: 'text*', attrs: {data: {default: null}}},
  text: {}
}, marks: {strong: {}, link: {attrs: {href: {}, data: {default: null}}}}})
const paragraph = (content = [], data = null) => schema.node('paragraph', {data}, content)
const document = content => schema.node('doc', null, content)
const freezeData = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeData)
    Object.freeze(value)
  }
}
// Freeze the complete input value graph without freezing shared schema objects.
const freezeNode = node => {
  freezeData(node.attrs)
  for (const mark of node.marks) { freezeData(mark.attrs); Object.freeze(mark) }
  Object.freeze(node.marks)
  node.forEach(freezeNode)
  Object.freeze(node.content.content)
  Object.freeze(node.content)
  Object.freeze(node)
  return node
}

describe('metadata public contract boundaries', () => {
  it('preserves JSON own keys including __proto__ as detached data', () => {
    const oldData = JSON.parse('{"__proto__":{"label":"old"},"constructor":"old","toString":"old"}')
    const newData = JSON.parse('{"__proto__":{"label":"new"},"constructor":"new","toString":"new"}')
    const old = paragraph([], oldData), next = paragraph([], newData)
    const [change] = compareNodeMetadata(old, next)
    expect(change.before.data).toEqual(oldData)
    expect(change.after.data).toEqual(newData)
    for (const value of [change.before.data, change.after.data]) {
      expect(Object.hasOwn(value, '__proto__')).toBe(true)
      expect(Object.getPrototypeOf(value)).toBe(Object.prototype)
    }
    change.before.data.__proto__.label = 'edited snapshot'
    change.after.data.constructor = 'edited snapshot'
    expect(oldData.__proto__.label).toBe('old')
    expect(newData.constructor).toBe('new')
    expect(Object.hasOwn(Object.prototype, 'label')).toBe(false)
  })

  it('compares null-prototype dictionaries by their data and detaches nested arrays', () => {
    const dictionary = Object.assign(Object.create(null), {items: [{label: 'same'}], enabled: false})
    const plain = {enabled: false, items: [{label: 'same'}]}
    expect(compareDocumentMetadata(document(paragraph([], dictionary)), document(paragraph([], plain)))).toEqual([])
    const changed = Object.assign(Object.create(null), {items: [{label: 'new'}], enabled: false})
    const [change] = compareDocumentMetadata(document(paragraph([], dictionary)), document(paragraph([], changed)))
    expect(change.before.data.items).not.toBe(dictionary.items)
    expect(change.after.data.items[0]).not.toBe(changed.items[0])
    change.before.data.items[0].label = 'snapshot'
    change.after.data.items.push({label: 'extra'})
    expect(dictionary.items).toEqual([{label: 'same'}])
    expect(changed.items).toEqual([{label: 'new'}])
  })

  it('reads deeply frozen nodes and mark attrs while returning mutable detached snapshots', () => {
    const make = value => document(paragraph(schema.text('link', [schema.mark('link', {
      href: '/' + value, data: {tags: [value]}
    })]), {items: [value]}))
    const old = freezeNode(make('old')), next = freezeNode(make('new'))
    const original = structuredClone([old.toJSON(), next.toJSON()])
    const changes = compareDocumentMetadata(old, next)
    expect(changes.map(c => c.kind)).toEqual(['attrs', 'marks'])
    expect(compareNodeMetadata(old.firstChild, next.firstChild)).toEqual(changes)
    changes[0].before.data.items.push('snapshot')
    changes[1].after[0].attrs.data.tags[0] = 'snapshot'
    expect([old.toJSON(), next.toJSON()]).toEqual(original)
    expect(old.firstChild.attrs.data.items).toEqual(['old'])
    expect(next.firstChild.firstChild.marks[0].attrs.data.tags).toEqual(['new'])
    expect(Object.isFrozen(old.firstChild.content.content)).toBe(true)
    expect(Object.isFrozen(next.firstChild.firstChild.marks[0].attrs.data.tags)).toBe(true)
  })

  it('agrees across document and selected-node APIs with Unicode splits and translated offsets', () => {
    const old = paragraph(schema.text('A\u{1f600}B'), {level: 1})
    const next = paragraph([schema.text('A'), schema.text('\u{1f600}', [schema.mark('strong')]), schema.text('B')], {level: 2})
    const prefix = paragraph(schema.text('prefix')) // nodeSize 8
    const whole = compareDocumentMetadata(document([prefix, old]), document([prefix, next]))
    expect(whole.map(c => [c.kind, c.oldFrom, c.oldTo, c.newFrom, c.newTo])).toEqual([
      ['attrs', 8, 14, 8, 14], ['marks', 10, 12, 10, 12]
    ])
    expect(compareNodeMetadata(old, next, {oldFrom: 8, newFrom: 8})).toEqual(whole)
    const shifted = compareNodeMetadata(old, next, {oldFrom: 8, newFrom: 20})
    expect(shifted.map(c => [c.oldFrom, c.oldTo, c.newFrom, c.newTo])).toEqual([
      [8, 14, 20, 26], [10, 12, 22, 24]
    ])
    expect(shifted.map(({kind, before, after}) => ({kind, before, after})))
      .toEqual(whole.map(({kind, before, after}) => ({kind, before, after})))
  })
})
