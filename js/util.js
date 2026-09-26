// Small shared helpers: number formatting, bulk-buy math, DOM bits, effects, modals.

export const $ = (s, r = document) => r.querySelector(s);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];

export function fmt(n) {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '0';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) return n < 10 && n % 1 ? (Math.floor(n * 10) / 10).toFixed(1) : String(Math.floor(n));
  const t = Math.floor(Math.log10(n) / 3);
  if (t >= SUF.length) return n.toExponential(2).replace('e+', 'e');
  const v = n / 1000 ** t;
  const s = v < 10 ? (Math.floor(v * 100) / 100).toFixed(2) : v < 100 ? (Math.floor(v * 10) / 10).toFixed(1) : String(Math.floor(v));
  return s + SUF[t];
}

export function usd(n) {
  if (n >= 1e4) return '$' + fmt(n);
  const r = Math.round(n * 100) / 100;
  return '$' + (r % 1 ? r.toFixed(2) : String(r));
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

// ---- incremental-game economy ----
export function costOf(base, g, owned, n) {
  return n <= 0 ? 0 : base * g ** owned * (g ** n - 1) / (g - 1);
}
export function maxBuy(base, g, owned, cash) {
  const c = base * g ** owned;
  if (cash < c) return 0;
  let n = Math.floor(Math.log(cash * (g - 1) / c + 1) / Math.log(g));
  while (n > 0 && costOf(base, g, owned, n) > cash) n--;
  return n;
}
export const STEPS = [10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000];
export function stepMult(n) {
  let k = 0;
  for (const s of STEPS) { if (n >= s) k++; else break; }
  return 2 ** k;
}
export const nextStep = n => STEPS.find(s => s > n) ?? null;
export function buyN(mode, base, g, owned, cash) {
  if (mode === 'max') return Math.max(1, maxBuy(base, g, owned, cash));
  if (mode === 'next') { const t = nextStep(owned); return t ? t - owned : 1; }
  return mode;
}
export const modeLabel = m => (m === 'max' ? 'Max' : m === 'next' ? 'Next' : '×' + m);

// ---- DOM ----
export function setText(el, v) { if (el && el.textContent !== v) el.textContent = v; }
export function toggle(el, cls, on) { if (el && el.classList.contains(cls) !== !!on) el.classList.toggle(cls, !!on); }
export function fill(el, frac) { if (el) el.style.transform = `scaleX(${clamp(frac || 0, 0, 1)})`; }
export function show(el, on) { if (el && el.hidden === !!on) el.hidden = !on; }
export function restartAnim(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// ---- effects ----
const layer = id => document.getElementById(id);

export function floatText(x, y, text, color) {
  if (!x && !y) return;
  const d = document.createElement('div');
  d.className = 'floater';
  d.textContent = text;
  d.style.left = x + 'px';
  d.style.top = y + 'px';
  if (color) d.style.color = color;
  layer('fx-layer').append(d);
  setTimeout(() => d.remove(), 950);
}

export function burst(x, y, colors = ['#ffd84d', '#ff7ac6', '#6fe3ff', '#7dff9b'], n = 16) {
  if (reducedMotion() || (!x && !y)) return;
  const L = layer('fx-layer');
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    const a = Math.random() * Math.PI * 2, r = rand(40, 120);
    p.className = 'spark';
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.background = pick(colors);
    p.style.setProperty('--dx', Math.cos(a) * r + 'px');
    p.style.setProperty('--dy', Math.sin(a) * r + 'px');
    L.append(p);
    setTimeout(() => p.remove(), 850);
  }
}

export function toast(html, cls = '') {
  const L = layer('toast-layer');
  const d = document.createElement('div');
  d.className = 'toast ' + cls;
  d.innerHTML = html;
  L.append(d);
  while (L.children.length > 3) L.firstElementChild.remove();
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 300); }, 2800);
}

// ---- modals (queued, one at a time) ----
const queue = [];
let current = null;
export const modalOpen = () => !!current;

export function modal(build, opts = {}) {
  queue.push({ build, opts });
  if (!current) nextModal();
}

function nextModal() {
  const item = queue.shift();
  if (!item) { current = null; return; }
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap ' + (item.opts.cls || '');
  wrap.innerHTML = '<div class="modal-card" role="dialog" aria-modal="true"></div>';
  layer('modal-layer').append(wrap);
  const card = wrap.firstElementChild;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.add('out');
    item.opts.onClose?.();
    setTimeout(() => { wrap.remove(); current = null; nextModal(); }, 180);
  };
  current = { close };
  item.build(card, close);
  if (!item.opts.sticky) wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  requestAnimationFrame(() => wrap.classList.add('in'));
}
