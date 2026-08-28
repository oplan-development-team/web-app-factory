import { defineConfig } from 'vite';

// base: './' keeps built asset URLs relative so dist/ can be served from any
// static host or subpath (matches the other apps/ prototypes in this repo).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
  },
});
