// Imperative sort-board engine (drag/tap, packing, fold math).
// Deliberately framework-free: React owns the flow; this owns the canvas.
// Geometry is FIXED real-phone px (393x852 iPhone frame, transform-scaled to fit)
// so "above the fold" means the same thing on every device.
import { CARDS, FACES, SHORT, GROUPS } from './data.js';

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
let reorderDone = false; // once true, the "drag to reorder" hint stays hidden

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
    if (mode === 'inpile') {
      // In the pile: clipped face preview + readable caption (name + what it is).
      const box = document.createElement('div');
      box.className = 'facebox';
      box.style.height = (isChip ? c.h : Math.max(34, Math.round(c.h * PILE_SCALE))) + 'px';
      if (!isChip) { box.dataset.faceH = c.h; }
      box.appendChild(holder);
      el.appendChild(box);
      const cap = document.createElement('div');
      cap.className = 'cap';
      cap.innerHTML = '<span class="drg">drag or tap</span><span class="nm"></span><span class="ds"></span>';
      cap.querySelector('.nm').textContent = c.label;
      cap.querySelector('.ds').textContent = c.desc || '';
      el.appendChild(cap);
      // One-click rejection — the drag journey to the zone was too easy to miss.
      const nope = document.createElement('button');
      nope.className = 'nope';
      nope.type = 'button';
      nope.textContent = '✕';
      nope.title = "Don't need — not on my first screen";
      nope.setAttribute('aria-label', "Don't need — not on my first screen");
      nope.addEventListener('click', ev => { ev.stopPropagation(); placeInPark(c.id); });
      el.appendChild(nope);
    } else {
      el.appendChild(holder);
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = SHORT[c.id] || c.label;
      el.appendChild(tag);
      const grip = document.createElement('span');
      grip.className = 'grip';
      grip.textContent = '⠿';
      el.appendChild(grip);
    }
  } else {
    el.textContent = mode === 'parked' ? (SHORT[c.id] || c.label) : c.label;
  }
  el.style.height = mode === 'parked' ? '34px'
    : mode === 'instack' ? c.h + 'px'
    : (FACES[c.id] ? 'auto' : Math.max(34, Math.round(c.h * PILE_SCALE)) + 'px');
  if (mode === 'instack') {
    if (c.w === 0.5) el.classList.add('w50');
    else if (c.w === 0.25) el.classList.add('w25');
  }
  return el;
}

// Scale each pile face preview to fill its card's width (cards are 150px on
// desktop but 50% of the column on small screens).
export function fitPileFaces() {
  if (!$root) return;
  $root.querySelectorAll('.card.inpile .facebox[data-face-h]').forEach(box => {
    const w = box.clientWidth;
    if (!w) return;
    const s = w / 357;
    const holder = box.firstChild;
    holder.style.transform = 'scale(' + s + ')';
    box.style.height = Math.max(34, Math.round(box.dataset.faceH * s)) + 'px';
  });
}

export function fitPhone() {
  if (!$root) return;
  const ring = 10;
  const availW = Math.min(innerWidth - (innerWidth > 760 ? 560 : 32), 500);
  const availH = innerHeight - 160; // the reject zone is full-width above the columns now, not stacked on the phone
  const s = Math.max(0.35, Math.min(1, availW / (SCREEN_W + 2 * ring), availH / (SCREEN_H + 2 * ring)));
  const ph = $('phoneEl'), box = $('scalebox');
  if (!ph) return;
  ph.style.transform = 'scale(' + s + ')';
  const boxW = Math.round((SCREEN_W + 2 * ring) * s);
  box.style.width = boxW + 'px';
  box.style.height = Math.round((SCREEN_H + 2 * ring) * s + 20) + 'px';
  // Pin the column to the phone's width. The column is a flex item with flex:none,
  // so without this its width is the max-content of its widest child — the reject
  // zone, which grows with every parked chip and starves the pile column to nothing.
  const col = ph.closest('.phonecol');
  if (col) col.style.width = innerWidth > 760 ? boxW + 'px' : '';
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
  const hint = $('reorderHint');
  if (hint) hint.style.display = (boardState.stackOrder.length >= 2 && !reorderDone) ? '' : 'none';
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
  const wasInStack = boardState.stackOrder.includes(id);
  removeEverywhere(id);
  boardState.stackOrder.splice(idx, 0, id);
  if (wasInStack) reorderDone = true; // user has discovered reordering — retire the hint
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
    if (el.id === 'parkDock' || (el.closest && el.closest('#parkDock'))) return 'park';
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

const DRAG_THRESHOLD = 5; // px of movement before a press becomes a drag (keeps taps reliable)
let scrollRaf = 0;
// Edge auto-scroll runs on its own rAF loop: pointermove events stop firing when
// the mouse holds still at a screen edge, so scrolling must not depend on them.
function autoScrollTick() {
  if (!drag || !drag.moved) { scrollRaf = 0; return; }
  const t = zoneAt(drag.x, drag.y);
  if (t === 'stack') {
    const sw = $('stackwrap'), swr = sw.getBoundingClientRect();
    if (drag.y > swr.bottom - 70) sw.scrollTop += 8;
    else if (drag.y < swr.top + 70) sw.scrollTop -= 8;
  } else {
    if (drag.y < 80) window.scrollBy(0, -10);
    else if (drag.y > innerHeight - 80) window.scrollBy(0, 10);
  }
  updateDropUI();
  scrollRaf = requestAnimationFrame(autoScrollTick);
}
function updateDropUI() {
  clearDroplines();
  const t = zoneAt(drag.x, drag.y);
  $('park').classList.toggle('zone-hover', t === 'park');
  const dock = $('parkDock');
  if (dock) dock.classList.toggle('zone-hover', t === 'park');
  if (t === 'stack') showDropline(drag.y, drag.x);
}
function onDown(e) {
  if (e.target.closest && e.target.closest('.nope')) return; // ✕ button handles its own click
  const card = e.target.closest('.card'); if (!card || !$root.contains(card)) return;
  e.preventDefault();
  const r = card.getBoundingClientRect();
  drag = { card, id: card.dataset.id, dx: e.clientX - r.left, dy: e.clientY - r.top,
           moved: false, ghost: null, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY };
  card.setPointerCapture && card.setPointerCapture(e.pointerId);
}
function onMove(e) {
  if (!drag) return;
  drag.x = e.clientX; drag.y = e.clientY;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return;
    drag.moved = true;
    const g = drag.card.cloneNode(true);
    g.classList.add('ghost'); g.classList.remove('dragging');
    const gw = Math.min(drag.card.offsetWidth, 260), gh = Math.min(drag.card.offsetHeight, 80);
    g.style.width = gw + 'px';
    g.style.height = gh + 'px';
    // Keep the ghost under the cursor even when grabbing a card bigger than the ghost.
    drag.dx = Math.min(drag.dx, gw - 24);
    drag.dy = Math.min(drag.dy, gh - 12);
    document.body.appendChild(g);
    drag.ghost = g; drag.card.classList.add('dragging');
    const dock = $('parkDock');
    if (dock) dock.classList.add('on');
    if (!scrollRaf) scrollRaf = requestAnimationFrame(autoScrollTick);
  }
  drag.ghost.style.left = (e.clientX - drag.dx) + 'px';
  drag.ghost.style.top = (e.clientY - drag.dy) + 'px';
  updateDropUI();
}
function onUp(e) {
  if (!drag) return;
  if (scrollRaf) { cancelAnimationFrame(scrollRaf); scrollRaf = 0; }
  const { card, id, moved, ghost } = drag;
  if (ghost) ghost.remove();
  card.classList.remove('dragging');
  // Resolve the drop zone BEFORE hiding the dock — hiding it first would make
  // elementsFromPoint miss it and silently swallow the drop.
  const t = moved ? zoneAt(e.clientX, e.clientY) : null;
  $('park').classList.remove('zone-hover');
  const dock = $('parkDock');
  if (dock) dock.classList.remove('on', 'zone-hover');
  if (moved) {
    if (t === 'stack') placeInStack(id, stackIndexAt(e.clientY, e.clientX));
    else if (t === 'park') placeInPark(id);
  } else if (card.classList.contains('inpile')) {
    placeInStack(id, boardState.stackOrder.length);
    const sw = $('stackwrap'); sw.scrollTop = sw.scrollHeight;
    // On small screens the phone can be scrolled out of view — without this,
    // a tapped card seems to vanish. Bring the phone on screen so the user sees it land.
    const ph = $('phoneEl'), r = ph.getBoundingClientRect();
    if (r.bottom < 150 || r.top > innerHeight - 150) {
      ph.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  clearDroplines();
  drag = null;
}

let listeners = [];
export function initBoard(rootEl, changeCb) {
  $root = rootEl; onChange = changeCb;
  boardState.stackOrder = []; boardState.parked = []; boardState.events = [];
  reorderDone = false;
  const pile = $('pile'); pile.innerHTML = '';
  // Grouped pile: fixed section order, cards shuffled within their group to limit order bias.
  GROUPS.forEach(g => {
    const cards = CARDS.filter(c => c.group === g.id);
    if (!cards.length) return;
    const h = document.createElement('div');
    h.className = 'pgh';
    h.textContent = g.title;
    pile.appendChild(h);
    [...cards].sort(() => Math.random() - 0.5).forEach(c => pile.appendChild(cardEl(c, 'inpile')));
  });
  fitPhone(); refresh(); requestAnimationFrame(fitPileFaces);
  const opts = [['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp]];
  opts.forEach(([ev, fn]) => document.addEventListener(ev, fn));
  const rz = () => { fitPhone(); fitPileFaces(); };
  window.addEventListener('resize', rz);
  listeners = [...opts.map(([ev, fn]) => () => document.removeEventListener(ev, fn)),
               () => window.removeEventListener('resize', rz)];
}
export function destroyBoard() {
  if (scrollRaf) { cancelAnimationFrame(scrollRaf); scrollRaf = 0; }
  drag = null;
  listeners.forEach(fn => fn()); listeners = []; $root = null;
}
