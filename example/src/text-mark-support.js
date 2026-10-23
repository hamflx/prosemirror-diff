// The example renders only this fixed mark vocabulary, never arbitrary toDOM.
export function supportedTextMark(mark) {
  const keys = Object.keys(mark.attrs)
  if (['strong', 'em', 'code'].includes(mark.type.name)) return keys.length === 0
  return mark.type.name === 'link' && keys.every(key => key === 'href' || key === 'title') &&
    typeof mark.attrs.href === 'string' && (mark.attrs.title == null || typeof mark.attrs.title === 'string')
}
