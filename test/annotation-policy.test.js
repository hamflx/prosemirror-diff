import {expect, it} from 'vitest'
import {Schema} from 'prosemirror-model'
import {compareDocumentBlocks, compareDocumentMetadata} from '../src/index.js'
import {reviewAnnotations} from '../example/headless/annotation-policy.mjs'
const s = new Schema({nodes: {doc: {content: 'block*'}, p: {group: 'block', content: 'inline*', attrs: {align: {default: null}}},
  box: {group: 'block', content: 'block'}, atom: {inline: true, group: 'inline', atom: true}, text: {group: 'inline'}},
  marks: {comment: {attrs: {id: {}}}, strong: {}}})
const c = s.mark('comment', {id: 'x'}), strong = s.mark('strong')
const t = (text, marks = []) => s.text(text, marks), p = (content, attrs) => s.node('p', attrs, content)
const doc = content => s.node('doc', null, content)
it('requires opt-in and retains raw records, raw events and model inequality', () => {
  const a = doc(p(t('a'))), b = doc(p(t('a', [c])))
  const raw = compareDocumentBlocks(a,b), records = compareDocumentMetadata(a,b)
  expect(reviewAnnotations(a,b)).toMatchObject({classification:'visible',hiddenRecordIndices:[],visibleRecordIndices:[0],records})
  expect(reviewAnnotations(a,b,['comment'])).toMatchObject({classification:'annotation-only',hiddenRecordIndices:[0],visibleRecordIndices:[],records})
  expect(compareDocumentBlocks(a,b)).toEqual(raw)
  expect(a.eq(b)).toBe(false)
})
it('keeps mixed nonignored marks and attrs visible', () => {
  const a=doc(p(t('a'))), b=doc(p(t('a',[c,strong]),{align:'left'}))
  expect(reviewAnnotations(a,b,['comment'])).toMatchObject({classification:'visible',hiddenRecordIndices:[],visibleRecordIndices:[0,1]})
})
it('partitions separate ignored and visible records without stripping marks', () => {
  const a=doc(p(t('ab'))),b=doc(p([t('a',[c]),t('b',[strong])]))
  const r=reviewAnnotations(a,b,['comment'])
  expect(r).toMatchObject({classification:'visible',hiddenRecordIndices:[0],visibleRecordIndices:[1]})
  if(r.coverage==='metadata') expect(r.records[0].after).toEqual([{type:'comment',attrs:{id:'x'}}])
})
it('preserves nested, inline leaf and split-grapheme original positions and JSON meaning', () => {
  const a=doc(s.node('box',null,p([t('a\u0301'),s.node('atom')]))),b=doc(s.node('box',null,p([t('a'),t('\u0301',[c]),s.node('atom',null,null,[c])])))
  const original=JSON.stringify([a,b]),r=reviewAnnotations(a,b,['comment'])
  expect(r).toMatchObject({classification:'annotation-only',hiddenRecordIndices:[0,1]})
  if(r.coverage==='metadata') expect(r.records.map(x=>[x.oldFrom,x.oldTo,x.newFrom,x.newTo])).toEqual([[3,4,3,4],[4,5,4,5]])
  expect(reviewAnnotations(s.nodeFromJSON(a.toJSON()),s.nodeFromJSON(b.toJSON()),['comment'])).toEqual(r)
  expect(JSON.stringify([a,b])).toBe(original)
})
it('does not hide mixed text or structure, even with comment marks', () => {
  const a=doc(p(t('aa')))
  for(const b of [doc(p(t('a',[c]))),doc(s.node('box',null,p(t('aa',[c]))))]) {
    expect(reviewAnnotations(a,b,['comment'])).toMatchObject({coverage:'unavailable',hiddenRecordIndices:[],visibleRecordIndices:[]})
    expect(reviewAnnotations(a,b,['comment'])).not.toHaveProperty('records')
  }
})
it.each([['missing'],['comment','comment'],[1],null,'comment',Array(1)].map(names=>[names]))('rejects invalid policy %j', names => {
  expect(()=>reviewAnnotations(doc(p(t('x'))),doc(p(t('x'))),names)).toThrow(TypeError)
})
it('rejects wrong root and schema inputs',()=>{
  expect(()=>reviewAnnotations(p(t('a')),p(t('a')),[])).toThrow(TypeError)
  const other=new Schema(s.spec)
  expect(()=>reviewAnnotations(doc(p(t('a'))),other.nodeFromJSON(doc(p(t('a'))).toJSON()))).toThrow(TypeError)
})
it('returns unchanged for empty and equal metadata; detached policy and records',()=>{
  expect(reviewAnnotations(doc([]),doc([]),['comment'])).toMatchObject({classification:'unchanged',records:[]})
  const names=['comment'],a=doc(p(t('x'))),b=doc(p(t('x',[c]))),r=reviewAnnotations(a,b,names)
  names.length=0
  expect(r.ignoredMarks).toEqual(['comment'])
  if(r.coverage==='metadata') r.records[0].after[0].attrs.id='changed'
  expect(b.firstChild.firstChild.marks[0].attrs.id).toBe('x')
})
it('fails closed on invalid metadata without partial records',()=>{
  const bad=s.mark('comment',{id:new Date()})
  expect(reviewAnnotations(doc(p(t('a'))),doc(p(t('a',[bad]))),['comment'])).toMatchObject({coverage:'unavailable',hiddenRecordIndices:[]})
})
it('enforces combined text limit inclusively without treating budget failure as equality',()=>{
  const a=doc(p(t('a'.repeat(50000)))),b=doc(p(t('a'.repeat(50000),[c])))
  expect(reviewAnnotations(a,b,['comment'])).toMatchObject({classification:'annotation-only'})
  expect(reviewAnnotations(a,doc(p(t('a'.repeat(50001),[c]))),['comment'])).toMatchObject({coverage:'unavailable',hiddenRecordIndices:[]})
})
it('enforces combined node admission limit',()=>{
  const a=doc(Array.from({length:9999},()=>p([])))
  expect(reviewAnnotations(a,a,['comment'])).toMatchObject({classification:'unchanged'})
  const b=doc(Array.from({length:10000},()=>p([])))
  expect(reviewAnnotations(a,b,['comment'])).toMatchObject({coverage:'unavailable',hiddenRecordIndices:[]})
})
