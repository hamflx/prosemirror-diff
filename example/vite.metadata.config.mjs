import {defineConfig} from 'vite'
import {fileURLToPath} from 'node:url'

// Separate entry: the legacy Vue editor demo keeps its existing build unchanged.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  build: {
    assetsInlineLimit: 0,
    outDir: 'dist/metadata',
    rollupOptions: {input: fileURLToPath(new URL('metadata.html', import.meta.url))}
  }
})
