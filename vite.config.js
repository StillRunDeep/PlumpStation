import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  base: '/PumpStation/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    open: true,
  },
})
