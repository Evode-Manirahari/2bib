import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  clean: true,
});
