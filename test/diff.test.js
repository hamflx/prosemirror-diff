import {describe, expect, it} from 'vitest'
import {Schema} from 'prosemirror-model'
import {
  DiffType,
  diffEditor,
  diffWordsWithDetail,
  tokenizeText
} from '../src/index.js'

const reconstructDiff = segments => ({
  oldText: segments
    .filter(({type}) => type !== DiffType.Inserted)
    .map(({text}) => text)
    .join(''),
  newText: segments
    .filter(({type}) => type !== DiffType.Deleted)
    .map(({text}) => text)
    .join('')
})

const expectValidDiff = (oldText, newText, segments) => {
  expect(reconstructDiff(segments)).toEqual({oldText, newText})
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]
    expect([DiffType.Unchanged, DiffType.Deleted, DiffType.Inserted]).toContain(segment.type)
    expect(['char', 'word']).toContain(segment.level)
    expect(segment.text.length).toBeGreaterThan(0)
    if (index > 0) {
      const previous = segments[index - 1]
      expect(previous.type === segment.type && previous.level === segment.level).toBe(false)
    }
  }
}

const expectTokenCoverage = text => {
  const tokens = tokenizeText(text)
  expect(tokens.map(({text: tokenText}) => tokenText).join('')).toBe(text)
  let offset = 0
  for (const token of tokens) {
    expect(token.start).toBe(offset)
    expect(token.end).toBe(token.start + token.text.length)
    expect(text.slice(token.start, token.end)).toBe(token.text)
    offset = token.end
  }
  expect(offset).toBe(text.length)
  return tokens
}

const createSchema = ({includeLevel = true} = {}) => new Schema({
  nodes: {
    doc: {content: 'block+'},
    paragraph: {content: 'inline*', group: 'block'},
    text: {group: 'inline'}
  },
  marks: {
    strong: {},
    em: {},
    diffMark: {
      attrs: includeLevel
        ? {type: {default: 0}, level: {default: 'char'}}
        : {type: {default: 0}}
    }
  }
})

const textDoc = (text, marks = []) => ({
  type: 'doc',
  content: [{
    type: 'paragraph',
    content: text ? [{type: 'text', text, marks}] : undefined
  }]
})

const paragraphTextNodes = node => node.content.content[0].content.content

const findDiffMark = node => node.marks.find(mark => mark.type.name === 'diffMark')

const reconstructTextNodes = nodes => ({
  oldText: nodes
    .filter(node => findDiffMark(node)?.attrs.type !== DiffType.Inserted)
    .map(node => node.text)
    .join(''),
  newText: nodes
    .filter(node => findDiffMark(node)?.attrs.type !== DiffType.Deleted)
    .map(node => node.text)
    .join('')
})

describe('tokenizeText', () => {
  it('preserves exact offsets for words, whitespace, and punctuation', () => {
    expect(tokenizeText('hello,  world!')).toEqual([
      {text: 'hello', start: 0, end: 5},
      {text: ',', start: 5, end: 6},
      {text: '  ', start: 6, end: 8},
      {text: 'world', start: 8, end: 13},
      {text: '!', start: 13, end: 14}
    ])
  })

  it('keeps punctuation separate inside word-like Intl segments', () => {
    expect(tokenizeText('foo@bar.com')).toEqual([
      {text: 'foo', start: 0, end: 3},
      {text: '@', start: 3, end: 4},
      {text: 'bar', start: 4, end: 7},
      {text: '.', start: 7, end: 8},
      {text: 'com', start: 8, end: 11}
    ])
  })

  it('never splits an emoji grapheme while refining Intl segments', () => {
    expect(tokenizeText('\ud83c\udff3\ufe0f\u200d\ud83c\udf08')).toEqual([
      {text: '\ud83c\udff3\ufe0f\u200d\ud83c\udf08', start: 0, end: 6}
    ])
  })

  it.each([
    '',
    'line one\r\nline two\t',
    'caf\u00e9 d\u00e9j\u00e0',
    '\u4f60\u597d\uff0c\u4e16\u754c',
    '\u0645\u0631\u062d\u0628\u0627 \u0628\u0627\u0644\u0639\u0627\u0644\u0645',
    '\u05e9\u05dc\u05d5\u05dd \u05e2\u05d5\u05dc\u05dd',
    'e\u0301 and \u00e9',
    '\ud83d\udc69\u200d\ud83d\udcbb \ud83c\udff3\ufe0f\u200d\ud83c\udf08',
    '\u0000null',
    '\ud800isolated'
  ])('covers every UTF-16 code unit in %j', text => {
    expectTokenCoverage(text)
  })

  it('recognizes non-ASCII prose as multiple boundaries', () => {
    const accented = expectTokenCoverage('caf\u00e9 d\u00e9j\u00e0')
    expect(accented.map(({text}) => text)).toContain('caf\u00e9')

    const chinese = expectTokenCoverage('\u4f60\u597d\uff0c\u4e16\u754c')
    expect(chinese.map(({text}) => text)).toContain('\uff0c')
    expect(chinese.length).toBeGreaterThanOrEqual(3)
  })

  it('preserves Unicode text with the non-Intl fallback', () => {
    for (const text of ['caf\u00e9', '\u4f60\u597d\uff0c\u4e16\u754c', 'e\u0301']) {
      const tokens = tokenizeText(text, null)
      expect(tokens.map(token => token.text).join('')).toBe(text)
      expect(tokens.every(token => text.slice(token.start, token.end) === token.text)).toBe(true)
    }
  })

  it('rejects non-string input', () => {
    expect(() => tokenizeText(null)).toThrow(TypeError)
  })
})

describe('diffWordsWithDetail', () => {
  it('returns no segments for two empty strings', () => {
    expect(diffWordsWithDetail('', '')).toEqual([])
  })

  it('keeps identical text unchanged at word level', () => {
    const diff = diffWordsWithDetail('hello world', 'hello world')
    expect(diff).toEqual([{type: DiffType.Unchanged, text: 'hello world', level: 'word'}])
    expectValidDiff('hello world', 'hello world', diff)
  })

  it('refines a paired word replacement by grapheme', () => {
    const diff = diffWordsWithDetail('JSON5', 'JSON6')
    expectValidDiff('JSON5', 'JSON6', diff)
    expect(diff.filter(({type}) => type === DiffType.Unchanged).map(({text}) => text).join('')).toBe('JSON')
    expect(diff.filter(({type}) => type === DiffType.Deleted)).toEqual([
      {type: DiffType.Deleted, text: '5', level: 'char'}
    ])
    expect(diff.filter(({type}) => type === DiffType.Inserted)).toEqual([
      {type: DiffType.Inserted, text: '6', level: 'char'}
    ])
  })

  it('implements the prose replacement use case from the proposed PR', () => {
    const diff = diffWordsWithDetail('emergiu', 'surgiu')
    expectValidDiff('emergiu', 'surgiu', diff)
    expect(diff).toEqual([
      {type: DiffType.Deleted, text: 'eme', level: 'char'},
      {type: DiffType.Inserted, text: 'su', level: 'char'},
      {type: DiffType.Unchanged, text: 'rgiu', level: 'char'}
    ])
  })

  it('does not create diff boundaries inside emoji graphemes', () => {
    const oldText = '\ud83c\udff3\ufe0f\u200d\ud83c\udf08'
    const newText = '\ud83c\udff4\u200d\u2620\ufe0f'
    const diff = diffWordsWithDetail(oldText, newText)
    expectValidDiff(oldText, newText, diff)
    expect(diff).toEqual([
      {type: DiffType.Deleted, text: oldText, level: 'char'},
      {type: DiffType.Inserted, text: newText, level: 'char'}
    ])
  })

  it('keeps standalone word insertion and deletion at word level', () => {
    const insertion = diffWordsWithDetail('hello', 'hello world')
    expectValidDiff('hello', 'hello world', insertion)
    expect(insertion.find(({type}) => type === DiffType.Inserted)).toEqual({
      type: DiffType.Inserted,
      text: ' world',
      level: 'word'
    })

    const deletion = diffWordsWithDetail('hello world', 'hello')
    expectValidDiff('hello world', 'hello', deletion)
    expect(deletion.find(({type}) => type === DiffType.Deleted)).toEqual({
      type: DiffType.Deleted,
      text: ' world',
      level: 'word'
    })
  })

  it.each([
    ['', 'hello'],
    ['hello', ''],
    ['hello, world', 'hello. world'],
    ['caf\u00e9', 'cafeteria'],
    ['\u4f60\u597d\u4e16\u754c', '\u4f60\u597d\u4e2d\u56fd'],
    ['e\u0301', '\u00e9'],
    ['\ud83d\udc69\u200d\ud83d\udcbb', '\ud83d\udc68\u200d\ud83d\udcbb'],
    ['a b a b', 'a c a d'],
    ['one\r\ntwo', 'one\ntwo']
  ])('reconstructs %j -> %j', (oldText, newText) => {
    const diff = diffWordsWithDetail(oldText, newText)
    expectValidDiff(oldText, newText, diff)
    for (const {text} of diff) {
      expect(() => encodeURIComponent(text)).not.toThrow()
    }
  })

  it('does not collide after 65,536 unique words', {timeout: 15000}, () => {
    const oldWords = Array.from({length: 70000}, (_, index) => `word${index}`)
    const newWords = [...oldWords]
    newWords[65536] = 'changed'
    const oldText = oldWords.join(' ')
    const newText = newWords.join(' ')
    const diff = diffWordsWithDetail(oldText, newText)
    expectValidDiff(oldText, newText, diff)
    expect(diff.length).toBeLessThan(10)
    expect(diff.map(({text}) => text).join('')).toContain('65536')
    expect(reconstructDiff(diff).newText).toContain('changed')
  })

  it('safely degrades when the edit-distance budget is exceeded', {timeout: 10000}, () => {
    const oldText = Array.from({length: 1100}, (_, index) => `old${index}`).join(' ')
    const newText = Array.from({length: 1100}, (_, index) => `new${index}`).join(' ')
    const diff = diffWordsWithDetail(oldText, newText)
    expectValidDiff(oldText, newText, diff)
    expect(diff.every(({level}) => level === 'word')).toBe(true)
  })

  it('satisfies reconstruction invariants for seeded Unicode mutations', () => {
    const atoms = [
      'a', 'B', '7', ' ', '  ', '\n', ',', '.', '-',
      '\u00e9', 'e\u0301', '\u4f60', '\u597d', '\ud83d\udc69\u200d\ud83d\udcbb'
    ]
    let state = 0x5eed1234
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0
      return state / 0x100000000
    }
    const makeText = () => Array.from(
      {length: Math.floor(random() * 35)},
      () => atoms[Math.floor(random() * atoms.length)]
    ).join('')

    for (let iteration = 0; iteration < 750; iteration++) {
      const oldText = makeText()
      const newText = makeText()
      expectValidDiff(oldText, newText, diffWordsWithDetail(oldText, newText))
    }
  })

  it('rejects non-string input', () => {
    expect(() => diffWordsWithDetail('text', null)).toThrow(TypeError)
  })

  it('reconstructs changes containing isolated surrogates', () => {
    const oldText = '\ud800a'
    const newText = '\ud801b'
    expectValidDiff(oldText, newText, diffWordsWithDetail(oldText, newText))
  })
})

describe('diffEditor integration', () => {
  it('preserves default character behavior', () => {
    const schema = createSchema()
    const oldDoc = textDoc('hello')
    const newDoc = textDoc('hallo')
    expect(diffEditor(schema, oldDoc, newDoc).toJSON()).toEqual(
      diffEditor(schema, oldDoc, newDoc, {level: 'char'}).toJSON()
    )
  })

  it('records character detail inside a word replacement', () => {
    const schema = createSchema()
    const result = diffEditor(schema, textDoc('JSON5'), textDoc('JSON6'), {level: 'word'})
    const nodes = paragraphTextNodes(result)
    expect(reconstructTextNodes(nodes)).toEqual({oldText: 'JSON5', newText: 'JSON6'})
    const changed = nodes.filter(findDiffMark)
    expect(changed.map(node => node.text)).toEqual(['5', '6'])
    expect(changed.every(node => findDiffMark(node).attrs.level === 'char')).toBe(true)
  })

  it('propagates word level to a whole text or block insertion', () => {
    const schema = createSchema()
    const textResult = diffEditor(schema, textDoc(''), textDoc('hello'), {level: 'word'})
    expect(findDiffMark(paragraphTextNodes(textResult)[0]).attrs).toEqual({
      type: DiffType.Inserted,
      level: 'word'
    })

    const oldDoc = textDoc('first')
    const newDoc = {
      type: 'doc',
      content: [
        {type: 'paragraph', content: [{type: 'text', text: 'first'}]},
        {type: 'paragraph', content: [{type: 'text', text: 'second'}]}
      ]
    }
    const blockResult = diffEditor(schema, oldDoc, newDoc, {level: 'word'})
    const insertedNode = blockResult.content.content[1].content.content[0]
    expect(findDiffMark(insertedNode).attrs.level).toBe('word')
  })

  it('propagates word level to a whole text deletion', () => {
    const schema = createSchema()
    const result = diffEditor(schema, textDoc('hello'), textDoc(''), {level: 'word'})
    const mark = findDiffMark(paragraphTextNodes(result)[0])
    expect(mark.attrs).toEqual({type: DiffType.Deleted, level: 'word'})
  })

  it('preserves source marks across diff boundaries', () => {
    const schema = createSchema()
    const oldDoc = textDoc('JSON5', [{type: 'strong'}])
    const newDoc = textDoc('JSON6', [{type: 'em'}])
    const result = diffEditor(schema, oldDoc, newDoc, {level: 'word'})
    const nodes = paragraphTextNodes(result)
    expect(reconstructTextNodes(nodes)).toEqual({oldText: 'JSON5', newText: 'JSON6'})
    const deleted = nodes.find(node => findDiffMark(node)?.attrs.type === DiffType.Deleted)
    const inserted = nodes.find(node => findDiffMark(node)?.attrs.type === DiffType.Inserted)
    expect(deleted.marks.some(mark => mark.type.name === 'strong')).toBe(true)
    expect(inserted.marks.some(mark => mark.type.name === 'em')).toBe(true)
  })

  it('remains compatible with a diffMark schema that omits level', () => {
    const schema = createSchema({includeLevel: false})
    const result = diffEditor(schema, textDoc('old'), textDoc('new'), {level: 'word'})
    const marks = paragraphTextNodes(result).flatMap(node => node.marks)
    expect(marks.filter(mark => mark.type.name === 'diffMark').every(mark => (
      Object.keys(mark.attrs).join(',') === 'type'
    ))).toBe(true)
  })

  it('rejects unsupported levels', () => {
    const schema = createSchema()
    expect(() => diffEditor(schema, textDoc('old'), textDoc('new'), {level: 'line'})).toThrow(RangeError)
  })
})
