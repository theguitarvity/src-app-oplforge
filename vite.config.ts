import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@electron': path.resolve(import.meta.dirname, './electron'),
      '@tests': path.resolve(import.meta.dirname, './tests')
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  test: {
    environment: 'node',
    setupFiles: './vitest.setup.ts',
    css: true,
    // mobile/ is a separate npm project with its own Jest-based test setup
    // (jest-expo, @testing-library/react-native) — without this, vitest's
    // default file discovery sweeps up mobile/__tests__/**, which fails
    // since those tests expect Jest's runtime, not vitest's.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-electron/**',
      '**/release/**',
      '**/.{idea,git,cache,output,temp}/**',
      'mobile/**'
    ]
  }
})
