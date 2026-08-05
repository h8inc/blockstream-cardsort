// Imperative sort-board engine (drag/tap, packing, fold math).
// Deliberately framework-free: React owns the flow; this owns the canvas.
// Geometry is FIXED real-phone px (393x852 iPhone frame, transform-scaled to fit)
// so "above the fold" means the same thing on every device.
import { CARDS, FACES, SHORT } from './data.js';

export const SCREEN_W = 393, SCREEN_H = 852, STATUS_H = 54;
export const FOLD_PX = SCREEN_H - STATUS_H; // content px visible without scrolling
const ROW_GAP = 8;
const PILE_SCALE = 0.42;

export const boardState = {
  stackOrder: [],
  parked: [],
  events: [],
  startedAt: Date.now(),
};

let $root = null, onChange = null;

const $ = id => $root.querySelector('#' + id);

function cardEl(c, mode) {
  const el = document.createElement('div');
  el.className = 'card ' + mode;
  el.dataset.id = c.id;
  el.setAttribute('aria-label', c.label);
  if (mode !== 'parked' && FACES[c.id]) {
    el.classList.add('real');
    if (c.h < 80 && mode === 'instack') el.classList.add('notag');
    const holder = document.createElement('div');
    holder.className = 'face';
    const isChip = c.w < 1;
    holder.style.width = isChip ? '100%' : '357px';
    holder.style.height = c.h + 'px';
    if (!isChip && mode === 'inpile') {
      holder.style.transform = 'scale(' + PILE_SCALE + ')';
      holder.style.transformOrigin = 'top left';
    }
    holder.innerHTML = FACES[c.id];
    el.appendChild(holder);
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = SHORT[c.id] || c.label;
    el.appendChild(tag);
  } else {
    el.textContent = mode === 'parked' ? (SHORT[c.id] || c.label) : c.label;
  }
  el.style.height = mode === 'parked' ? '34px'
    : mode === 'instack' ? c.h + 'px'
    : Math.max(34, Math.round(c.h * PILE_SCALE)) + 'px';
  if (mode === 'instack') {
    if (c.w === 0.5) el.classList.add('w50');
    else if (c.w === 0.25) el.classList.add('w25');
  }
  return el;
}

export function fitPhone() {
  if (!$root) return;
  const ring = 10;
  const availW = Math.min(innerWidth - (innerWidth > 760 ? 560 : 32), 500);
  const availH = innerHeight - 140;
  const s = Math.max(0.35, Math.min(1, availW / (SCREEN_W + 2 * ring), availH / (SCREEN_H + 2 * ring)));
  const ph = $('phoneEl'), box = $('scalebox');
  if (!ph) return;
  ph.style.transform = 'scale(' + s + ')';
  box.style.width = Math.round((SCREEN_W + 2 * ring) * s) + 'px';
  box.style.height = Math.round((SCREEN_H + 2 * ring) * s + 20) + 'px';
}

function renderStack() {
  const st = $('stack'); st.innerHTML = '';
  boardState.stackOrder.forEach(id => st.appendChild(cardEl(CARDS.find(c => c.id === id), 'instack')));
}
function renderPark() {
  const pk = $('parkCards'); pk.innerHTML = '';
  boardState.parked.forEach(id => pk.appendChild(cardEl(CARDS.find(c => c.id === id), 'parked')));
}
function refresh() {
  renderStack(); renderPark();
  onChange && onChange({
    placed: boardState.stackOrder.length + boardState.parked.length,
    total: CARDS.length,
    inStack: boardState.stackOrder.length,
  });
}
function removeEverywhere(id) {
  boardState.stackOrder = boardState.stackOrder.filter(x => x !== id);
  boardState.parked = boardState.parked.filter(x => x !== id);
  $root.querySelectorAll(`.card[data-id="${id}"]`).forEach(el => el.remove());
}
export function placeInStack(id, idx) {
  removeEverywhere(id);
  boardState.stackOrder.splice(idx, 0, id);
  refresh();
  boardState.events.push({ t: Date.now() - boardState.startedAt, a: 'stack', id, idx });
}
export function placeInPark(id) {
  removeEverywhere(id);
  boardState.parked.push(id);
  refresh();
  boardState.events.push({ t: Date.now() - boardState.startedAt, a: 'park', id });
}

/* ---- fold ---- */
export function visibleEnough(top, h) { return (FOLD_PX - top) >= Math.min(h / 2, 60); }
export function measureAboveFold() {
  const above = [];
  [...$('stack').children].forEach(k => {
    if (!k.classList.contains('card')) return;
    if (visibleEnough(k.offsetTop, k.offsetHeight)) above.push(k.dataset.id);
  });
  return above;
}
export function computeAboveFold() {
  const above = [];
  let y = 0, rowW = 0, rowH = 0, rowIds = [];
  const flushRow = () => {
    if (rowIds.length && visibleEnough(y, rowH)) above.push(...rowIds);
    y += rowH + (rowIds.length ? ROW_GAP : 0);
    rowW = 0; rowH = 0; rowIds = [];
  };
  for (const id of boardState.stackOrder) {
    const c = CARDS.find(x => x.id === id);
    if (rowW + c.w > 1.0001) flushRow();
    rowIds.push(id); rowW += c.w; rowH = Math.max(rowH, c.h);
    if (rowW >= 0.9999) flushRow();
  }
  flushRow();
  return above;
}

/* ---- drag (pointer events: mouse + touch) ---- */
let drag = null;
function zoneAt(x, y) {
  const els = document.elementsFromPoint(x, y);
  for (const el of els) {
    if (el.id === 'stack' || (el.closest && el.closest('.phone'))) return 'stack';
    if (el.id === 'park' || (el.closest && el.closest('#park'))) return 'park';
  }
  return null;
}
function stackIndexAt(y, x) {
  const kids = [...$('stack').children].filter(k => k.classList.contains('card'));
  let idx = 0;
  for (const k of kids) {
    const r = k.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    if (r.bottom < y || (y >= r.top && y <= r.bottom && cx < x)) idx++;
  }
  return Math.min(idx, kids.length);
}
function clearDroplines() { $root.querySelectorAll('.dropline').forEach(d => d.remove()); }
function showDropline(y, x) {
  const idx = stackIndexAt(y, x);
  const kids = [...$('stack').children].filter(k => k.classList.contains('card'));
  const line = document.createElement('div'); line.className = 'dropline';
  if (idx >= kids.length) $('stack').appendChild(line);
  else $('stack').insertBefore(line, kids[idx]);
}

function onDown(e) {
  const card = e.target.closest('.card'); if (!card || !$root.contains(card)) return;
  e.preventDefault();
  const r = card.getBoundingClientRect();
  drag = { card, id: card.dataset.id, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false, ghost: null };
  card.setPointerCapture && card.setPointerCapture(e.pointerId);
}
function onMove(e) {
  if (!drag) return;
  if (!drag.moved) {
    drag.moved = true;
    const g = drag.card.cloneNode(true);
    g.classList.add('ghost'); g.classList.remove('dragging');
    g.style.width = Math.min(drag.card.offsetWidth, 260) + 'px';
    g.style.height = Math.min(drag.card.offsetHeight, 80) + 'px';
    document.body.appendChild(g);
    drag.ghost = g; drag.card.classList.add('dragging');
  }
  drag.ghost.style.left = (e.clientX - drag.dx) + 'px';
  drag.ghost.style.top = (e.clientY - drag.dy) + 'px';
  clearDroplines();
  const t = zoneAt(e.clientX, e.clientY);
  $('park').classList.toggle('zone-hover', t === 'park');
  if (t === 'stack') showDropline(e.clientY, e.clientX);
  const sw = $('stackwrap'), swr = sw.getBoundingClientRect();
  if (t === 'stack') {
    if (e.clientY > swr.bottom - 70) sw.scrollTop += 12;
    else if (e.clientY < swr.top + 70) sw.scrollTop -= 12;
  } else {
    if (e.clientY < 70) window.scrollBy(0, -14);
    if (e.clientY > innerHeight - 70) window.scrollBy(0, 14);
  }
}
function onUp(e) {
  if (!drag) return;
  const { card, id, moved, ghost } = drag;
  if (ghost) ghost.remove();
  card.classList.remove('dragging');
  $('park').classList.remove('zone-hover');
  if (moved) {
    const t = zoneAt(e.clientX, e.clientY);
    if (t === 'stack') placeInStack(id, stackIndexAt(e.clientY, e.clientX));
    else if (t === 'park') placeInPark(id);
  } else if (card.classList.contains('inpile')) {
    placeInStack(id, boardState.stackOrder.length);
    const sw = $('stackwrap'); sw.scrollTop = sw.scrollHeight;
  }
  clearDroplines();
  drag = null;
}

let listeners = [];
export function initBoard(rootEl, changeCb) {
  $root = rootEl; onChange = changeCb;
  boardState.stackOrder = []; boardState.parked = []; boardState.events = [];
  const pile = $('pile'); pile.innerHTML = '';
  [...CARDS].sort(() => Math.random() - 0.5).forEach(c => pile.appendChild(cardEl(c, 'inpile')));
  fitPhone(); refresh();
  const opts = [['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp]];
  opts.forEach(([ev, fn]) => document.addEventListener(ev, fn));
  const rz = () => fitPhone();
  window.addEventListener('resize', rz);
  listeners = [...opts.map(([ev, fn]) => () => document.removeEventListener(ev, fn)),
               () => window.removeEventListener('resize', rz)];
}
export function destroyBoard() { listeners.forEach(fn => fn()); listeners = []; $root = null; }
