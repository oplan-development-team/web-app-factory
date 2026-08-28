import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' is required because GitHub Pages serves this app from the
// sub-path /web-app-factory/column-daily/.
export default defineConfig({
  plugins: [react()],
  base: './',
});
