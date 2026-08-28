import { useId, useMemo, type ReactNode } from 'react';
import { categoryByName } from '../../data/categories';
import type { Article, CategoryIcon } from '../../data/types';
import { createSeededRandom, type SeededRandom } from '../../lib/seed';
import './article-image.css';

/**
 * Article artwork, drawn rather than fetched.
 *
 * SPEC FR-02 forbids runtime image fetching, and flat gradients would read as
 * filler. Each article instead gets a small engraved scene, composed from its
 * category motif and jittered by a hash of its id, then knocked back through a
 * halftone screen so it prints like newspaper photography.
 */

/** A single warm ink ramp — a newspaper is printed with one ink, not eight. */
const INK = {
  t0: '#f2ebdc',
  t1: '#ded1b7',
  t2: '#bcaa88',
  t3: '#8d7d5f',
  t4: '#574c39',
  t5: '#2c261e',
} as const;

const VIEW_W = 400;
const VIEW_H = 300;

type Motif = (r: SeededRandom) => ReactNode;

/* ------------------------------------------------------------------ motifs */

/** ライフスタイル — a window, a table edge, a cup catching the light. */
const cupMotif: Motif = (r) => {
  const winX = r.range(196, 226);
  const cupX = r.range(96, 126);
  const tableY = r.range(206, 222);
  return (
    <>
      <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={INK.t1} />
      <rect x={winX} y="26" width={VIEW_W - winX - 24} height="164" fill={INK.t0} />
      <rect
        x={winX}
        y="26"
        width={VIEW_W - winX - 24}
        height="164"
        fill="none"
        stroke={INK.t4}
        strokeWidth="5"
      />
      <line
        x1={winX + (VIEW_W - winX - 24) / 2}
        y1="26"
        x2={winX + (VIEW_W - winX - 24) / 2}
        y2="190"
        stroke={INK.t4}
        strokeWidth="4"
      />
      <line x1={winX} y1="104" x2={VIEW_W - 24} y2="104" stroke={INK.t4} strokeWidth="4" />
      <path
        d={`M${winX + 12} 190 L${winX + 44} 128 L${winX + 82} 190 Z`}
        fill={INK.t2}
        opacity="0.8"
      />
      <rect x="0" y={tableY} width={VIEW_W} height={VIEW_H - tableY} fill={INK.t4} />
      <rect x="0" y={tableY} width={VIEW_W} height="5" fill={INK.t5} />
      <ellipse cx={cupX} cy={tableY - 4} rx="46" ry="9" fill={INK.t5} opacity="0.35" />
      <path
        d={`M${cupX - 30} ${tableY - 46} h60 v22 a30 26 0 0 1 -60 0 Z`}
        fill={INK.t0}
        stroke={INK.t5}
        strokeWidth="3"
      />
      <path
        d={`M${cupX + 30} ${tableY - 40} a14 13 0 0 1 0 20`}
        fill="none"
        stroke={INK.t5}
        strokeWidth="3"
      />
      <ellipse cx={cupX} cy={tableY - 46} rx="30" ry="8" fill={INK.t3} stroke={INK.t5} strokeWidth="3" />
      <path
        d={`M${cupX - 10} ${tableY - 62} q8 -12 0 -22 M${cupX + 10} ${tableY - 60} q8 -12 0 -20`}
        fill="none"
        stroke={INK.t0}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.85"
      />
      <rect x={cupX - 66} y={tableY - 20} width="52" height="8" fill={INK.t5} opacity="0.5" />
    </>
  );
};

/** エッセイ — an open spread, ruled lines, a pen laid across it. */
const nibMotif: Motif = (r) => {
  const tilt = r.range(-4, 4);
  const penY = r.range(196, 214);
  const lines = r.int(5, 7);
  return (
    <>
      <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={INK.t3} />
      <g transform={`rotate(${tilt} 200 150)`}>
        <rect x="34" y="42" width="332" height="216" fill={INK.t0} />
        <rect x="34" y="42" width="332" height="216" fill="none" stroke={INK.t5} strokeWidth="3" />
        <line x1="200" y1="42" x2="200" y2="258" stroke={INK.t2} strokeWidth="3" />
        {Array.from({ length: lines }, (_, i) => (
          <line
            key={`l-${i}`}
            x1="52"
            y1={74 + i * 22}
            x2={182 - (i % 3) * 26}
            y2={74 + i * 22}
            stroke={INK.t2}
            strokeWidth="4"
          />
        ))}
        {Array.from({ length: lines - 1 }, (_, i) => (
          <line
            key={`r-${i}`}
            x1="218"
            y1={74 + i * 22}
            x2={348 - ((i + 1) % 3) * 34}
            y2={74 + i * 22}
            stroke={INK.t2}
            strokeWidth="4"
          />
        ))}
      </g>
      <g transform={`rotate(${-14 + tilt} 200 ${penY})`}>
        <rect x="118" y={penY} width="176" height="11" fill={INK.t5} />
        <path d={`M118 ${penY} l-30 5.5 l30 5.5 Z`} fill={INK.t4} />
        <rect x="284" y={penY - 1} width="26" height="13" fill={INK.t2} />
      </g>
    </>
  );
};

/** 仕事術 — a desk seen from above: planner, clip, pen, coffee ring. */
const caseMotif: Motif = (r) => {
  const ringX = r.range(300, 330);
  const clipY = r.range(70, 96);
  const rows = r.int(4, 6);
  return (
    <>
      <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={INK.t4} />
      <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={INK.t3} opacity="0.5" />
      <rect x="40" y="36" width="212" height="240" fill={INK.t0} />
      <rect x="40" y="36" width="212" height="240" fill="none" stroke={INK.t5} strokeWidth="3" />
      <rect x="40" y="36" width="212" height="26" fill={INK.t5} />
      {Array.from({ length: rows }, (_, i) => (
        <g key={i}>
          <rect x="58" y={84 + i * 32} width="12" height="12" fill="none" stroke={INK.t3} strokeWidth="3" />
          <line
            x1="82"
            y1={90 + i * 32}
            x2={232 - (i % 3) * 30}
            y2={90 + i * 32}
            stroke={INK.t2}
            strokeWidth="4"
          />
        </g>
      ))}
      <rect x="262" y={clipY} width="14" height="52" rx="7" fill={INK.t5} />
      <rect x="266" y={clipY + 8} width="6" height="36" fill={INK.t3} />
      <g transform="rotate(24 320 210)">
        <rect x="286" y="204" width="128" height="10" fill={INK.t5} />
        <path d="M286 204 l-22 5 l22 5 Z" fill={INK.t2} />
      </g>
      <circle cx={ringX} cy="82" r="30" fill="none" stroke={INK.t5} strokeWidth="5" opacity="0.55" />
      <circle cx={ringX} cy="82" r="22" fill="none" stroke={INK.t5} strokeWidth="2" opacity="0.35" />
    </>
  );
};

/** フード — a plate from above, cutlery flanking it. */
const plateMotif: Motif = (r) => {
  const cx = r.range(178, 206);
  const bits = r.int(3, 5);
  return (
    <>
      <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={INK.t4} />
      <rect x="0" y="0" width={VIEW_W} height="86" fill={INK.t3} />
      <line x1="0" y1="86" x2={VIEW_W} y2="86" stroke={INK.t5} strokeWidth="4" />
      <ellipse cx={cx} cy="168" rx="112" ry="98" fill={INK.t5} opacity="0.3" />
      <ellipse cx={cx} cy="160" rx="112" ry="98" fill={INK.t0} stroke={INK.t5} strokeWidth="4" />
      <ellipse cx={cx} cy="160" rx="86" ry="74" fill="none" stroke={INK.t2} strokeWidth="3" />
      {Array.from({ length: bits }, (_, i) => {
        const angle = (i / bits) * Math.PI * 2 + 0.4;
        return (
          <ellipse
            key={i}
            cx={cx + Math.cos(angle) * 40}
            cy={160 + Math.sin(angle) * 32}
            rx={20 - i * 2}
            ry={15 - i}
            fill={i % 2 === 0 ? INK.t3 : INK.t2}
          />
        );
      })}
      <ellipse cx={cx} cy="160" rx="26" ry="22" fill={INK.t4} />
      <g>
        <rect x={cx - 152} y="106" width="9" height="110" fill={INK.t5} />
        <rect x={cx - 158} y="96" width="6" height="30" fill={INK.t5} />
        <rect x={cx - 148} y="96" width="6" height="30" fill={INK.t5} />
        <rect x={cx - 138} y="96" width="6" height="30" fill={INK.t5} />
      </g>
      <g>
        <rect x={cx + 142} y="106" width="9" height="110" fill={INK.t5} />
        <ellipse cx={cx + 146} cy="106" rx="15" ry="24" fill={INK.t5} />
      </g>
    </>
  );
};

/** 旅 — layered ridges with a road running out of frame. */
const mountainMotif: Motif = (r) => {
  const sunX = r.range(96, 306);
  const peak = r.range(96, 132);
  const shift = r.range(-30, 30);
  return (
    <>
      <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={INK.t0} />
      <rect x="0" y="0" width={VIEW_W} height="150" fill={INK.t1} />
      <circle cx={sunX} cy="64" r="32" fill={INK.t2} />
      <circle cx={sunX} cy="64" r="32" fill="none" stroke={INK.t4} strokeWidth="3" />
      <path
        d={`M-10 190 L${110 + shift} ${peak} L${210 + shift} 190 Z`}
        fill={INK.t3}
      />
      <path
        d={`M${140 + shift} 190 L${268 + shift} ${peak - 18} L${410} 190 Z`}
        fill={INK.t4}
      />
      <rect x="0" y="188" width={VIEW_W} height="4" fill={INK.t5} />
      <rect x="0" y="192" width={VIEW_W} height={VIEW_H - 192} fill={INK.t2} />
      <path
        d={`M${170 + shift * 0.4} 192 L${120 + shift * 0.4} ${VIEW_H} L${268 + shift * 0.4} ${VIEW_H} L${212 + shift * 0.4} 192 Z`}
        fill={INK.t0}
      />
      <path
        d={`M${170 + shift * 0.4} 192 L${120 + shift * 0.4} ${VIEW_H} M${212 + shift * 0.4} 192 L${268 + shift * 0.4} ${VIEW_H}`}
        stroke={INK.t5}
        strokeWidth="3"
        fill="none"
      />
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={182 + shift * 0.4 - i * 2}
          y={210 + i * 30}
          width={14 + i * 4}
          height="8"
          fill={INK.t3}
        />
      ))}
      <path
        d={`M40 ${68} q10 -8 20 0 M64 ${58} q10 -8 20 0`}
        fill="none"
        stroke={INK.t4}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </>
  );
};

/** 暮らし — a shelf, pots, a leaf reaching into frame. */
const houseMotif: Motif = (r) => {
  const shelfY = r.range(164, 182);
  const pots = r.int(3, 4);
  return (
    <>
      <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={INK.t1} />
      <rect x="248" y="24" width="128" height="150" fill={INK.t0} stroke={INK.t4} strokeWidth="4" />
      <line x1="312" y1="24" x2="312" y2="174" stroke={INK.t4} strokeWidth="3" />
      <rect x="0" y={shelfY} width={VIEW_W} height="14" fill={INK.t4} />
      <rect x="0" y={shelfY + 14} width={VIEW_W} height="6" fill={INK.t5} />
      {Array.from({ length: pots }, (_, i) => {
        const x = 44 + i * 74;
        const h = 40 + ((i * 13) % 22);
        return (
          <g key={i}>
            <path
              d={`M${x} ${shelfY - h} h48 l-7 ${h} h-34 Z`}
              fill={i % 2 === 0 ? INK.t3 : INK.t2}
              stroke={INK.t5}
              strokeWidth="3"
            />
            <path
              d={`M${x + 24} ${shelfY - h} q-4 -30 -26 -40 M${x + 24} ${shelfY - h} q6 -26 28 -34`}
              fill="none"
              stroke={INK.t5}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <ellipse cx={x - 2} cy={shelfY - h - 40} rx="14" ry="8" fill={INK.t4} />
            <ellipse cx={x + 52} cy={shelfY - h - 34} rx="13" ry="8" fill={INK.t3} />
          </g>
        );
      })}
      <rect x="0" y={shelfY + 20} width={VIEW_W} height={VIEW_H - shelfY - 20} fill={INK.t2} />
      <rect x="34" y={shelfY + 44} width="118" height="8" fill={INK.t3} />
      <rect x="34" y={shelfY + 66} width="76" height="8" fill={INK.t3} />
    </>
  );
};

/** カルチャー — a bookshelf, spines of uneven height. */
const bookMotif: Motif = (r) => {
  const rowY = [40, 130, 220];
  const jitter = r.int(0, 5);
  return (
    <>
      <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={INK.t5} />
      {rowY.map((y, row) => (
        <g key={y}>
          <rect x="18" y={y + 62} width={VIEW_W - 36} height="10" fill={INK.t4} />
          {Array.from({ length: 11 }, (_, i) => {
            const seedish = (i * 7 + row * 5 + jitter) % 6;
            const w = 18 + seedish * 4;
            const h = 44 + ((i * 11 + row * 3) % 18);
            const x = 24 + i * 32 + (seedish % 2);
            const fill = [INK.t0, INK.t1, INK.t2, INK.t3][(i + row) % 4];
            if (x + w > VIEW_W - 24) return null;
            return (
              <g key={i}>
                <rect x={x} y={y + 62 - h} width={w} height={h} fill={fill} />
                <rect x={x} y={y + 62 - h} width={w} height={h} fill="none" stroke={INK.t5} strokeWidth="2" />
                <rect x={x + 3} y={y + 62 - h + 10} width={w - 6} height="4" fill={INK.t5} opacity="0.45" />
                <rect x={x + 3} y={y + 62 - h + 20} width={w - 6} height="3" fill={INK.t5} opacity="0.3" />
              </g>
            );
          })}
        </g>
      ))}
    </>
  );
};

/** その他 — press registration marks and overlapping plates. */
const asteriskMotif: Motif = (r) => {
  const cx = r.range(168, 232);
  const cy = r.range(132, 168);
  const rot = r.range(0, 60);
  return (
    <>
      <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={INK.t1} />
      <circle cx={cx - 44} cy={cy} r="72" fill={INK.t3} opacity="0.8" />
      <circle cx={cx + 44} cy={cy} r="72" fill={INK.t4} opacity="0.72" />
      <circle cx={cx} cy={cy - 52} r="72" fill={INK.t2} opacity="0.6" />
      <g transform={`rotate(${rot} ${cx} ${cy})`}>
        {Array.from({ length: 6 }, (_, i) => (
          <rect
            key={i}
            x={cx - 3}
            y={cy - 88}
            width="6"
            height="176"
            fill={INK.t5}
            opacity="0.55"
            transform={`rotate(${i * 30} ${cx} ${cy})`}
          />
        ))}
      </g>
      <circle cx={cx} cy={cy} r="20" fill={INK.t0} stroke={INK.t5} strokeWidth="3" />
      {[
        [30, 34],
        [370, 34],
        [30, 266],
        [370, 266],
      ].map(([mx, my]) => (
        <g key={`${mx}-${my}`} stroke={INK.t5} strokeWidth="2.5">
          <line x1={mx - 12} y1={my} x2={mx + 12} y2={my} />
          <line x1={mx} y1={my - 12} x2={mx} y2={my + 12} />
          <circle cx={mx} cy={my} r="7" fill="none" />
        </g>
      ))}
    </>
  );
};

const MOTIFS: Record<CategoryIcon, Motif> = {
  cup: cupMotif,
  nib: nibMotif,
  case: caseMotif,
  plate: plateMotif,
  mountain: mountainMotif,
  house: houseMotif,
  book: bookMotif,
  asterisk: asteriskMotif,
};

/* --------------------------------------------------------------- component */

interface ArticleImageProps {
  readonly article: Article;
  /** Extra class for sizing/framing by the caller. */
  readonly className?: string;
}

export function ArticleImage({ article, className }: ArticleImageProps) {
  const uid = useId().replace(/:/g, '');
  const screenId = `screen-${uid}`;
  const fadeId = `fade-${uid}`;

  const icon = categoryByName(article.category).icon;

  const scene = useMemo(() => {
    const random = createSeededRandom(article.id);
    return MOTIFS[icon](random);
  }, [article.id, icon]);

  return (
    <svg
      className={className ? `article-image ${className}` : 'article-image'}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`${article.category}のコラム「${article.title}」の挿絵`}
    >
      <defs>
        {/* Halftone screen: the dot grid that makes it read as newsprint. */}
        <pattern id={screenId} width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="1.4" cy="1.4" r="1.25" fill={INK.t5} />
        </pattern>
        <linearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={INK.t5} stopOpacity="0" />
          <stop offset="100%" stopColor={INK.t5} stopOpacity="0.28" />
        </linearGradient>
      </defs>

      {scene}

      <rect
        x="0"
        y="0"
        width={VIEW_W}
        height={VIEW_H}
        fill={`url(#${screenId})`}
        opacity="0.22"
      />
      <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={`url(#${fadeId})`} />
    </svg>
  );
}
