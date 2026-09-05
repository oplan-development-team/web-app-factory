import { el } from './dom';
import { buildSeal } from './seal';
import { openGpsModal } from './gps-modal';
import { documentNumber, issueDateJa, receiptNumber, seededFrom, formatBytes } from './format';
import type { MetaField, ParsedMeta, RiskLevel } from './meta';
import { stripMetadata } from './strip';
import { analyzeFile } from './meta';
import { exportDecisionPng } from './export-png';

export interface DocumentViewCallbacks {
  onReset: () => void;
}

const RISK_LABEL: Record<RiskLevel, string> = { high: '高', medium: '中', low: '低' };
const RISK_NOTE: Record<RiskLevel, string> = {
  high: '撮影地点(GPS)を含む、個人の生活圏を特定しうる情報が検出されました。SNS等への投稿前に抹消を強く推奨します。',
  medium: '端末や個人を特定しうる付随情報が検出されました。共有範囲によっては抹消を推奨します。',
  low: '個人特定リスクの高い項目は検出されませんでした。念のため内容をご確認ください。',
};

export function renderDocumentScreen(file: File, meta: ParsedMeta, cb: DocumentViewCallbacks): HTMLElement {
  const seed = seededFrom(file.name, file.size);
  const docNo = documentNumber(seed);
  const receiptNo = receiptNumber(seed);
  const issueDate = issueDateJa();

  let sensitiveIndex = 0;

  const root = el('div', { className: 'stage' });

  const dossierBody = el('div', { className: 'dossier__body' });
  if (!meta.hasAnyData) {
    dossierBody.appendChild(
      el('div', { className: 'empty-state' }, [
        el('div', { className: 'empty-state__stamp' }, ['該当なし']),
        el('p', { className: 'empty-state__title' }, ['開示すべき情報はありません']),
        el('p', { className: 'empty-state__body' }, [
          'この画像ファイルからは、個人・端末を特定しうる付随情報（EXIF/GPS）が検出されませんでした。すでに整理済みの画像である可能性があります。',
        ]),
      ]),
    );
  } else {
    dossierBody.appendChild(buildTableHead());
    for (const field of meta.fields) {
      const idx = field.cls === 'sensitive' ? sensitiveIndex++ : -1;
      dossierBody.appendChild(buildFieldRow(field, idx));
    }
  }

  const riskStamp = el('div', { className: `risk-stamp risk-stamp--${meta.risk}` }, [
    el('span', { className: 'risk-stamp__label' }, ['特定リスク']),
    el('span', { className: 'risk-stamp__level' }, [RISK_LABEL[meta.risk]]),
  ]);

  const purgeBtn = el(
    'button',
    { type: 'button', className: 'btn btn-primary', id: 'purge-btn' },
    [downloadIcon(), ' 証拠品からメタデータを抹消して排出'],
  );
  const exportBtn = el(
    'button',
    { type: 'button', className: 'btn btn-outline', id: 'export-btn' },
    [' 開示決定書をPNGで出力'],
  );

  // Both actions require the analysis to have resolved before they mean
  // anything; `meta` is only ever handed to this view once that's true, but
  // we still gate on hasAnyData vs. an explicit "no data" acknowledgement
  // to avoid a button that quietly does nothing.
  purgeBtn.disabled = false;
  exportBtn.disabled = false;

  const resultPanel = el('div', { className: 'purge-result', hidden: true });

  purgeBtn.addEventListener('click', async () => {
    purgeBtn.disabled = true;
    purgeBtn.textContent = '';
    purgeBtn.append(spinnerIcon(), ' 抹消処理中…');
    try {
      const stripped = await stripMetadata(file);
      if (!stripped) throw new Error('unsupported');
      const verify = await analyzeFile(new File([stripped.blob], file.name, { type: stripped.blob.type }));
      const url = URL.createObjectURL(stripped.blob);
      const cleanName = suffixFilename(file.name);
      const a = el('a', { href: url, download: cleanName, className: 'btn btn-primary', id: 'redownload-btn' }, [
        downloadIcon(),
        ` ${cleanName} を再ダウンロード`,
      ]);

      resultPanel.hidden = false;
      resultPanel.replaceChildren(
        el('div', { className: 'purge-result__stamp' }, ['排出済み']),
        el('h3', {}, ['証拠品の抹消処理が完了しました']),
        el('p', { className: 'purge-result__verify' }, [
          verify.hasAnyData
            ? `再検証の結果、${verify.fields.length}件の項目が残存しています（向き情報等の非個人特定情報のみの可能性があります）。`
            : '再検証の結果 — 検出項目 0件（開示対象なし）。',
        ]),
        el('p', { className: 'purge-result__file' }, [`${cleanName}（${formatBytes(stripped.blob.size)}）`]),
        a,
        el('button', { type: 'button', className: 'btn btn-ghost', onClick: cb.onReset }, [
          '別の写真を処理する（最初からやり直す）',
        ]),
      );

      // Auto-trigger the download once, then let the visible link serve as
      // the "I missed it, get it again" affordance.
      a.click();

      document.getElementById('dossier-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

      purgeBtn.textContent = '';
      purgeBtn.append(checkIcon(), ' 抹消・排出済み');
    } catch {
      purgeBtn.disabled = false;
      purgeBtn.textContent = '';
      purgeBtn.append(downloadIcon(), ' 証拠品からメタデータを抹消して排出');
      resultPanel.hidden = false;
      resultPanel.replaceChildren(
        el('div', { className: 'purge-result__stamp purge-result__stamp--error' }, ['処理失敗']),
        el('p', {}, ['抹消処理中にエラーが発生しました。ファイル形式が破損している可能性があります。']),
      );
    }
  });

  exportBtn.addEventListener('click', async () => {
    exportBtn.disabled = true;
    try {
      await exportDecisionPng({ file, meta, docNo, receiptNo, issueDate });
    } finally {
      exportBtn.disabled = false;
    }
  });

  const doc = el('div', { className: 'document', 'data-risk': meta.risk }, [
    el('div', { className: 'document__inner' }, [
      el('header', { className: 'masthead' }, [
        el('div', { className: 'masthead__text' }, [
          el('p', { className: 'masthead__dept' }, ['内閣府　情報公開・個人情報保護室　写真解析第三課']),
          el('h1', { className: 'masthead__title' }, ['個人情報開示リスク判定書']),
          el('p', { className: 'masthead__subtitle' }, ['PHOTOGRAPH METADATA DISCLOSURE RISK NOTICE']),
        ]),
        el('div', { className: 'masthead__seal' }, [buildSeal()]),
      ]),
      el('div', { className: 'meta-row' }, [
        metaItem('文書番号', docNo),
        metaItem('発行日', issueDate),
        metaItem('対象物件', `${truncate(file.name, 28)}（${formatBytes(file.size)}）`),
      ]),
      el('div', { className: 'risk-row' }, [riskStamp, el('p', { className: 'risk-note' }, [RISK_NOTE[meta.risk]])]),
      el('section', { className: 'dossier', id: 'dossier-section', 'aria-label': '検出項目一覧' }, [
        el('h2', { className: 'dossier__title' }, ['別紙　検出項目目録']),
        dossierBody,
      ]),
      el('section', { className: 'actions' }, [
        el('div', { className: 'actions__buttons' }, [purgeBtn, exportBtn]),
        el('p', { className: 'privacy-note' }, [
          '※本処理はすべて端末（ブラウザ）内で完結し、画像自体は外部に送信されません。撮影地点プレビュー時のみ、地図タイル画像を外部（OpenStreetMap）から取得します。',
        ]),
      ]),
      el('footer', { className: 'doc-footer' }, [
        el('span', { className: 'mono' }, [`受付番号 ${receiptNo}`]),
        el('span', { className: 'mono' }, ['1／1　頁']),
      ]),
    ]),
  ]);

  root.appendChild(doc);
  root.appendChild(resultPanel);
  return root;

  function buildFieldRow(field: MetaField, sensitiveIdx: number): HTMLElement {
    const delay = `${sensitiveIdx * 150}ms`;
    if (field.cls === 'benign') {
      return el('div', { className: 'field-row field-row--benign' }, [
        el('div', { className: 'field-row__label' }, [field.label]),
        el('div', { className: 'field-row__value' }, [
          el('span', { className: 'mono benign-value' }, [field.value]),
          el('span', { className: 'badge badge--ok' }, ['非該当・開示']),
        ]),
      ]);
    }

    const redactBar = el('span', { className: 'redact-bar', style: `animation-delay: calc(${delay} + 300ms);` });
    const flashText = el('span', { className: 'flash-text mono', style: `animation-delay: ${delay};` }, [
      field.value,
    ]);
    const redactCell = el('span', { className: 'redact-cell' }, [flashText, redactBar]);

    const valueChildren: (Node | string)[] = [
      redactCell,
      el('span', { className: 'badge badge--sealed' }, ['黒塗り']),
    ];

    const row = el('div', { className: 'field-row field-row--sensitive' }, [
      el('div', { className: 'field-row__label' }, [field.label]),
      el('div', { className: 'field-row__value' }, valueChildren),
    ]);

    if (field.isGps && field.gps) {
      const gps = field.gps;
      const revealBtn = el('button', { type: 'button', className: 'btn btn-reveal' }, [
        '撮影地点情報を表示する（1回限り）',
      ]);
      revealBtn.addEventListener('click', () => {
        revealBtn.disabled = true;
        openGpsModal(gps.lat, gps.lon, () => {
          revealBtn.textContent = '封印済み（再表示不可）';
          revealBtn.classList.add('btn-reveal--sealed');
          row.classList.add('field-row--gps-sealed');
        });
      });
      row.appendChild(el('div', { className: 'field-row__gps-action' }, [revealBtn]));
    }

    return row;
  }
}

function buildTableHead(): HTMLElement {
  return el('div', { className: 'field-row field-row--head', 'aria-hidden': 'true' }, [
    el('div', { className: 'field-row__label' }, ['項目']),
    el('div', { className: 'field-row__value' }, ['内容 / 区分']),
  ]);
}

function metaItem(label: string, value: string): HTMLElement {
  return el('div', { className: 'meta-item' }, [
    el('span', { className: 'meta-label' }, [label]),
    el('span', { className: 'meta-value mono' }, [value]),
  ]);
}

function truncate(name: string, max: number): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function suffixFilename(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return `${name}_redacted`;
  return `${name.slice(0, dot)}_redacted${name.slice(dot)}`;
}

function downloadIcon(): SVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon-download');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute(
    'd',
    'M10 2.5v9.2m0 0 3.4-3.6M10 11.7 6.6 8.1M4 14.5v1.8a1.2 1.2 0 0 0 1.2 1.2h9.6a1.2 1.2 0 0 0 1.2-1.2v-1.8',
  );
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.6');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);
  return svg;
}

function checkIcon(): SVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M4 10.5l3.6 3.6L16 5.5');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);
  return svg;
}

function spinnerIcon(): SVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('class', 'icon-spinner');
  svg.setAttribute('aria-hidden', 'true');
  const circle = document.createElementNS(NS, 'circle');
  circle.setAttribute('cx', '10');
  circle.setAttribute('cy', '10');
  circle.setAttribute('r', '7.5');
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke', 'currentColor');
  circle.setAttribute('stroke-width', '2.2');
  circle.setAttribute('stroke-dasharray', '28 40');
  svg.appendChild(circle);
  return svg;
}
