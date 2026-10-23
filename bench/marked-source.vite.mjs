import {defineConfig} from 'vite'
import {fileURLToPath} from 'node:url'
export default defineConfig({root:fileURLToPath(new URL('..',import.meta.url)),base:'./',build:{outDir:'logs/marked-source-dist',rollupOptions:{input:fileURLToPath(new URL('marked-source.html',import.meta.url))}}})
