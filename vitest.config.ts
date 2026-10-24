import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src'), '@content': path.resolve(__dirname, 'content') } },
  test: { include: ['tests/**/*.test.ts'] },
});
