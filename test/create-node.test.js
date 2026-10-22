import {describe, expect, it} from 'vitest'
import {Schema} from 'prosemirror-model'
import {createNewNode} from '../src/index.js'

const schema = new Schema({
  nodes: {
    doc: {content: 'block+'},
    paragraph: {group: 'block', content: 'inline*', attrs: {id: {default: null}}},
    text: {group: 'inline'},
    image: {group: 'inline', inline: true, attrs: {src: {}}}
  },
  marks: {strong: {}, link: {attrs: {href: {}}}}
})

describe('createNewNode', () => {
  it('replaces children while retaining parent markup and leaving inputs unchanged', () => {
    const mark = schema.mark('link', {href: '/target'})
    const old = schema.node('paragraph', {id: 'p1'}, [schema.text('old')], [mark])
    const before = old.toJSON()
    const children = [schema.text('new', [schema.mark('strong')]), schema.node('image', {src: '/image'})]
    const result = createNewNode(old, children)
    result.check()
    expect(result.type).toBe(old.type)
    expect(result.attrs).toEqual({id: 'p1'})
    expect(result.marks).toEqual([mark])
    expect(result.content.content).toEqual(children)
    expect(old.toJSON()).toEqual(before)
    expect(children).toHaveLength(2)
  })

  it('clears content without dropping attributes or marks', () => {
    const old = schema.node('paragraph', {id: 'clear'}, schema.text('remove'), [schema.mark('strong')])
    const result = createNewNode(old, [])
    result.check()
    expect(result.childCount).toBe(0)
    expect(result.sameMarkup(old)).toBe(true)
    expect(old.textContent).toBe('remove')
  })

  it('preserves empty container and leaf values', () => {
    for (const old of [schema.node('paragraph', {id: 'empty'}), schema.node('image', {src: '/image'})]) {
      const result = createNewNode(old, [])
      result.check()
      expect(result.toJSON()).toEqual(old.toJSON())
    }
  })

  it('retains the missing-type error', () => {
    expect(() => createNewNode({}, [])).toThrow('oldNode.type is undefined')
  })
})
