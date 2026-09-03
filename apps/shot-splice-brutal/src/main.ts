import './style/index.css';
import { initControlsPanel } from './ui/controlsPanel';
import { initDropzone } from './ui/dropzone';
import { initPreviewPane } from './ui/previewPane';
import { createStore, initialState } from './ui/store';

const store = createStore(initialState());

initDropzone(store);
initPreviewPane(store);
initControlsPanel(store);

// 各モジュールの購読を初期描画させるための空パッチ
store.set({});
