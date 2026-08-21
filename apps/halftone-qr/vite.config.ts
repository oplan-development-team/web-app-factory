import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base: './' keeps built asset URLs relative so `dist/` can be dropped into any
// static host, including a subdirectory (NFR-002.2).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
