import { defineConfig } from 'vite';

// base: './' keeps built asset URLs relative so dist/ works when served from
// a GitHub Pages project subpath (e.g. /web-app-factory/lava-lamp-studio/).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
  },
});
