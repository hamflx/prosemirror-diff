// Browser consumer limits, separate from the library and CLI contracts.
export const tableInputLimits = Object.freeze({bytesPerSide:262144, combinedNodes:2000})
export function parseTableInputs(beforeText, afterText) {
  const parse = (text,side) => {
    if (typeof text !== 'string' || text.length > tableInputLimits.bytesPerSide ||
      new TextEncoder().encode(text).length > tableInputLimits.bytesPerSide) {
      throw new RangeError(`${side}: JSON exceeds 256 KiB UTF-8 limit`)
    }
    try { return JSON.parse(text) }
    catch { throw new SyntaxError(`${side}: invalid JSON`) }
  }
  const before=parse(beforeText,'before'), after=parse(afterText,'after')
  const stack=[before,after]
  let nodes=0
  while(stack.length) {
    const node=stack.pop()
    if (++nodes > tableInputLimits.combinedNodes) throw new RangeError('Combined snapshot node limit exceeded (2000)')
    if (node && Array.isArray(node.content)) for(const child of node.content) stack.push(child)
  }
  // Fixed-schema validation and official grid preflight still run after parsing.
  return {before,after}
}
