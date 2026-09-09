import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serves this app from a sub-path (/<repo>/<slug>/), so every
  // asset URL has to stay relative to index.html.
  base: './',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // The WebGL/DOM layers are excluded on purpose: exercising them in jsdom
      // would test the mock, not the renderer. They are covered by the
      // Playwright pass described in docs/TASKS.md instead.
      include: ['src/domain/**/*.ts', 'src/infra/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
