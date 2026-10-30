import {defineConfig} from 'vite'
import {fileURLToPath} from 'node:url'
import {copyFileSync} from 'node:fs'
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),base:'./',build:{outDir:'dist/showcase',rollupOptions:{input:Object.fromEntries(['lab','blocks','metadata','tables','legacy'].map(name=>[name,fileURLToPath(new URL(`${name}.html`,import.meta.url))]))}},plugins:[{name:'showcase-root',apply:'build',transformIndexHtml:{order:'pre',handler(){return [{tag:'script',attrs:{type:'module',src:'/src/showcase-theme.js'},injectTo:'head'}]}},closeBundle(){copyFileSync(new URL('dist/showcase/lab.html',import.meta.url),new URL('dist/showcase/index.html',import.meta.url))}}]})
