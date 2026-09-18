import { defineConfig } from 'vite';

// base: './' keeps built asset URLs relative so dist/ works when served
// from a GitHub Pages project subpath (apps/<slug>/deploy.json: pages=true).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
  },
});
