import './showcase.css'
import {Schema} from 'prosemirror-model'
import {schema as tableSchema} from '../table-snapshots/schema.mjs'
import {compareDocumentBlocks,compareDocumentMetadata} from '../../src/index.js'
import {mountAlignedReview} from './aligned-review.js'
import {reviewSnapshots} from '../headless/review.mjs'
import oldFormatting from '../headless/formatting-old.json'
import newFormatting from '../headless/formatting-new.json'
import {reviewAnnotations} from '../headless/annotation-policy.mjs'
import {schema as reviewSchema} from '../headless/schema.mjs'
const host=document.querySelector('#workspace'),nav=document.querySelector('#navigation')
const element=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n}
let dispose=()=>{}
function heading(title,description){host.append(element('h2',title),element('p',description))}
function aligned(){heading('双侧对齐，沿同一位置阅读','相同块对齐；双向同步滚动。选择变化块的 Review text，在原始格式中查看字素级文字变化。结构或原子节点无法可靠对应时保留整块。')
 const p=text=>tableSchema.node('paragraph',null,text?tableSchema.text(text):null),doc=(...nodes)=>tableSchema.node('doc',null,nodes)
 const table=tableSchema.node('table',null,Array.from({length:50},(_,i)=>tableSchema.node('table_row',null,[tableSchema.node('table_cell',null,p(`第 ${i+1} 行 · 原始表格`))])))
 const cases={插入块:[doc(p('共同起点'),p('共同结尾')),doc(p('共同起点'),p('新增段落'),p('共同结尾'))],删除块:[doc(p('共同起点'),p('删除段落'),p('共同结尾')),doc(p('共同起点'),p('共同结尾'))],高度差与长表:[doc(p('简短内容'),table,p('共同结尾')),doc(p('较长的新段落。'.repeat(90)),table,p('共同结尾'))],Unicode块内编辑:[doc(p('你好 👩🏽‍💻 café，今天一起阅读。'),p('共同结尾')),doc(p('你好 👨‍👩‍👧 café，今天一起审阅。'),p('共同结尾'))]}
 const bar=element('div');bar.className='toolbar';const label=element('label','场景 '),select=element('select');for(const key of Object.keys(cases))select.append(element('option',key));label.append(select);bar.append(label);host.append(bar);const target=element('div');host.append(target)
 let view;function render(){const [before,after]=cases[select.value];if(view)view.update({before,after});else view=mountAlignedReview(target,{before,after})}select.addEventListener('change',render);render();dispose=()=>view.dispose()
}
function attributes(){heading('只比较你关心的属性','配置直接属性名，同时作用于节点和 marks。默认不排除；忽略 id 不会忽略正文或其他格式。两侧原件始终保留。')
 const schema=new Schema({nodes:{doc:{content:'paragraph+'},paragraph:{content:'text*',attrs:{id:{default:null},align:{default:'left'}}},text:{}},marks:{link:{attrs:{href:{},id:{default:null}}}}})
 const make=(id,align,href)=>schema.node('doc',null,[schema.node('paragraph',{id,align},schema.text('相同文字，比较属性',[schema.mark('link',{href,id})]))])
 const before=make('old-id','left','https://example.org/a');const bar=element('div');bar.className='toolbar';const label=element('label','忽略属性（逗号分隔） '),input=element('input');input.value='id';input.setAttribute('aria-label','忽略属性名称');label.append(input);const toggle=element('input');toggle.type='checkbox';const mixed=element('label','同时修改 align 和 href ');mixed.append(toggle);bar.append(label,mixed);host.append(bar)
 const warning=element('p','过滤结果不是完整重建脚本。返回记录保留完整原始 attrs；没有记录只代表当前过滤策略下没有差异。');warning.className='callout';host.append(warning);const output=element('pre');output.className='result';host.append(output);const originals=element('div');originals.className='split';host.append(originals)
 function run(){const after=make('new-id',toggle.checked?'center':'left',toggle.checked?'https://example.org/b':'https://example.org/a');const options={ignoreAttributes:input.value.split(',').map(s=>s.trim()).filter(Boolean)};try{const blocks=compareDocumentBlocks(before,after,options);const metadata=compareDocumentMetadata(before,after,options);output.textContent=JSON.stringify({options,comparison:blocks.comparison,events:blocks.changes.map(({kind,oldFrom,oldTo,newFrom,newTo})=>({kind,oldFrom,oldTo,newFrom,newTo})),metadata},null,2);originals.replaceChildren(...[before,after].map((doc,i)=>{const panel=element('article');panel.append(element('h3',i?'After · 原件':'Before · 原件'));const pre=element('pre',JSON.stringify(doc.toJSON(),null,2));pre.className='result';panel.append(pre);return panel}))}catch(error){output.textContent=String(error)}}input.addEventListener('input',run);toggle.addEventListener('change',run);run()
}
const pages={文字与嵌套:['blocks.html','文字、字素与嵌套结构','调整矩阵预算与嵌套深度，查看双侧原始范围、文字变化和格式清单。预算回退与不可配对结构保持可见。'],格式与属性:['metadata.html','格式与属性','在同文字同结构契约内，比较 strong、链接、图片属性与明确的节点范围。'],表格与JSON:['tables.html','合法表格的两侧审阅','本地输入两份固定 schema JSON。表格网格预检、事件定位、文字与 metadata 明细均由实际消费者运行；不推断单元格身份。'],旧API迁移:['legacy.html','旧混合文档 API 的边界','严格 schema 无法容纳变更标记时明确失败。使用结构化结果与独立原件避免生成非法文档。']}
function integration(){heading('同一比较模型，离线消费','下面直接运行仓库的固定 schema headless helper，而不是预制报告。文字与格式同时变化时，两侧格式清单独立列出，不推断跨版本字符身份。')
 const bar=element('div');bar.className='toolbar';const label=element('label','附加两侧原始格式清单 '),check=element('input');check.type='checkbox';check.checked=true;label.append(check);bar.append(label);host.append(bar);const result=element('pre');result.className='result';host.append(result)
 const run=()=>{try{result.textContent=JSON.stringify(reviewSnapshots(oldFormatting,newFormatting,'1',{maxDepth:2,maxCells:100000},{formatting:check.checked}),null,2)}catch(error){result.textContent=String(error)}};check.addEventListener('change',run);run()
 host.append(element('h3','显示策略与 raw 数据分离'),element('p','以 strong 作为可忽略 mark 的最小示例。隐藏索引不删除 raw metadata；正文同时修改时，分类会保守标记 unavailable。它不同于核心的属性比较过滤。'))
 const policyBar=element('div');policyBar.className='toolbar';const hideLabel=element('label','隐藏 strong-only 记录 '),hide=element('input');hide.type='checkbox';hideLabel.append(hide);const textLabel=element('label','同时修改正文 '),edit=element('input');edit.type='checkbox';textLabel.append(edit);policyBar.append(hideLabel,textLabel);host.append(policyBar);const policy=element('pre');policy.className='result';host.append(policy)
 const annotation=()=>{const doc=(text,marks=[])=>reviewSchema.node('doc',null,[reviewSchema.node('paragraph',null,reviewSchema.text(text,marks))]);policy.textContent=JSON.stringify(reviewAnnotations(doc('Review'),doc(edit.checked?'Changed':'Review',[reviewSchema.mark('strong')]),hide.checked?['strong']:[]),null,2)};hide.addEventListener('change',annotation);edit.addEventListener('change',annotation);annotation()
 host.append(element('h3','在本地使用相同消费者'));const command=element('pre','node example/headless/cli.mjs example/headless/formatting-old.json example/headless/formatting-new.json 1 --formatting');command.className='result';host.append(command)
 const links=[['包与类型入口','README.md'],['离线 JSON 与事件路径','example/headless/README.md'],['批注显示分类：保留 raw 记录','example/headless/ANNOTATIONS.md'],['表格模型与网格校验','example/table-snapshots/README.md'],['能力与验证映射','docs/capability-matrix.md']];const list=element('ul');for(const [label,path] of links){const item=element('li'),link=element('a',label);link.href='https://github.com/hamflx/prosemirror-diff/blob/master/'+path;item.append(link);list.append(item)}host.append(list)
}
const tabs={双侧对齐:aligned,属性排除:attributes,...Object.fromEntries(Object.entries(pages).map(([key,[url,title,description]])=>[key,()=>{heading(title,description);const link=element('a','在完整页面打开 ↗');link.href=url;host.append(link);const frame=element('iframe');frame.title=title;frame.src=url;host.append(frame)}])),离线与接入:integration}
for(const [name,render] of Object.entries(tabs)){const button=element('button',name);button.type='button';button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{dispose();dispose=()=>{};host.replaceChildren();for(const other of nav.children)other.setAttribute('aria-pressed',String(other===button));render()});nav.append(button)}nav.querySelector('button').click()
