import { defineConfig } from 'tsup'

export default defineConfig({
  // Electron's main-process bundle must not depend on pnpm's runtime layout.
  // des.js and its tiny CommonJS dependencies are embedded in main.cjs.
  noExternal: ['des.js', 'inherits', 'minimalistic-assert']
})
