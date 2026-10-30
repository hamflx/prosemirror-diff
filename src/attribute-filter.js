// Internal comparison projections. Original ProseMirror values are never edited.
export function ignoredAttributes(options) {
  const names = options.ignoreAttributes
  if (names === undefined) return new Set()
  if (!Array.isArray(names) || names.some(name => typeof name !== 'string')) {
    throw new TypeError('ignoreAttributes must be an array of attribute names')
  }
  // Array holes are not attribute names either.
  for (const name of names) if (typeof name !== 'string') {
    throw new TypeError('ignoreAttributes must be an array of attribute names')
  }
  return new Set(names)
}

export const filterAttrs = (attrs, ignored) => Object.fromEntries(
  Object.keys(attrs).filter(key => !ignored.has(key)).map(key => [key, attrs[key]]))

export function equalData(a, b) {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && a.length !== b.length) return false
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(b, key) && equalData(a[key], b[key]))
}

export function blockComparator(ignored) {
  const marksEqual = (a, b) => a.length === b.length && a.every((mark, i) =>
    mark.type === b[i].type && equalData(filterAttrs(mark.attrs, ignored), filterAttrs(b[i].attrs, ignored)))
  const sameMarkup = (a, b) => a.type === b.type &&
    equalData(filterAttrs(a.attrs, ignored), filterAttrs(b.attrs, ignored)) && marksEqual(a.marks, b.marks)
  const cache = new WeakMap()
  const children = node => {
    if (cache.has(node)) return cache.get(node)
    const result = []
    node.forEach(child => {
      const last = result[result.length - 1]
      // Ignored mark attrs can split a text run on only one side.
      if (child.isText && last?.node.isText && sameMarkup(last.node, child)) last.text += child.text
      else result.push({node: child, text: child.text})
    })
    cache.set(node, result)
    return result
  }
  const equal = (a, b) => {
    if (a === b) return true
    if (!sameMarkup(a, b)) return false
    if (a.isText) return a.text === b.text
    const left = children(a), right = children(b)
    return left.length === right.length && left.every((item, i) =>
      item.node.isText ? right[i].node.isText && item.text === right[i].text && sameMarkup(item.node, right[i].node)
        : equal(item.node, right[i].node))
  }
  return {equal, sameMarkup}
}
