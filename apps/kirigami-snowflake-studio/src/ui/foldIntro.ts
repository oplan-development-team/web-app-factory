import { svgEl, el } from './dom';

const VIEW = { minX: -150, minY: -290, width: 300, height: 320 };
const RADIUS = 260;

function pieSilhouette(spanDeg: number, radius: number): string {
  if (spanDeg >= 359.9) {
    // full hexagon-ish silhouette (approximated as a 6-gon for a paper feel)
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const a = ((-90 + i * 60) * Math.PI) / 180;
      pts.push(`${radius * Math.cos(a)},${radius * Math.sin(a)}`);
    }
    return `M ${pts.join(' L ')} Z`;
  }
  const steps = Math.max(6, Math.round(spanDeg / 4));
  const start = -90 - spanDeg / 2;
  const pts: string[] = ['0,0'];
  for (let i = 0; i <= steps; i++) {
    const a = ((start + (spanDeg * i) / steps) * Math.PI) / 180;
    pts.push(`${radius * Math.cos(a)},${radius * Math.sin(a)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

const STAGES = [360, 180, 60, 30];

export interface FoldIntroHandle {
  element: HTMLElement;
  play: () => void;
}

export function mountFoldIntro(stage: HTMLElement): FoldIntroHandle {
  const overlay = el('div', { class: 'fold-intro', 'aria-hidden': 'true' });
  const svg = svgEl('svg', {
    class: 'fold-intro-svg',
    viewBox: `${VIEW.minX} ${VIEW.minY} ${VIEW.width} ${VIEW.height}`,
  });
  const shape = svgEl('path', { class: 'fold-intro-shape' });
  const crease = svgEl('line', { class: 'fold-intro-crease', x1: '0', y1: String(-RADIUS), x2: '0', y2: '20' });
  svg.append(shape, crease);
  overlay.append(svg);

  const caption = el('p', { class: 'fold-intro-caption' }, ['紙を折りたたんでいます…']);
  overlay.append(caption);

  const skipBtn = el('button', { class: 'fold-intro-skip', type: 'button' }, ['スキップ']);
  overlay.append(skipBtn);

  stage.append(overlay);

  let timers: number[] = [];
  function clearTimers() {
    timers.forEach((t) => window.clearTimeout(t));
    timers = [];
  }

  function finish() {
    clearTimers();
    overlay.classList.add('fold-intro--done');
    window.setTimeout(() => overlay.classList.remove('fold-intro--playing', 'fold-intro--done'), 500);
  }

  skipBtn.addEventListener('click', finish);

  function play() {
    clearTimers();
    overlay.classList.remove('fold-intro--done');
    overlay.classList.add('fold-intro--playing');
    shape.setAttribute('d', pieSilhouette(STAGES[0], RADIUS));
    shape.classList.remove('fold-intro-shape--pulse');

    const stepDuration = 300;
    STAGES.forEach((span, i) => {
      if (i === 0) return;
      const t = window.setTimeout(() => {
        crease.classList.remove('fold-intro-crease--flash');
        void crease.getBoundingClientRect();
        crease.classList.add('fold-intro-crease--flash');
        shape.setAttribute('d', pieSilhouette(span, RADIUS));
        shape.classList.remove('fold-intro-shape--pulse');
        void shape.getBoundingClientRect();
        shape.classList.add('fold-intro-shape--pulse');
        caption.textContent = i === STAGES.length - 1 ? '30°のウェッジができました' : `${i}回目の折り目`;
      }, stepDuration * i);
      timers.push(t);
    });

    const finishTimer = window.setTimeout(finish, stepDuration * STAGES.length + 350);
    timers.push(finishTimer);
  }

  return { element: overlay, play };
}
