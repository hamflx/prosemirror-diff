import {defineConfig} from 'vite'
import {fileURLToPath} from 'node:url'
const root = fileURLToPath(new URL('.', import.meta.url))
export default defineConfig({root, base: './', build: {
  outDir: 'dist/legacy', emptyOutDir: true,
  rollupOptions: {input: fileURLToPath(new URL('legacy.html', import.meta.url))}
}})
