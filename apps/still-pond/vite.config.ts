import { defineConfig } from 'vitest/config';

// base: './' keeps built asset URLs relative so dist/ can be hosted from a
// GitHub Pages subpath (/<repo>/still-pond/) as well as the repo root.
export default defineConfig({
  base: './',
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
