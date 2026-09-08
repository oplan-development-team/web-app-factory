import { defineConfig } from 'vite';

// base: './' keeps built asset URLs relative so dist/ can be served from a
// GitHub Pages project subpath (see deploy.json).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
  },
});
