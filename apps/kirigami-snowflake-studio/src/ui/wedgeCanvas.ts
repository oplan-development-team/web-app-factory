import type { Cut, EdgeId, Point, SemicircleCut, TriangleCut } from '../geometry/types';
import { NOTCH_SIZES, WEDGE_RADIUS } from '../geometry/types';
import { WEDGE_ANGLE, edgeLength } from '../geometry/edge';
import { wedgePathD } from '../geometry/assemble';
import { rotatePoint } from '../geometry/assemble';
import { validatePlacement } from '../geometry/validation';
import { store, nextId } from '../store';
import { svgEl } from './dom';
import { showToast } from './toast';

/** Rotates the wedge's canonical (apex-left) local frame so its bisector points to screen-up,
 * giving the classic "paper fan, apex at the bottom" presentation on the cutting mat. */
const DISPLAY_ROTATION = 255;

const VIEW = { minX: -150, minY: -290, width: 300, height: 320 };
const EDGE_SNAP = 26;
const RIGHT_DIR = { x: Math.cos((WEDGE_ANGLE.deg * Math.PI) / 180), y: Math.sin((WEDGE_ANGLE.deg * Math.PI) / 180) };

function toLocal(p: Point): Point {
  return rotatePoint(p, -DISPLAY_ROTATION);
}

interface EdgeProjection {
  edge: EdgeId;
  u: number;
  distance: number;
}

function projectToEdges(p: Point): EdgeProjection[] {
  const leftU = p.x;
  const leftDist = Math.abs(p.y);
  const rightU = p.x * RIGHT_DIR.x + p.y * RIGHT_DIR.y;
  const rightDist = Math.abs(p.x * RIGHT_DIR.y - p.y * RIGHT_DIR.x);
  const r = Math.hypot(p.x, p.y);
  const thetaDeg = (Math.atan2(p.y, p.x) * 180) / Math.PI;
  const arcU = (Math.max(0, Math.min(WEDGE_ANGLE.deg, thetaDeg)) * Math.PI) / 180 * WEDGE_RADIUS;
  const arcDist = thetaDeg >= -3 && thetaDeg <= WEDGE_ANGLE.deg + 3 ? Math.abs(WEDGE_RADIUS - r) : Infinity;
  return [
    { edge: 'left', u: Math.max(0, Math.min(WEDGE_RADIUS, leftU)), distance: leftU >= -8 && leftU <= WEDGE_RADIUS + 8 ? leftDist : Infinity },
    { edge: 'right', u: Math.max(0, Math.min(WEDGE_RADIUS, rightU)), distance: rightU >= -8 && rightU <= WEDGE_RADIUS + 8 ? rightDist : Infinity },
    { edge: 'arc', u: arcU, distance: arcDist },
  ];
}

function nearestEdge(p: Point): EdgeProjection {
  const proj = projectToEdges(p);
  return proj.reduce((a, b) => (b.distance < a.distance ? b : a));
}

function isInsideWedge(p: Point): boolean {
  const r = Math.hypot(p.x, p.y);
  const thetaDeg = (Math.atan2(p.y, p.x) * 180) / Math.PI;
  return r <= WEDGE_RADIUS + 2 && thetaDeg >= -1 && thetaDeg <= WEDGE_ANGLE.deg + 1;
}

function cutHitPoint(cut: Cut): Point {
  if (cut.kind === 'wave') {
    const mid = (cut.uStart + cut.uEnd) / 2;
    return edgePointAt(cut.edge, mid);
  }
  if ('placement' in cut && cut.placement === 'interior') {
    const c = cut as TriangleCut | SemicircleCut;
    return { x: c.x ?? 0, y: c.y ?? 0 };
  }
  const c = cut as TriangleCut | SemicircleCut | { edge: EdgeId; u: number };
  return edgePointAt((c as { edge: EdgeId }).edge, (c as { u: number }).u);
}

function edgePointAt(edge: EdgeId, u: number): Point {
  if (edge === 'left') return { x: u, y: 0 };
  if (edge === 'right') return { x: u * RIGHT_DIR.x, y: u * RIGHT_DIR.y };
  const theta = u / WEDGE_RADIUS;
  return { x: WEDGE_RADIUS * Math.cos(theta), y: WEDGE_RADIUS * Math.sin(theta) };
}

function cutHitRadius(cut: Cut): number {
  if (cut.kind === 'triangle') return Math.max(16, cut.width / 2);
  if (cut.kind === 'semicircle') return Math.max(16, cut.radius);
  if (cut.kind === 'wave') return 16;
  return 14; // notch
}

type DragKind = 'wave-range' | 'depth' | 'width' | 'radius' | 'scale' | 'range-start' | 'range-end';

interface DragState {
  kind: DragKind;
  cutId: string;
  before: Cut[];
  startLocal: Point;
  waveEdge?: EdgeId;
  waveStartU?: number;
}

export function mountWedgeCanvas(container: HTMLElement): { flashInvalid: () => void } {
  const svg = svgEl('svg', {
    class: 'wedge-canvas',
    viewBox: `${VIEW.minX} ${VIEW.minY} ${VIEW.width} ${VIEW.height}`,
    role: 'img',
    'aria-label': 'ウェッジ編集キャンバス',
  });

  const defs = svgEl('defs');
  const pattern = svgEl('pattern', { id: 'cutting-mat-dots', width: '18', height: '18', patternUnits: 'userSpaceOnUse' });
  const dot = svgEl('circle', { cx: '2', cy: '2', r: '1.1', fill: 'rgba(125,211,224,0.10)' });
  pattern.append(dot);
  defs.append(pattern);
  svg.append(defs);

  const bg = svgEl('rect', {
    x: String(VIEW.minX),
    y: String(VIEW.minY),
    width: String(VIEW.width),
    height: String(VIEW.height),
    fill: 'url(#cutting-mat-dots)',
  });
  svg.append(bg);

  const wedgeGroup = svgEl('g', { transform: `rotate(${DISPLAY_ROTATION})` });
  svg.append(wedgeGroup);

  const paperPath = svgEl('path', { class: 'wedge-paper', 'fill-rule': 'evenodd' });
  wedgeGroup.append(paperPath);

  // fold-edge + arc guide lines
  const leftGuide = svgEl('line', { class: 'guide-line', x1: '0', y1: '0', x2: String(WEDGE_RADIUS), y2: '0' });
  const rightEnd = edgePointAt('right', WEDGE_RADIUS);
  const rightGuide = svgEl('line', { class: 'guide-line', x1: '0', y1: '0', x2: String(rightEnd.x), y2: String(rightEnd.y) });
  wedgeGroup.append(leftGuide, rightGuide);

  const handleLayer = svgEl('g', { class: 'handle-layer' });
  wedgeGroup.append(handleLayer);

  const hitLayer = svgEl('g', { class: 'hit-layer' });
  wedgeGroup.append(hitLayer);

  const emptyLabel = svgEl('text', { class: 'empty-hint', x: '0', y: '-150', 'text-anchor': 'middle' });
  emptyLabel.textContent = 'ここに切り込みを配置してみましょう';
  wedgeGroup.append(emptyLabel);

  container.append(svg);

  let drag: DragState | null = null;

  function svgPointFromEvent(evt: PointerEvent): Point {
    const rect = svg.getBoundingClientRect();
    const px = ((evt.clientX - rect.left) / rect.width) * VIEW.width + VIEW.minX;
    const py = ((evt.clientY - rect.top) / rect.height) * VIEW.height + VIEW.minY;
    return toLocal({ x: px, y: py });
  }

  function flashInvalid() {
    svg.classList.remove('shake');
    // force reflow so the animation can restart
    void svg.getBoundingClientRect();
    svg.classList.add('shake');
  }

  function placeAt(local: Point) {
    const tool = store.activeTool;
    if (!tool) return;
    const proj = nearestEdge(local);
    const onEdge = proj.distance <= EDGE_SNAP;

    if (tool === 'wave') {
      if (!onEdge) {
        showToast({ message: '波線は辺の上でドラッグしてください', tone: 'error' });
        flashInvalid();
        return;
      }
      drag = { kind: 'wave-range', cutId: '', before: [], startLocal: local, waveEdge: proj.edge, waveStartU: proj.u };
      return;
    }

    if (tool === 'notch') {
      if (!onEdge) {
        showToast({ message: '辺の近くをクリックしてください', tone: 'error' });
        flashInvalid();
        return;
      }
      const size = store.toolSettings.notchSize;
      const margin = NOTCH_SIZES[size].width / 2 + 4;
      const u = Math.max(margin, Math.min(edgeLength(proj.edge) - margin, proj.u));
      const cut: Cut = { id: nextId('notch'), kind: 'notch', placement: 'edge', edge: proj.edge, u, size };
      const result = validatePlacement(cut, store.cuts);
      if (!result.ok) {
        showToast({ message: result.reason ?? '配置できません', tone: 'error' });
        flashInvalid();
        return;
      }
      store.addCut(cut);
      return;
    }

    if (tool === 'triangle') {
      const width = store.toolSettings.triangleWidth;
      const depth = store.toolSettings.triangleDepth;
      let cut: Cut;
      if (onEdge) {
        const margin = width / 2 + 4;
        const u = Math.max(margin, Math.min(edgeLength(proj.edge) - margin, proj.u));
        cut = { id: nextId('tri'), kind: 'triangle', placement: 'edge', edge: proj.edge, u, width, depth };
      } else if (isInsideWedge(local)) {
        cut = { id: nextId('tri'), kind: 'triangle', placement: 'interior', x: local.x, y: local.y, width, depth: width, rotation: 0 };
      } else {
        return;
      }
      const result = validatePlacement(cut, store.cuts);
      if (!result.ok) {
        showToast({ message: result.reason ?? '配置できません', tone: 'error' });
        flashInvalid();
        return;
      }
      store.addCut(cut);
      return;
    }

    if (tool === 'semicircle') {
      const radius = store.toolSettings.semicircleRadius;
      let cut: Cut;
      if (onEdge) {
        const margin = radius + 4;
        const u = Math.max(margin, Math.min(edgeLength(proj.edge) - margin, proj.u));
        cut = { id: nextId('semi'), kind: 'semicircle', placement: 'edge', edge: proj.edge, u, radius };
      } else if (isInsideWedge(local)) {
        cut = { id: nextId('semi'), kind: 'semicircle', placement: 'interior', x: local.x, y: local.y, radius };
      } else {
        return;
      }
      const result = validatePlacement(cut, store.cuts);
      if (!result.ok) {
        showToast({ message: result.reason ?? '配置できません', tone: 'error' });
        flashInvalid();
        return;
      }
      store.addCut(cut);
    }
  }

  function startHandleDrag(kind: DragKind, cutId: string, startLocal: Point) {
    drag = { kind, cutId, before: store.cuts.map((c) => ({ ...c })), startLocal };
  }

  svg.addEventListener('pointerdown', (evt) => {
    const target = evt.target as SVGElement;
    const handleType = target.dataset?.handle as DragKind | undefined;
    const handleCutId = target.dataset?.cutId;
    const local = svgPointFromEvent(evt);

    if (handleType && handleCutId) {
      startHandleDrag(handleType, handleCutId, local);
      svg.setPointerCapture(evt.pointerId);
      evt.stopPropagation();
      return;
    }

    const hitCutId = target.dataset?.hitCutId;
    if (hitCutId) {
      store.select(hitCutId);
      return;
    }

    store.select(null);
    placeAt(local);
    if (drag) svg.setPointerCapture(evt.pointerId);
  });

  svg.addEventListener('pointermove', (evt) => {
    if (!drag) return;
    const local = svgPointFromEvent(evt);

    if (drag.kind === 'wave-range' && drag.waveEdge) {
      const proj = projectToEdges(local);
      const onSameEdge = proj.find((p) => p.edge === drag!.waveEdge)!;
      const u0 = drag.waveStartU!;
      const u1 = Math.max(0, Math.min(edgeLength(drag.waveEdge), onSameEdge.u));
      renderWaveGhost(drag.waveEdge, Math.min(u0, u1), Math.max(u0, u1));
      return;
    }

    const cut = store.cuts.find((c) => c.id === drag!.cutId);
    if (!cut) return;

    if (drag.kind === 'depth' && cut.kind === 'triangle' && cut.placement === 'edge') {
      const newDepth = computeSignedDepth(cut.edge!, cut.u!, local);
      store.updateCutLive(cut.id, { depth: Math.max(6, Math.min(90, newDepth)) } as Partial<Cut>);
      return;
    }
    if (drag.kind === 'width' && cut.kind === 'triangle' && cut.placement === 'edge') {
      const projU = projectToEdges(local).find((p) => p.edge === cut.edge)!.u;
      const halfWidth = Math.max(6, Math.abs(projU - cut.u!) );
      store.updateCutLive(cut.id, { width: halfWidth * 2 } as Partial<Cut>);
      return;
    }
    if (drag.kind === 'radius' && cut.kind === 'semicircle') {
      let radius: number;
      if (cut.placement === 'edge') {
        radius = computeSignedDepth(cut.edge!, cut.u!, local);
      } else {
        radius = Math.hypot(local.x - (cut.x ?? 0), local.y - (cut.y ?? 0));
      }
      store.updateCutLive(cut.id, { radius: Math.max(6, Math.min(70, radius)) } as Partial<Cut>);
      return;
    }
    if (drag.kind === 'scale' && cut.kind === 'triangle' && cut.placement === 'interior') {
      const size = Math.hypot(local.x - (cut.x ?? 0), local.y - (cut.y ?? 0)) * 1.6;
      store.updateCutLive(cut.id, { width: Math.max(12, Math.min(60, size)), depth: Math.max(12, Math.min(60, size)) } as Partial<Cut>);
      return;
    }
    if (drag.kind === 'range-start' && cut.kind === 'wave') {
      const projU = projectToEdges(local).find((p) => p.edge === cut.edge)!.u;
      store.updateCutLive(cut.id, { uStart: Math.max(0, Math.min(cut.uEnd - 15, projU)) } as Partial<Cut>);
      return;
    }
    if (drag.kind === 'range-end' && cut.kind === 'wave') {
      const projU = projectToEdges(local).find((p) => p.edge === cut.edge)!.u;
      store.updateCutLive(cut.id, { uEnd: Math.max(cut.uStart + 15, Math.min(edgeLength(cut.edge), projU)) } as Partial<Cut>);
    }
  });

  svg.addEventListener('pointerup', (evt) => {
    if (!drag) return;
    if (drag.kind === 'wave-range' && drag.waveEdge) {
      const local = svgPointFromEvent(evt);
      const proj = projectToEdges(local);
      const onSameEdge = proj.find((p) => p.edge === drag!.waveEdge)!;
      const u0 = drag.waveStartU!;
      const u1 = Math.max(0, Math.min(edgeLength(drag.waveEdge), onSameEdge.u));
      clearWaveGhost();
      if (Math.abs(u1 - u0) < 20) {
        showToast({ message: '波線はもう少し長くドラッグしてください', tone: 'error' });
        flashInvalid();
      } else {
        const cut: Cut = {
          id: nextId('wave'),
          kind: 'wave',
          placement: 'edge',
          edge: drag.waveEdge,
          uStart: Math.min(u0, u1),
          uEnd: Math.max(u0, u1),
          amplitude: store.toolSettings.waveAmplitude,
          count: store.toolSettings.waveCount,
        };
        const result = validatePlacement(cut, store.cuts);
        if (!result.ok) {
          showToast({ message: result.reason ?? '配置できません', tone: 'error' });
          flashInvalid();
        } else {
          store.addCut(cut);
        }
      }
    } else {
      store.commitLiveEdit(drag.before);
    }
    drag = null;
  });

  function computeSignedDepth(edge: EdgeId, u: number, local: Point): number {
    const origin = edgePointAt(edge, u);
    let normal: Point;
    if (edge === 'left') normal = { x: 0, y: 1 };
    else if (edge === 'right') normal = { x: RIGHT_DIR.y, y: -RIGHT_DIR.x };
    else {
      const theta = u / WEDGE_RADIUS;
      const tangent = { x: -Math.sin(theta), y: Math.cos(theta) };
      normal = { x: -tangent.y, y: tangent.x };
    }
    const dx = local.x - origin.x;
    const dy = local.y - origin.y;
    return dx * normal.x + dy * normal.y;
  }

  let waveGhost: SVGPathElement | null = null;
  function renderWaveGhost(edge: EdgeId, u0: number, u1: number) {
    if (!waveGhost) {
      waveGhost = svgEl('path', { class: 'wave-ghost' });
      wedgeGroup.append(waveGhost);
    }
    const p0 = edgePointAt(edge, u0);
    const p1 = edgePointAt(edge, u1);
    waveGhost.setAttribute('d', `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`);
  }
  function clearWaveGhost() {
    waveGhost?.remove();
    waveGhost = null;
  }

  function render() {
    paperPath.setAttribute('d', wedgePathD(store.cuts));
    emptyLabel.style.display = store.cuts.length === 0 ? '' : 'none';

    handleLayer.replaceChildren();
    hitLayer.replaceChildren();

    for (const cut of store.cuts) {
      const hp = cutHitPoint(cut);
      const hit = svgEl('circle', {
        cx: String(hp.x),
        cy: String(hp.y),
        r: String(cutHitRadius(cut)),
        class: `cut-hit ${cut.id === store.selectedId ? 'cut-hit--selected' : ''}`,
      });
      hit.dataset.hitCutId = cut.id;
      hitLayer.append(hit);
    }

    const selected = store.selectedCut;
    if (selected) {
      renderHandlesFor(selected);
    }
  }

  function renderHandlesFor(cut: Cut) {
    const addHandle = (p: Point, kind: DragKind, extraClass = '') => {
      const h = svgEl('circle', { cx: String(p.x), cy: String(p.y), r: '6.5', class: `handle ${extraClass}` });
      h.dataset.handle = kind;
      h.dataset.cutId = cut.id;
      handleLayer.append(h);
    };

    if (cut.kind === 'triangle' && cut.placement === 'edge' && cut.edge && cut.u !== undefined) {
      const tip = localToGlobalDepth(cut.edge, cut.u, cut.depth);
      const shoulder = edgePointAt(cut.edge, cut.u + cut.width / 2);
      addHandle(tip, 'depth', 'handle--depth');
      addHandle(shoulder, 'width', 'handle--width');
    } else if (cut.kind === 'triangle' && cut.placement === 'interior') {
      const cx = cut.x ?? 0;
      const cy = cut.y ?? 0;
      const r = cut.width / Math.sqrt(3);
      addHandle({ x: cx + r * 1.2, y: cy }, 'scale', 'handle--scale');
    } else if (cut.kind === 'semicircle' && cut.placement === 'edge' && cut.edge && cut.u !== undefined) {
      const tip = localToGlobalDepth(cut.edge, cut.u, cut.radius);
      addHandle(tip, 'radius', 'handle--radius');
    } else if (cut.kind === 'semicircle' && cut.placement === 'interior') {
      const cx = cut.x ?? 0;
      const cy = cut.y ?? 0;
      addHandle({ x: cx + cut.radius, y: cy }, 'radius', 'handle--radius');
    } else if (cut.kind === 'wave') {
      addHandle(edgePointAt(cut.edge, cut.uStart), 'range-start', 'handle--range');
      addHandle(edgePointAt(cut.edge, cut.uEnd), 'range-end', 'handle--range');
    }
  }

  function localToGlobalDepth(edge: EdgeId, u: number, depth: number): Point {
    const origin = edgePointAt(edge, u);
    let normal: Point;
    if (edge === 'left') normal = { x: 0, y: 1 };
    else if (edge === 'right') normal = { x: RIGHT_DIR.y, y: -RIGHT_DIR.x };
    else {
      const theta = u / WEDGE_RADIUS;
      const tangent = { x: -Math.sin(theta), y: Math.cos(theta) };
      normal = { x: -tangent.y, y: tangent.x };
    }
    return { x: origin.x + normal.x * depth, y: origin.y + normal.y * depth };
  }

  store.subscribe(render);
  render();

  return { flashInvalid };
}
