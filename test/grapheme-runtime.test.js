import {expect, it, vi} from 'vitest'

it('initializes without Intl.Segmenter and preserves graphemes through word fallback', async () => {
  const originalIntl = globalThis.Intl
  const originalDescriptor = Object.getOwnPropertyDescriptor(originalIntl, 'Segmenter')
  // Copy descriptors rather than spread: Intl APIs are generally non-enumerable.
  // Do not mutate the real Intl object or rely on a module imported before setup.
  const withoutSegmenter = Object.create(Object.getPrototypeOf(originalIntl), Object.getOwnPropertyDescriptors(originalIntl))
  Reflect.deleteProperty(withoutSegmenter, 'Segmenter')
  vi.resetModules()
  vi.stubGlobal('Intl', withoutSegmenter)
  try {
    expect('Segmenter' in globalThis.Intl).toBe(false)
    expect(Intl.NumberFormat).toBe(originalIntl.NumberFormat)
    expect(Intl.DateTimeFormat).toBe(originalIntl.DateTimeFormat)
    const {diffGraphemes, diffWordsWithDetail, tokenizeText} = await import('../src/diff.js')
    expect('Segmenter' in globalThis.Intl).toBe(false)

    // Default tokenization (no explicit null segmenter) observes the cold-import
    // fallback. Exact expected offsets are independent of the segmentation API.
    expect(tokenizeText('ab中 e\u0301🙂')).toEqual([
      {text: 'ab中', start: 0, end: 3},
      {text: ' ', start: 3, end: 4},
      {text: 'e\u0301', start: 4, end: 6},
      {text: '🙂', start: 6, end: 8}
    ])
    const before = 'x👩‍💻e\u0301z', after = 'x👨‍💻e\u0300z'
    const expected = [
      {type: 0, text: 'x', level: 'grapheme'},
      {type: -1, text: '👩‍💻e\u0301', level: 'grapheme'},
      {type: 1, text: '👨‍💻e\u0300', level: 'grapheme'},
      {type: 0, text: 'z', level: 'grapheme'}
    ]
    expect(diffGraphemes(before, after)).toEqual(expected)

    const wordBefore = 'Hello 👩‍💻 e\u0301!', wordAfter = 'Hello 👨‍💻 e\u0300!'
    const wordSegments = diffWordsWithDetail(wordBefore, wordAfter)
    expect(wordSegments.filter(s => s.type !== 1).map(s => s.text).join('')).toBe(wordBefore)
    expect(wordSegments.filter(s => s.type !== -1).map(s => s.text).join('')).toBe(wordAfter)
    expect(wordSegments.filter(s => s.type === -1).map(s => s.text)).toEqual(['👩‍💻', 'e\u0301'])
    expect(wordSegments.filter(s => s.type === 1).map(s => s.text)).toEqual(['👨‍💻', 'e\u0300'])
  } finally {
    vi.unstubAllGlobals()
    // A later import must not reuse wordSegmenter initialized under this stub.
    vi.resetModules()
  }
  expect(globalThis.Intl).toBe(originalIntl)
  expect(Object.getOwnPropertyDescriptor(Intl, 'Segmenter')).toEqual(originalDescriptor)
})
