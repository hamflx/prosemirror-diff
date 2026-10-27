import {Schema} from 'prosemirror-model'
import {tableNodes, TableMap} from 'prosemirror-tables'

export const limits = Object.freeze({jsonNodes: 20000, jsonDepth: 64, tableRows: 100,
  physicalCells: 2000, combinedEstimatedSlots: 10000, fileBytes: 2 * 1024 * 1024})
export class SnapshotError extends Error {
  constructor(side, tableOuter, type, details = {}) {
    super(`${side}: ${type}`)
    this.diagnostic = {side, tableOuter, problem: {type, ...details}}
  }
}
// tables 1.8.5 types refer to its newer model Node (including children).
// Its table NodeSpecs use attrs/content supported by model 1.18.1 at runtime.
// Keep this compatibility assertion confined to those specs, not the schema or
// Worker result; table-review-dom exercises their official toDOM with old Nodes.
const tableSpecs = /** @type {Record<string, import('prosemirror-model').NodeSpec>} */ (
  /** @type {unknown} */ (tableNodes({tableGroup:'block', cellContent:'paragraph+', cellAttributes:{}})))
export const schema = new Schema({nodes: {
  doc: {content:'block+'}, paragraph: {group:'block', content:'inline*'},
  text: {group:'inline'}, hard_break: {inline:true, group:'inline'},
  inline_token: {inline:true, group:'inline', atom:true, attrs:{label:{}}},
  ...tableSpecs
}, marks: {strong:{}, em:{}, code:{excludes:'_'}, link:{attrs:{href:{},title:{default:null}}}}})
const attrsByNode = {doc:[], paragraph:[], text:[], hard_break:[], inline_token:['label'],
  table:[], table_row:[], table_cell:['colspan','rowspan','colwidth'], table_header:['colspan','rowspan','colwidth']}
const attrsByMark = {strong:[],em:[],code:[],link:['href','title']}
const own = (object,key) => Object.hasOwn(object,key)
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const positive = value => Number.isSafeInteger(value) && value > 0

export function loadSnapshot(json, side) {
  let count = 0
  const fail = (outer,type,details={}) => { throw new SnapshotError(side,outer,type,details) }
  function fields(value, allowed, outer, label) {
    if (!object(value)) fail(outer,'schema',{reason:label+' must be an object'})
    for(const key of Object.keys(value)) if(!allowed.includes(key)) fail(outer,'schema',{reason:'Unknown '+label+' field',field:key})
  }
  function attributes(value, allowed, outer) {
    if(value === undefined || value === null) return {}
    fields(value,allowed,outer,'attribute')
    return value
  }
  function visit(value,pos,outer,depth) {
    if (++count > limits.jsonNodes || depth > limits.jsonDepth) fail(outer,'json-budget')
    if (!object(value) || typeof value.type !== 'string' || !own(attrsByNode,value.type)) fail(outer,'schema',{reason:'Unknown node type'})
    if(value.type==='doc' && depth!==0) fail(outer,'schema',{reason:'Nested doc is unsupported'})
    if(value.type==='table') {
      if(outer !== null) fail(outer,'nested-table',{nestedOuter:pos})
      outer=pos
    }
    fields(value,value.type==='text'?['type','text','marks']:['type','attrs','content','marks'],outer,'node')
    const attrs=attributes(value.attrs,attrsByNode[value.type],outer)
    if(value.type==='inline_token' && typeof attrs.label !== 'string') fail(outer,'schema',{reason:'Token label must be a string'})
    if(value.type==='table_cell'||value.type==='table_header') {
      for(const key of ['colspan','rowspan']) if(own(attrs,key)&&!positive(attrs[key])) fail(outer,'unsafe-span',{attribute:key,pos:pos-outer-1})
      if(attrs.colwidth !== undefined && attrs.colwidth !== null && (!Array.isArray(attrs.colwidth) || attrs.colwidth.length !== (attrs.colspan ?? 1) || !attrs.colwidth.every(value=>Number.isSafeInteger(value)&&value>=0))) fail(outer,'schema',{reason:'colwidth must be null or a matching array of non-negative safe integers',pos:pos-outer-1})
    }
    if(value.marks !== undefined) {
      if(!Array.isArray(value.marks)) fail(outer,'schema',{reason:'Marks must be an array'})
      for(const mark of value.marks) {
        if(!object(mark)||typeof mark.type!=='string'||!own(attrsByMark,mark.type)) fail(outer,'schema',{reason:'Unknown mark type'})
        fields(mark,['type','attrs'],outer,'mark')
        const data=attributes(mark.attrs,attrsByMark[mark.type],outer)
        if(mark.type==='link'&&(typeof data.href!=='string'||(data.title!==undefined&&data.title!==null&&typeof data.title!=='string'))) fail(outer,'schema',{reason:'Link href/title must be strings (title may be null)'})
      }
    }
    if(value.type==='text') {
      if(typeof value.text!=='string'||!value.text.length) fail(outer,'schema',{reason:'Text must be a nonempty string'})
      return value.text.length
    }
    if(value.content!==undefined&&!Array.isArray(value.content)) fail(outer,'schema',{reason:'Content must be an array'})
    let offset=value.type==='doc'?0:pos+1
    const start=offset
    for(const child of value.content||[]) offset+=visit(child,offset,outer,depth+1)
    return schema.nodes[value.type].isLeaf?1:offset-start+2
  }
  if(!object(json)||json.type!=='doc') fail(null,'schema',{reason:'Root must be doc'})
  visit(json,-1,null,0)
  let doc
  try { doc=schema.nodeFromJSON(json) } catch { fail(null,'model',{reason:'Cannot load fixed-schema snapshot'}) }
  const tables=[]
  doc.descendants((node,pos)=>{if(node.type.name==='table') tables.push({node,pos})})
  for(const {node,pos} of tables) {
    try { node.check() } catch { fail(pos,'model',{reason:'Table content or marks violate the fixed schema'}) }
  }
  try { doc.check() } catch { fail(null,'model',{reason:'Document content or marks violate the fixed schema'}) }
  return {doc,tables}
}

// All raw/model and allocation-budget checks for BOTH inputs precede TableMap.
export function preflight(before, after) {
  let estimatedSlots=0
  const prepared=[]
  for(const [side,input] of [['before',before],['after',after]]) {
    for(const {node,pos:outer} of input.tables) {
      const fail=(type,details={})=>{throw new SnapshotError(side,outer,type,details)}
      const height=node.childCount
      if(height>limits.tableRows) fail('grid-budget',{reason:'Row limit exceeded'})
      let cells=0,spanSum=0
      node.forEach((row,rowOffset,rowIndex)=>row.forEach((cell,cellOffset)=>{
        cells++
        const pos=rowOffset+1+cellOffset
        const {colspan,rowspan}=cell.attrs
        if(!positive(colspan)||!positive(rowspan)) fail('unsafe-span',{pos})
        if(rowspan>height-rowIndex) fail('overlong_rowspan',{pos,n:rowspan-(height-rowIndex)})
        if(cells>limits.physicalCells || colspan>Math.floor((limits.combinedEstimatedSlots-estimatedSlots)/height)-spanSum) fail('grid-budget',{reason:'Combined conservative slot estimate or physical-cell limit exceeded',pos})
        spanSum+=colspan
      }))
      const estimate=spanSum*height
      estimatedSlots+=estimate
      prepared.push({side,outer,node,estimate})
    }
  }
  const grids=[]
  for(const {side,outer,node,estimate} of prepared) {
    const map=TableMap.get(node)
    if(map.problems?.length) throw new SnapshotError(side,outer,'grid',{problems:map.problems})
    grids.push({side,outer,width:map.width,height:map.height,estimatedSlots:estimate})
  }
  return {combinedEstimatedSlots:estimatedSlots,grids}
}
