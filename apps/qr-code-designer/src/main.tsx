import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Fonts are bundled rather than pulled from a CDN so the app makes zero
// external requests at runtime (NFR-001.2).
import '@fontsource/instrument-serif/400.css';
import '@fontsource-variable/manrope';

import './styles/tokens.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/controls.css';

import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('#root が見つかりません。');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
