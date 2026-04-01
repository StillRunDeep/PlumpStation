import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  base: process.env.NODE_ENV === 'production' ? '/PumpStation/' : '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    open: true,
  },
})
