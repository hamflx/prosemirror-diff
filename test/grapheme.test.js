import {describe, expect, it, vi} from 'vitest'
import {Schema} from 'prosemirror-model'
import {splitGraphemes} from 'unicode-segmenter/grapheme'
import {diffGraphemes, diffEditor, patchTextNodes, DiffType} from '../src/index.js'

const assertDiff = (oldText, newText, segments) => {
  for (const [source, excluded] of [[oldText, DiffType.Inserted], [newText, DiffType.Deleted]]) {
    const parts = segments.filter(s => s.type !== excluded)
    expect(parts.map(s => s.text).join('')).toBe(source)
    const boundaries = new Set([0])
    let offset = 0
    for (const grapheme of splitGraphemes(source)) {
      offset += grapheme.length
      boundaries.add(offset)
    }
    offset = 0
    for (const part of parts) {
      offset += part.text.length
      expect(boundaries.has(offset)).toBe(true)
    }
  }
  for (const segment of segments) {
    expect(segment.text.length).toBeGreaterThan(0)
    expect(segment.level).toBe('grapheme')
    expect([-1, 0, 1]).toContain(segment.type)
  }
}

describe('diffGraphemes', () => {
  it.each([
    ['😉', '😀'], ['e\u0301', 'e\u0300'], ['👍🏻', '👍🏿'],
    ['👩🏽‍💻', '👨🏽‍💻'], ['🇺🇸', '🇨🇦'], ['क्ष', 'त्र']
  ])('replaces complete graphemes: %s → %s', (oldText, newText) => {
    const segments = diffGraphemes(oldText, newText)
    assertDiff(oldText, newText, segments)
    expect(segments).toEqual([
      {type: DiffType.Deleted, text: oldText, level: 'grapheme'},
      {type: DiffType.Inserted, text: newText, level: 'grapheme'}
    ])
  })

  it.each([['', ''], ['', '👩‍💻'], ['👩‍💻', ''], ['same', 'same'],
    ['a\r\nb', 'a\nb'], ['é', 'e\u0301'], ['\ud800a', '\ud801b'],
    ['你好世界', '你好新世界'], ['JSON5', 'JSON6']])('reconstructs exact inputs %j → %j', (a, b) => {
    assertDiff(a, b, diffGraphemes(a, b))
  })

  it('keeps fine detail without promoting inserted letters to word changes', () => {
    expect(diffGraphemes('cat', 'cart')).toEqual([
      {type: 0, text: 'ca', level: 'grapheme'},
      {type: 1, text: 'r', level: 'grapheme'},
      {type: 0, text: 't', level: 'grapheme'}
    ])
  })

  it('falls back at grapheme boundaries after the edit budget is exceeded', () => {
    const a = 'start ' + '👩‍💻'.repeat(1001) + ' end'
    const b = 'start ' + '🇨🇦'.repeat(1001) + ' end'
    const segments = diffGraphemes(a, b)
    assertDiff(a, b, segments)
    expect(segments.map(s => s.text)).toEqual(['start ', '👩‍💻'.repeat(1001), '🇨🇦'.repeat(1001), ' end'])
  })

  it('uses a safe fallback when the shared deadline has elapsed', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(1001)
    try {
      const segments = diffGraphemes('x👩‍💻z', 'x🇨🇦z')
      assertDiff('x👩‍💻z', 'x🇨🇦z', segments)
      expect(segments.map(s => s.text)).toEqual(['x', '👩‍💻', '🇨🇦', 'z'])
    } finally { clock.mockRestore() }
  })

  it('does not depend on Intl.Segmenter', () => {
    const segmenter = vi.spyOn(Intl, 'Segmenter').mockImplementation(() => { throw Error('unavailable') })
    try { assertDiff('👩‍💻é', '👨‍💻è', diffGraphemes('👩‍💻é', '👨‍💻è')) }
    finally { segmenter.mockRestore() }
  })

  it('rejects non-string inputs', () => {
    expect(() => diffGraphemes(null, '')).toThrow(TypeError)
    expect(() => diffGraphemes('', 1)).toThrow(TypeError)
  })

  it('preserves reconstruction and boundaries for deterministic mixed-script mutations', () => {
    const atoms = ['a', ' ', '中', 'é', '👩🏽‍💻', '🇨🇦', '\r\n', 'क्ष', '\ud800']
    let state = 42
    const next = () => (state = (state * 1664525 + 1013904223) >>> 0)
    const make = () => Array.from({length: next() % 20}, () => atoms[next() % atoms.length]).join('')
    for (let i = 0; i < 200; i++) {
      const a = make(), b = make()
      assertDiff(a, b, diffGraphemes(a, b))
    }
  })
})

const schemaFor = level => new Schema({
  nodes: {doc: {content: 'paragraph+'}, paragraph: {content: 'text*'}, text: {}},
  marks: {strong: {}, em: {}, diffMark: {attrs: level
    ? {type: {default: 0}, level: {default: 'char'}} : {type: {default: 0}}}}
})
const doc = (text, mark) => ({type: 'doc', content: [{type: 'paragraph',
  content: text ? [{type: 'text', text, marks: mark ? [{type: mark}] : []}] : []}]})

describe('grapheme mode integration', () => {
  it('keeps changed emoji intact and restores source marks using UTF-16 offsets', () => {
    const schema = schemaFor(true)
    const result = diffEditor(schema, doc('x👩🏽‍💻z', 'strong'), doc('x👨🏽‍💻z', 'em'), {level: 'grapheme'})
    result.check()
    const changed = result.firstChild.content.content.filter(n => n.marks.some(m => m.type.name === 'diffMark'))
    expect(changed.map(n => n.text)).toEqual(['👩🏽‍💻', '👨🏽‍💻'])
    expect(changed.map(n => n.marks.map(m => m.type.name))).toEqual([['strong', 'diffMark'], ['em', 'diffMark']])
    expect(changed.map(n => n.marks.find(m => m.type.name === 'diffMark').attrs)).toEqual([
      {type: -1, level: 'grapheme'}, {type: 1, level: 'grapheme'}
    ])
  })

  it.each([['', '👍🏿', 1], ['👍🏿', '', -1]])('propagates the level for whole-text changes', (a, b, type) => {
    const result = diffEditor(schemaFor(true), doc(a), doc(b), {level: 'grapheme'})
    expect(result.firstChild.firstChild.marks[0].attrs).toEqual({type, level: 'grapheme'})
  })

  it('supports direct text-node calls and legacy schemas without level', () => {
    const schema = schemaFor(false)
    const result = patchTextNodes(schema, [schema.text('😉')], [schema.text('😀')], {level: 'grapheme'})
    expect(result.map(n => n.text)).toEqual(['😉', '😀'])
    expect(result.map(n => Object.keys(n.marks[0].attrs))).toEqual([['type'], ['type']])
  })

  it('propagates the level through whole-block insertion and deletion', () => {
    const schema = schemaFor(true)
    const one = doc('first')
    const two = {type: 'doc', content: [...one.content, ...doc('👩‍💻').content]}
    for (const [a, b, type] of [[one, two, 1], [two, one, -1]]) {
      const result = diffEditor(schema, a, b, {level: 'grapheme'})
      result.check()
      expect(result.child(1).firstChild.marks[0].attrs).toEqual({type, level: 'grapheme'})
    }
  })

  it('retains existing mark boundaries inside a complete changed grapheme', () => {
    const schema = schemaFor(true)
    const old = [schema.text('e', [schema.mark('strong')]), schema.text('\u0301', [schema.mark('em')])]
    const result = patchTextNodes(schema, old, [schema.text('e\u0300')], {level: 'grapheme'})
    expect(result.map(n => n.text)).toEqual(['e', '\u0301', 'e\u0300'])
    expect(result[0].marks.some(m => m.type.name === 'strong')).toBe(true)
    expect(result[1].marks.some(m => m.type.name === 'em')).toBe(true)
    expect(result.map(n => n.marks.find(m => m.type.name === 'diffMark').attrs.type)).toEqual([-1, -1, 1])
  })

  it('leaves the default legacy mode unchanged', () => {
    const schema = schemaFor(true)
    expect(diffEditor(schema, doc('😉'), doc('😀')).toJSON()).toEqual(
      diffEditor(schema, doc('😉'), doc('😀'), {level: 'char'}).toJSON())
  })
})
