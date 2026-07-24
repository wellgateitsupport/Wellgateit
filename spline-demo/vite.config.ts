import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// @ alias ชี้ไป src/ — ให้ import แบบ shadcn ('@/components/ui/...') ทำงานได้
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
