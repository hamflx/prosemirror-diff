import {defineConfig} from 'vite'
import {fileURLToPath} from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  build: {
    assetsInlineLimit: 0,
    outDir: 'dist/blocks',
    rollupOptions: {input: fileURLToPath(new URL('blocks.html', import.meta.url))}
  }
})
