import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps the built asset URLs relative so `dist/` can be dropped into
// any static host, including a subdirectory (NFR-002.2).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
  },
});
