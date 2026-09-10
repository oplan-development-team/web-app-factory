import { defineConfig } from 'vite';

// base: './' keeps built asset URLs relative so dist/ works when served from
// a GitHub Pages project subpath (…/web-app-factory/quick-draw-duel/).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
  },
});
