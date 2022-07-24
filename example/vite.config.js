import { defineConfig } from 'vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@hamflx/prosemirror-diff': resolve(__dirname, '../src/index.js')
    }
  },
  plugins: [vue()]
})
