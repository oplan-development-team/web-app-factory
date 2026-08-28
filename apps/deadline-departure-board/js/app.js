import { createFlapCluster, createStaticLabel } from './flapCluster.js';
import { getStatus, formatRemaining, formatDue, DEPARTED_LINGER_MS } from './status.js';
import { loadDeadlines, saveDeadlines, generateId } from './storage.js';

const TITLE_LENGTH = 16;
const STATUS_LENGTH = 10;
const TICK_INTERVAL_MS = 20 * 1000; // spec requires "at least every 1 minute"; we check more often for snappier UX
const CLOCK_CHECK_MS = 1000;
const EMPTY_TEXT = 'NO FLIGHTS SCHEDULED';

// Title glyphs the split-flap set actually supports: A-Z, 0-9, space, and a
// handful of punctuation marks common on real departure boards.
const ALLOWED_TITLE_CHARS = /[^A-Z0-9 \-.,/&!?:'#+()]/g;

const boardRowsEl = document.getElementById('boardRows');
const emptyStateEl = document.getElementById('emptyState');
const emptyFlapsEl = document.getElementById('emptyFlaps');
const clockFlapsEl = document.getElementById('clockFlaps');
const addForm = document.getElementById('addForm');
const titleInput = document.getElementById('titleInput');
const dateInput = document.getElementById('dateInput');
const timeInput = document.getElementById('timeInput');
const formError = document.getElementById('formError');

let deadlines = loadDeadlines();
const rowInstances = new Map(); // id -> row controller
const departureTimers = new Map(); // id -> timeout handle
let lastClockLabel = null;

function normalizeTitle(raw) {
  const upper = (raw || '').toUpperCase();
  const cleaned = upper.replace(ALLOWED_TITLE_CHARS, ' ').slice(0, TITLE_LENGTH);
  return cleaned.trim() ? cleaned : '';
}

function computeRowData(deadline, now) {
  const due = new Date(deadline.dueISO);
  const msRemaining = due.getTime() - now.getTime();
  return {
    title: deadline.title,
    remaining: formatRemaining(msRemaining),
    due: formatDue(due),
    status: getStatus(msRemaining),
    msRemaining,
  };
}

function sortDeadlines(list) {
  return [...list].sort((a, b) => new Date(a.dueISO) - new Date(b.dueISO));
}

// ---------------------------------------------------------------------------
// Row construction
// ---------------------------------------------------------------------------

function createRow(deadline) {
  const row = document.createElement('div');
  row.className = 'board-row';
  row.dataset.id = deadline.id;

  // Line 1: rank badge + title. Always its own full-width line so a long
  // title never has to squeeze against the data columns below it.
  const lineHead = document.createElement('div');
  lineHead.className = 'row-line row-line--head';

  const rank = document.createElement('div');
  rank.className = 'row-rank';

  const titleCluster = createFlapCluster(TITLE_LENGTH, 'cluster-title');

  lineHead.append(rank, titleCluster.el);

  // Line 2: remaining / due / status / delete. These wrap as whole blocks
  // (never mid-cluster) when the viewport is too narrow to fit them all.
  const lineMeta = document.createElement('div');
  lineMeta.className = 'row-line row-line--meta';

  const remainGroup = document.createElement('div');
  remainGroup.className = 'cluster-remain-group';
  const daysCluster = createFlapCluster(3);
  const hoursCluster = createFlapCluster(2);
  remainGroup.append(daysCluster.el, createStaticLabel('D'), hoursCluster.el, createStaticLabel('H'));

  const dueGroup = document.createElement('div');
  dueGroup.className = 'cluster-due-group';
  const dayCluster = createFlapCluster(2);
  const monCluster = createFlapCluster(3);
  const hourCluster = createFlapCluster(2);
  const minCluster = createFlapCluster(2);
  dueGroup.append(
    dayCluster.el,
    createStaticLabel('/', 'cluster-static-sep'),
    monCluster.el,
    createStaticLabel(' ', 'cluster-static-sep'),
    hourCluster.el,
    createStaticLabel(':', 'cluster-static-sep'),
    minCluster.el
  );

  const statusGroup = document.createElement('div');
  statusGroup.className = 'cluster-status-group';
  const statusDot = document.createElement('span');
  statusDot.className = 'status-dot';
  statusDot.setAttribute('aria-hidden', 'true');
  const statusCluster = createFlapCluster(STATUS_LENGTH);
  statusGroup.append(statusDot, statusCluster.el);

  const srSummary = document.createElement('span');
  srSummary.className = 'visually-hidden';

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'row-delete';
  deleteBtn.textContent = '×';
  deleteBtn.setAttribute('aria-label', `${deadline.title.trim() || 'この締切'} を削除`);

  lineMeta.append(remainGroup, dueGroup, statusGroup, deleteBtn);

  row.append(lineHead, lineMeta, srSummary);

  function update(data, opts = {}) {
    const { animate = true, rankIndex } = opts;
    if (rankIndex != null) rank.textContent = String(rankIndex).padStart(3, '0');

    titleCluster.setText(data.title, animate);
    daysCluster.setText(String(data.remaining.days).padStart(3, '0'), animate);
    hoursCluster.setText(String(data.remaining.hours).padStart(2, '0'), animate);
    dayCluster.setText(data.due.day, animate);
    monCluster.setText(data.due.month, animate);
    hourCluster.setText(data.due.hh, animate);
    minCluster.setText(data.due.mm, animate);
    statusCluster.setText(data.status.label, animate);

    row.classList.remove('status-scheduled', 'status-boarding', 'status-final', 'status-departed');
    row.classList.add(`status-${data.status.code}`);

    srSummary.textContent =
      `${data.title.trim()}。残り ${data.remaining.days} 日 ${data.remaining.hours} 時間。` +
      `締切 ${data.due.month} ${data.due.day} ${data.due.hh}:${data.due.mm}。` +
      `ステータス ${data.status.label}。`;
  }

  function blankOut(callback) {
    titleCluster.setText('', true);
    daysCluster.setText('', true);
    hoursCluster.setText('', true);
    dayCluster.setText('', true);
    monCluster.setText('', true);
    hourCluster.setText('', true);
    minCluster.setText('', true);
    statusCluster.setText('', true);
    setTimeout(callback, 700);
  }

  return {
    el: row,
    id: deadline.id,
    update,
    blankOut,
    onDelete(fn) {
      deleteBtn.addEventListener('click', fn);
    },
  };
}

// ---------------------------------------------------------------------------
// Rendering / lifecycle
// ---------------------------------------------------------------------------

function toggleEmptyState(isEmpty) {
  emptyStateEl.classList.toggle('is-visible', isEmpty);
}

function scheduleDepartureIfNeeded(deadline, data) {
  if (data.status.code !== 'departed') return;
  if (departureTimers.has(deadline.id)) return;
  const handle = setTimeout(() => {
    departureTimers.delete(deadline.id);
    removeDeadline(deadline.id, { flapOut: true });
  }, DEPARTED_LINGER_MS);
  departureTimers.set(deadline.id, handle);
}

function removeDeadline(id, opts = {}) {
  deadlines = deadlines.filter((d) => d.id !== id);
  saveDeadlines(deadlines);

  if (departureTimers.has(id)) {
    clearTimeout(departureTimers.get(id));
    departureTimers.delete(id);
  }

  const inst = rowInstances.get(id);
  if (!inst) {
    toggleEmptyState(deadlines.length === 0);
    return;
  }

  const finish = () => {
    inst.el.remove();
    rowInstances.delete(id);
    toggleEmptyState(deadlines.length === 0);
  };

  if (opts.flapOut) {
    inst.blankOut(finish);
  } else {
    inst.el.classList.add('is-departing');
    inst.el.addEventListener('animationend', finish, { once: true });
  }
}

function handleDelete(id) {
  removeDeadline(id, { flapOut: false });
}

function renderAll(animate) {
  const now = new Date();
  const sorted = sortDeadlines(deadlines);
  const sortedIds = new Set(sorted.map((d) => d.id));

  for (const [id, inst] of rowInstances) {
    if (!sortedIds.has(id)) {
      inst.el.remove();
      rowInstances.delete(id);
    }
  }

  sorted.forEach((deadline, index) => {
    const data = computeRowData(deadline, now);
    let inst = rowInstances.get(deadline.id);

    if (!inst) {
      inst = createRow(deadline);
      inst.onDelete(() => handleDelete(deadline.id));
      rowInstances.set(deadline.id, inst);
      boardRowsEl.appendChild(inst.el);
      // Newly added rows flip in from blank flaps as an explicit "arrival" cue.
      inst.update(data, { animate: true, rankIndex: index + 1 });
    } else {
      inst.update(data, { animate, rankIndex: index + 1 });
      boardRowsEl.appendChild(inst.el); // re-affirms sort order without recreating the node
    }

    scheduleDepartureIfNeeded(deadline, data);
  });

  toggleEmptyState(sorted.length === 0);
}

// ---------------------------------------------------------------------------
// Live clock
// ---------------------------------------------------------------------------

function setupClock() {
  const hourCluster = createFlapCluster(2);
  const colon = document.createElement('span');
  colon.className = 'clock-colon';
  colon.textContent = ':';
  colon.setAttribute('aria-hidden', 'true');
  const minCluster = createFlapCluster(2);
  clockFlapsEl.append(hourCluster.el, colon, minCluster.el);
  return { hourCluster, minCluster };
}

function updateClock(clock) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const label = hh + mm;
  if (label === lastClockLabel) return;
  const animate = lastClockLabel !== null; // don't animate the very first paint
  lastClockLabel = label;
  clock.hourCluster.setText(hh, animate);
  clock.minCluster.setText(mm, animate);
}

// ---------------------------------------------------------------------------
// Form handling
// ---------------------------------------------------------------------------

titleInput.addEventListener('input', () => {
  const upper = titleInput.value.toUpperCase();
  if (upper !== titleInput.value) titleInput.value = upper;
});

addForm.addEventListener('submit', (event) => {
  event.preventDefault();
  formError.textContent = '';

  const title = normalizeTitle(titleInput.value);
  const dateVal = dateInput.value;
  const timeVal = timeInput.value;

  if (!title) {
    formError.textContent = 'タイトルを入力してください（英数字・一部記号、最大16文字）。';
    titleInput.focus();
    return;
  }
  if (!dateVal) {
    formError.textContent = '締切日を入力してください。';
    dateInput.focus();
    return;
  }

  const time = timeVal || '23:59';
  const due = new Date(`${dateVal}T${time}:00`);
  if (Number.isNaN(due.getTime())) {
    formError.textContent = '日付または時刻の形式が正しくありません。';
    return;
  }

  deadlines.push({ id: generateId(), title, dueISO: due.toISOString() });
  saveDeadlines(deadlines);
  addForm.reset();
  titleInput.focus();
  renderAll(true);
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init() {
  const emptyCluster = createFlapCluster(EMPTY_TEXT.length);
  emptyFlapsEl.appendChild(emptyCluster.el);
  emptyCluster.setText(EMPTY_TEXT, false);

  renderAll(true); // boot-up flip: existing rows flip in from blank on first paint

  const clock = setupClock();
  updateClock(clock);
  setInterval(() => updateClock(clock), CLOCK_CHECK_MS);
  setInterval(() => renderAll(true), TICK_INTERVAL_MS);
}

init();
