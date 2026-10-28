import {expect,it} from 'vitest'
import {parseTableInputs,tableInputLimits} from '../example/src/table-json-input.js'
import {reviewTables} from '../example/table-snapshots/review.mjs'
import samples from '../example/table-review/samples.json'
const stringify=JSON.stringify
it('feeds unchanged fixed-schema inputs into the existing comparison contract',()=>{
  for(const sample of samples) {
    const before=stringify(sample.before),after=stringify(sample.after)
    const parsed=parseTableInputs(before,after)
    expect(reviewTables(parsed.before,parsed.after)).toEqual(reviewTables(sample.before,sample.after))
    expect(stringify(parsed.before)).toBe(before);expect(stringify(parsed.after)).toBe(after)
  }
})
it('identifies parse side without echoing malformed source',()=>{
  expect(()=>parseTableInputs('{secret','{}')).toThrow('before: invalid JSON')
  expect(()=>parseTableInputs('{}','{secret')).toThrow('after: invalid JSON')
  expect(()=>parseTableInputs('','{}')).toThrow('before: invalid JSON')
})
it('checks exact UTF-8 bytes, not just UTF-16 length',()=>{
  const max=tableInputLimits.bytesPerSide
  const exact='"'+'x'.repeat(max-2)+'"'
  expect(parseTableInputs(exact,'{}').before).toHaveLength(max-2)
  expect(()=>parseTableInputs(exact+' ','{}')).toThrow('256 KiB')
  const unicode=stringify('😀'.repeat(max/4))
  expect(unicode.length).toBeLessThan(max)
  expect(()=>parseTableInputs('{}',unicode)).toThrow('after: JSON exceeds')
})
it('enforces a combined document-node limit before model/grid work',()=>{
  const paragraph={type:'paragraph'}
  const before={type:'doc',content:Array.from({length:1997},()=>paragraph)}
  const after={type:'doc',content:[paragraph]}
  expect(parseTableInputs(stringify(before),stringify(after)).before.content).toHaveLength(1997)
  before.content.push(paragraph)
  expect(()=>parseTableInputs(stringify(before),stringify(after))).toThrow('2000')
})
it('keeps model/grid rejection separate from syntax and handles Unicode/marks literally',()=>{
  const make=text=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text,marks:[{type:'strong'}]}]}]})
  const parsed=parseTableInputs(stringify(make('👩‍💻 café')),stringify(make('👩‍🔬 café')))
  expect(reviewTables(parsed.before,parsed.after).snapshots).toEqual({before:parsed.before,after:parsed.after})
  const invalid=structuredClone(samples[0].before);invalid.content[1].content[0].content.pop()
  const pair=parseTableInputs(stringify(invalid),stringify(samples[0].after))
  expect(()=>reviewTables(pair.before,pair.after)).toThrow('grid')
  const unknown=parseTableInputs('{"type":"alien"}','{}')
  expect(()=>reviewTables(unknown.before,unknown.after)).toThrow()
})
