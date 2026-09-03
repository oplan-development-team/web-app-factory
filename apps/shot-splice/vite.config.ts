import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages はサブパス配信（/<repo>/<slug>/）になるため相対パスで出力する。
  base: './',
});
