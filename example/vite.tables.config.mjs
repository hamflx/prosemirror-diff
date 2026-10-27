import {defineConfig} from 'vite'
import {fileURLToPath} from 'node:url'
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),base:'./',
  build:{outDir:'dist/tables',rollupOptions:{input:fileURLToPath(new URL('tables.html',import.meta.url))}}})
