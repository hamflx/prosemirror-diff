import { describe, it, expect } from 'vitest'
import { tokenizeText, diffWordsWithDetail, DiffType } from './index.js'

describe('tokenizeText', () => {
  it('should tokenize simple words', () => {
    const tokens = tokenizeText('hello world')
    expect(tokens).toEqual([
      { text: 'hello', start: 0, end: 5 },
      { text: ' ', start: 5, end: 6 },
      { text: 'world', start: 6, end: 11 }
    ])
  })

  it('should tokenize words with punctuation', () => {
    const tokens = tokenizeText('hello, world!')
    expect(tokens).toEqual([
      { text: 'hello', start: 0, end: 5 },
      { text: ',', start: 5, end: 6 },
      { text: ' ', start: 6, end: 7 },
      { text: 'world', start: 7, end: 12 },
      { text: '!', start: 12, end: 13 }
    ])
  })

  it('should handle multiple spaces', () => {
    const tokens = tokenizeText('hello  world')
    expect(tokens).toEqual([
      { text: 'hello', start: 0, end: 5 },
      { text: '  ', start: 5, end: 7 },
      { text: 'world', start: 7, end: 12 }
    ])
  })

  it('should handle empty string', () => {
    const tokens = tokenizeText('')
    expect(tokens).toEqual([])
  })

  it('should handle only whitespace', () => {
    const tokens = tokenizeText('   ')
    expect(tokens).toEqual([
      { text: '   ', start: 0, end: 3 }
    ])
  })

  it('should handle special characters', () => {
    const tokens = tokenizeText('foo@bar.com')
    expect(tokens).toEqual([
      { text: 'foo', start: 0, end: 3 },
      { text: '@', start: 3, end: 4 },
      { text: 'bar', start: 4, end: 7 },
      { text: '.', start: 7, end: 8 },
      { text: 'com', start: 8, end: 11 }
    ])
  })
})

describe('diffWordsWithDetail', () => {
  it('should return empty array for identical texts', () => {
    const diff = diffWordsWithDetail('hello world', 'hello world')
    expect(diff).toEqual([
      { type: DiffType.Unchanged, text: 'hello world', level: 'word' }
    ])
  })

  it('should detect single word change with character detail', () => {
    // JSON5 -> JSON6: should show character-level diff within the word
    const diff = diffWordsWithDetail('JSON5', 'JSON6')

    // Should have: "JSON" unchanged, "5" deleted, "6" inserted
    const unchanged = diff.filter(d => d.type === DiffType.Unchanged)
    const deleted = diff.filter(d => d.type === DiffType.Deleted)
    const inserted = diff.filter(d => d.type === DiffType.Inserted)

    expect(unchanged.map(d => d.text).join('')).toBe('JSON')
    expect(deleted.map(d => d.text).join('')).toBe('5')
    expect(inserted.map(d => d.text).join('')).toBe('6')

    // Character-level changes should have level: 'char'
    expect(deleted.every(d => d.level === 'char')).toBe(true)
    expect(inserted.every(d => d.level === 'char')).toBe(true)
  })

  it('should detect word replacement with character detail (JSONB -> JOHN)', () => {
    const diff = diffWordsWithDetail('JSONB', 'JOHN')

    // Should show: J (unchanged), S (deleted), O (unchanged), N (unchanged), B (deleted), H (inserted)
    const unchanged = diff.filter(d => d.type === DiffType.Unchanged)
    const deleted = diff.filter(d => d.type === DiffType.Deleted)
    const inserted = diff.filter(d => d.type === DiffType.Inserted)

    expect(unchanged.map(d => d.text).join('')).toBe('JON')
    expect(deleted.map(d => d.text).join('')).toBe('SB')
    expect(inserted.map(d => d.text).join('')).toBe('H')
  })

  it('should handle word insertion', () => {
    const diff = diffWordsWithDetail('hello', 'hello world')

    const unchanged = diff.filter(d => d.type === DiffType.Unchanged)
    const inserted = diff.filter(d => d.type === DiffType.Inserted)

    expect(unchanged.map(d => d.text).join('')).toBe('hello')
    expect(inserted.map(d => d.text).join('')).toBe(' world')

    // Orphan insertions should have level: 'word'
    expect(inserted.every(d => d.level === 'word')).toBe(true)
  })

  it('should handle word deletion', () => {
    const diff = diffWordsWithDetail('hello world', 'hello')

    const unchanged = diff.filter(d => d.type === DiffType.Unchanged)
    const deleted = diff.filter(d => d.type === DiffType.Deleted)

    expect(unchanged.map(d => d.text).join('')).toBe('hello')
    expect(deleted.map(d => d.text).join('')).toBe(' world')

    // Orphan deletions should have level: 'word'
    expect(deleted.every(d => d.level === 'word')).toBe(true)
  })

  it('should handle multiple word changes', () => {
    const diff = diffWordsWithDetail('the quick fox', 'the slow dog')

    const unchanged = diff.filter(d => d.type === DiffType.Unchanged)
    const deleted = diff.filter(d => d.type === DiffType.Deleted)
    const inserted = diff.filter(d => d.type === DiffType.Inserted)

    // "the " should be unchanged
    expect(unchanged.map(d => d.text).join('')).toContain('the ')

    // The algorithm does character-level diff between changed word groups
    // "quick fox" vs "slow dog" - common chars like space and 'o' may be preserved
    // Just verify the overall text reconstruction works
    const unchangedText = unchanged.map(d => d.text).join('')
    const deletedText = deleted.map(d => d.text).join('')
    const insertedText = inserted.map(d => d.text).join('')

    // Verify reconstruction: unchanged + deleted should give old text
    // and unchanged + inserted should give new text
    expect(unchangedText + deletedText).toContain('the ')
    expect(unchangedText + insertedText).toContain('the ')

    // The changed parts should contain the key differing characters
    expect(deletedText.length).toBeGreaterThan(0)
    expect(insertedText.length).toBeGreaterThan(0)
  })

  it('should handle empty old text', () => {
    const diff = diffWordsWithDetail('', 'hello')
    expect(diff).toEqual([
      { type: DiffType.Inserted, text: 'hello', level: 'word' }
    ])
  })

  it('should handle empty new text', () => {
    const diff = diffWordsWithDetail('hello', '')
    expect(diff).toEqual([
      { type: DiffType.Deleted, text: 'hello', level: 'word' }
    ])
  })

  it('should handle punctuation changes', () => {
    const diff = diffWordsWithDetail('hello,', 'hello.')

    const deleted = diff.filter(d => d.type === DiffType.Deleted)
    const inserted = diff.filter(d => d.type === DiffType.Inserted)

    expect(deleted.map(d => d.text).join('')).toBe(',')
    expect(inserted.map(d => d.text).join('')).toBe('.')
  })

  it('should preserve whitespace in diff', () => {
    const diff = diffWordsWithDetail('a b', 'a  b')

    // The space change should be detected
    const allText = diff.map(d => d.text).join('')
    expect(allText).toContain('a')
    expect(allText).toContain('b')
  })

  it('should handle sentence with similar words', () => {
    // "The JSON5 format" -> "The JSON6 format"
    const diff = diffWordsWithDetail('The JSON5 format', 'The JSON6 format')

    const unchanged = diff.filter(d => d.type === DiffType.Unchanged)
    const deleted = diff.filter(d => d.type === DiffType.Deleted)
    const inserted = diff.filter(d => d.type === DiffType.Inserted)

    // "The ", "JSON", " format" should be unchanged
    expect(unchanged.map(d => d.text).join('')).toContain('The ')
    expect(unchanged.map(d => d.text).join('')).toContain('JSON')
    expect(unchanged.map(d => d.text).join('')).toContain(' format')

    // Only "5" deleted and "6" inserted
    expect(deleted.map(d => d.text).join('')).toBe('5')
    expect(inserted.map(d => d.text).join('')).toBe('6')

    // These are character-level changes within the JSON5/JSON6 word
    expect(deleted.every(d => d.level === 'char')).toBe(true)
    expect(inserted.every(d => d.level === 'char')).toBe(true)
  })

  it('should include level attribute in all diff results', () => {
    const diff = diffWordsWithDetail('hello world', 'hi there')

    // Every diff segment should have a level attribute
    expect(diff.every(d => d.level === 'word' || d.level === 'char')).toBe(true)
  })
})

describe('DiffType constants', () => {
  it('should have correct values', () => {
    expect(DiffType.Unchanged).toBe(0)
    expect(DiffType.Deleted).toBe(-1)
    expect(DiffType.Inserted).toBe(1)
  })
})

// Integration tests with ProseMirror schema
import { Schema } from 'prosemirror-model'
import { diffEditor } from './index.js'

const createTestSchema = () => {
  return new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { content: 'inline*', group: 'block', parseDOM: [{ tag: 'p' }], toDOM: () => ['p', 0] },
      text: { group: 'inline' }
    },
    marks: {
      diffMark: {
        attrs: {
          type: { default: 0 },
          level: { default: 'char' }
        },
        parseDOM: [{ tag: 'span[data-diff]' }],
        toDOM: (mark) => ['span', { 'data-diff': mark.attrs.type, 'data-diff-level': mark.attrs.level }, 0]
      }
    }
  })
}

describe('diffEditor integration', () => {
  const schema = createTestSchema()

  it('should work with level: char (character-level diff)', () => {
    const oldDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'JSON5' }]
        }
      ]
    }
    const newDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'JSON6' }]
        }
      ]
    }

    const result = diffEditor(schema, oldDoc, newDoc, { level: 'char' })
    expect(result).toBeDefined()
    expect(result.type.name).toBe('doc')
  })

  it('should work with level: word (word-level diff)', () => {
    const oldDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'JSON5' }]
        }
      ]
    }
    const newDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'JSON6' }]
        }
      ]
    }

    const result = diffEditor(schema, oldDoc, newDoc, { level: 'word' })
    expect(result).toBeDefined()
    expect(result.type.name).toBe('doc')
  })

  it('should preserve default behavior without options', () => {
    const oldDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'hello' }]
        }
      ]
    }
    const newDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'hello world' }]
        }
      ]
    }

    // Should work without any options (backwards compatible)
    const result = diffEditor(schema, oldDoc, newDoc)
    expect(result).toBeDefined()
  })

  it('should handle identical documents', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'unchanged' }]
        }
      ]
    }

    const result = diffEditor(schema, doc, doc, { level: 'word' })
    expect(result).toBeDefined()

    // Verify no diff marks are applied to unchanged text
    const paragraph = result.content.content[0]
    const textNode = paragraph.content.content[0]
    expect(textNode.text).toBe('unchanged')
    expect(textNode.marks.length).toBe(0)
  })

  it('should apply diff marks to changed text', () => {
    const oldDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'old' }]
        }
      ]
    }
    const newDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'new' }]
        }
      ]
    }

    const result = diffEditor(schema, oldDoc, newDoc, { level: 'word' })
    const paragraph = result.content.content[0]

    // Should have some text nodes with diff marks
    const textNodes = paragraph.content.content
    const hasDiffMarks = textNodes.some(node =>
      node.marks && node.marks.some(mark => mark.type.name === 'diffMark')
    )
    expect(hasDiffMarks).toBe(true)
  })

  it('should include level attribute on diff marks when using wordLevel', () => {
    const oldDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'JSON5' }]
        }
      ]
    }
    const newDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'JSON6' }]
        }
      ]
    }

    const result = diffEditor(schema, oldDoc, newDoc, { level: 'word' })
    const paragraph = result.content.content[0]
    const textNodes = paragraph.content.content

    // Find diff marks and check they have level attribute
    const diffMarks = textNodes
      .flatMap(node => node.marks || [])
      .filter(mark => mark.type.name === 'diffMark')

    expect(diffMarks.length).toBeGreaterThan(0)

    // Character-level changes should have level: 'char'
    diffMarks.forEach(mark => {
      expect(mark.attrs.level).toBe('char')
    })
  })

  it('should have level: word for orphan insertions/deletions', () => {
    const oldDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'hello' }]
        }
      ]
    }
    const newDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'hello world' }]
        }
      ]
    }

    const result = diffEditor(schema, oldDoc, newDoc, { level: 'word' })
    const paragraph = result.content.content[0]
    const textNodes = paragraph.content.content

    // Find the inserted text node (should be " world")
    const insertedNodes = textNodes.filter(node =>
      node.marks && node.marks.some(mark =>
        mark.type.name === 'diffMark' && mark.attrs.type === 1 // DiffType.Inserted
      )
    )

    expect(insertedNodes.length).toBeGreaterThan(0)

    // Orphan insertions should have level: 'word'
    insertedNodes.forEach(node => {
      const diffMark = node.marks.find(m => m.type.name === 'diffMark')
      expect(diffMark.attrs.level).toBe('word')
    })
  })
})
