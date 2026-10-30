import {expect,test} from 'vitest'
import {readFileSync} from 'node:fs'
import postcss from 'postcss'

test('comparison columns never stack at mobile breakpoints while details may stack',()=>{
  const files=['metadata-demo.css','blocks-demo.css','tables-demo.css','showcase.css']
  let columnRules=0,overflow=false,detailsStack=false
  for(const file of files){
    const css=postcss.parse(readFileSync(new URL('../example/src/'+file,import.meta.url),'utf8'))
    css.walkRules(rule=>{
      if(rule.selectors.some(selector=>selector.trim().endsWith('.documents'))){
        rule.walkDecls('grid-template-columns',decl=>{
          columnRules++
          expect(decl.value.replace(/\s+/g,'')).toBe('minmax(0,1fr)minmax(0,1fr)')
        })
      }
      if(rule.selectors.some(selector=>selector.trim().endsWith('.document')))
        rule.walkDecls('overflow',decl=>{if(decl.value==='auto')overflow=true})
      if(rule.selectors.some(selector=>selector.trim().endsWith('.values')))
        rule.walkDecls('grid-template-columns',decl=>{if(decl.value==='1fr')detailsStack=true})
    })
  }
  expect(columnRules).toBeGreaterThan(0)
  expect(overflow).toBe(true)
  expect(detailsStack).toBe(true)
})
