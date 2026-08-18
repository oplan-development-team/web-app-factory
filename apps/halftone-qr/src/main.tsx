import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// wdth.css は wght(100-900) と wdth(62-125%) の両軸を含む可変フォント。
// 見出しを軽く凝縮させるために width 軸を使うので、標準版ではなくこちらを読む。
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/tokens.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/controls.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
