import { collectElements } from './dom';
import { Stage } from './stage';
import { activeSeed, activeSource, createInitialState } from '../state/appState';
import type { RenderParams } from '../core/compose';
import type { AppState } from '../types';

/** アプリの起動。結線は後続タスクで埋める。 */
export function bootstrap(): void {
  const elements = collectElements();
  let state: AppState = createInitialState();

  const paramsOf = (current: AppState): RenderParams => ({
    source: activeSource(current),
    seed: activeSeed(current),
    contrast: current.contrast,
    threshold: current.threshold,
    inkPresetId: current.inkPresetId,
    mottle: current.mottle,
    grain: current.grain,
    vignette: current.vignette,
    edgeStyle: current.edgeStyle,
    layout: current.layout,
    label: current.label,
  });

  const stage = new Stage(
    {
      canvas: elements.previewCanvas,
      empty: elements.stageEmpty,
      loading: elements.stageLoading,
      loadingText: elements.stageLoadingText,
    },
    () => paramsOf(state),
  );

  elements.fieldDate.value = state.label.date;
  stage.showEmpty();
}
