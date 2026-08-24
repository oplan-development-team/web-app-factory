import { defineConfig } from 'vite';

// base: './' keeps built asset URLs relative so dist/ can be served from
// any path (e.g. nginx serving from the container root or a sub-path).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
  },
});
