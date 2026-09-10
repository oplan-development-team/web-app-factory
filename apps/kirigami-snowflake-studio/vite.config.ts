import { defineConfig } from 'vitest/config';

// base: './' keeps built asset URLs relative so dist/ works when served from
// a GitHub Pages project subpath (…/web-app-factory/kirigami-snowflake-studio/).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
  },
});
