import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true,
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['dist/**/*.js'],
    },
  },
  resolve: {
    alias: {
      // Test against the built output to verify actual exports
      '@vouch-protocol/sdk': resolve(__dirname, './dist/index.mjs'),
    },
  },
});
