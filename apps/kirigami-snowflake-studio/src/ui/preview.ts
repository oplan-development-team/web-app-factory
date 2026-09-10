import { assembleSnowflakePathD, assembleSnowflakePaths } from '../geometry/assemble';
import { WEDGE_RADIUS } from '../geometry/types';
import { store } from '../store';
import { svgEl } from './dom';

const BOUND = WEDGE_RADIUS * 1.12;

export function mountThumbnail(container: HTMLElement): { svg: SVGSVGElement } {
  const svg = svgEl('svg', {
    class: 'thumb-svg',
    viewBox: `${-BOUND} ${-BOUND} ${BOUND * 2} ${BOUND * 2}`,
    role: 'img',
    'aria-label': '結晶のリアルタイムプレビュー',
  });
  const path = svgEl('path', { class: 'thumb-paper', 'fill-rule': 'evenodd' });
  svg.append(path);
  container.append(svg);

  function render() {
    path.setAttribute('d', assembleSnowflakePathD(store.cuts));
  }
  store.subscribe(render);
  render();
  return { svg };
}

export interface ExpandedViewHandle {
  svg: SVGSVGElement;
  playOpen: () => void;
  playClose: () => void;
  refresh: () => void;
}

export function mountExpandedView(container: HTMLElement): ExpandedViewHandle {
  const svg = svgEl('svg', {
    class: 'expanded-svg',
    viewBox: `${-BOUND} ${-BOUND} ${BOUND * 2} ${BOUND * 2}`,
    role: 'img',
    'aria-label': '展開後の雪結晶プレビュー',
  });
  const group = svgEl('g', { class: 'petal-group' });
  svg.append(group);
  container.append(svg);

  function buildPetals() {
    group.replaceChildren();
    const paths = assembleSnowflakePaths(store.cuts);
    paths.forEach((d, i) => {
      const p = svgEl('path', { class: 'petal', 'fill-rule': 'evenodd', d });
      p.style.setProperty('--i', String(i));
      group.append(p);
    });
  }

  function refresh() {
    buildPetals();
  }

  function playOpen() {
    buildPetals();
    group.classList.remove('petal-group--open', 'petal-group--closing');
    // force reflow before adding the animating class
    void svg.getBoundingClientRect();
    group.classList.add('petal-group--open');
  }

  function playClose() {
    group.classList.remove('petal-group--open');
    group.classList.add('petal-group--closing');
  }

  store.subscribe(() => {
    if (store.viewMode === 'expanded') buildPetals();
  });

  return { svg, playOpen, playClose, refresh };
}
