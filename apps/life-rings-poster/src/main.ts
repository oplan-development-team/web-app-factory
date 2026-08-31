import '@fontsource/fraunces/500-italic.css';
import '@fontsource/fraunces/700.css';
import '@fontsource/fraunces/900.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './style.css';
import { mountApp } from './ui/app';

const root = document.getElementById('app');
if (root) mountApp(root);
