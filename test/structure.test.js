import {describe, expect, it} from 'vitest'
import {Schema} from 'prosemirror-model'
import {diffEditor, DiffType} from '../src/index.js'

const schema = new Schema({
  nodes: {
    doc: {content: 'block+'},
    paragraph: {group: 'block', content: 'inline*'},
    blockquote: {group: 'block', content: 'block+'},
    text: {group: 'inline'},
    hard_break: {group: 'inline', inline: true}
  },
  marks: {
    strong: {},
    em: {},
    diffMark: {attrs: {type: {default: 0}, level: {default: 'char'}}}
  }
})
const text = (value, mark) => ({type: 'text', text: value, ...(mark ? {marks: [{type: mark}]} : {})})
const br = {type: 'hard_break'}
const doc = content => ({type: 'doc', content: [{type: 'paragraph', content}]})

describe('text groups next to inline leaf nodes', () => {
  for (const level of ['char', 'word']) {
    for (const reverse of [false, true]) {
      it(`${level}: replaces ${reverse ? 'a leaf with marked text' : 'marked text with a leaf'}`, () => {
        const texts = [text('👩🏽‍💻', 'strong'), text('e\u0301', 'em')]
        const oldContent = reverse ? [br] : texts
        const newContent = reverse ? texts : [br]
        const oldDoc = doc(oldContent)
        const newDoc = doc(newContent)
        const before = JSON.stringify([oldDoc, newDoc])
        const result = diffEditor(schema, oldDoc, newDoc, {level})
        result.check()
        const children = result.firstChild.content.content
        expect(children.map(n => n.type.name)).toEqual(reverse
          ? ['hard_break', 'text', 'text'] : ['text', 'text', 'hard_break'])
        const changed = children.filter(n => n.isText)
        expect(changed.map(n => n.text)).toEqual(texts.map(n => n.text))
        expect(changed.map(n => n.marks.map(m => m.type.name))).toEqual([
          ['strong', 'diffMark'], ['em', 'diffMark']
        ])
        for (const node of changed) {
          expect(node.marks.find(m => m.type.name === 'diffMark').attrs).toEqual({
            type: reverse ? DiffType.Inserted : DiffType.Deleted, level
          })
        }
        expect(JSON.stringify([oldDoc, newDoc])).toBe(before)
      })
    }
    it(`${level}: handles replacement inside nested blocks with unchanged siblings`, () => {
      const nested = content => ({type: 'doc', content: [{type: 'blockquote', content: [
        ...doc([text('before')]).content, ...doc(content).content, ...doc([text('after')]).content
      ]}]})
      const result = diffEditor(schema, nested([text('removed')]), nested([br]), {level})
      result.check()
      expect(result.firstChild.child(0).textContent).toBe('before')
      expect(result.firstChild.child(2).textContent).toBe('after')
      expect(result.firstChild.child(1).childCount).toBe(2)
    })
  }
})
