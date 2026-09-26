// Boot, the main loop, the status bar and bottom navigation.
import { S, load, save, step, catchUp, checkAch, dailyCheck } from './core.js';
import { openGame, closeGame, shellUpdate } from './shell.js';
import { mountHome, mountLife, mountResearch, mountGear, mountTrophies } from './views.js';
import * as D from './data.js';
import { BY_ID } from './games/index.js';
import { fmt, usd, setText, toggle, modal, toast } from './util.js';

const TABS = [
  ['home', '📱', 'Home', root => mountHome(root, id => openGame(id))],
  ['life', '🕒', 'Life', mountLife],
  ['research', '🧪', 'Research', mountResearch],
  ['gear', '🛒', 'Gear', mountGear],
  ['trophies', '🏆', 'Trophies', mountTrophies],
];
let view = null, tab = 'home';

const status = document.getElementById('status');
status.innerHTML = `
  <button class="st-lvl" data-go="trophies" aria-label="Level">
    <svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19" class="ring-bg"/><circle cx="22" cy="22" r="19" class="ring-fg" data-k="ring" pathLength="100"/></svg>
    <b data-k="lvl"></b>
  </button>
  <div class="st-main">
    <div class="st-row"><span class="st-title">Idle Meta</span><span class="st-xp" data-k="xp"></span></div>
    <div class="st-pills">
      <button class="pill money" data-go="life">💵 <b data-k="wallet"></b></button>
      <button class="pill insight" data-go="research">💡 <b data-k="ins"></b></button>
      <button class="pill sanity" data-go="life">🧠 <b data-k="san"></b></button>
    </div>
  </div>`;
const SK = n => status.querySelector(`[data-k="${n}"]`);

const nav = document.getElementById('tabs');
nav.innerHTML = TABS.map(([k, i, l]) => `<button data-go="${k}"><span>${i}</span><small>${l}</small><i class="dot" hidden></i></button>`).join('');

document.addEventListener('click', e => {
  const b = e.target.closest('#status [data-go], #tabs [data-go]');
  if (b) showView(b.dataset.go);
});

function showView(k) {
  tab = k;
  if (S.openId) history.back();
  nav.querySelectorAll('[data-go]').forEach(b => toggle(b, 'on', b.dataset.go === k));
  const root = document.getElementById('view');
  root.onclick = root.oninput = null;
  root.scrollTop = 0;
  window.scrollTo(0, 0);
  view = TABS.find(t => t[0] === k)[3](root);
  view.update();
}

function updateStatus() {
  const m = S.st.meta, need = D.xpNeed(m.level);
  setText(SK('lvl'), String(m.level));
  SK('ring').style.strokeDasharray = `${(m.xp / need) * 100} 100`;
  setText(SK('xp'), `${fmt(m.xp)} / ${fmt(need)} XP`);
  setText(SK('wallet'), usd(m.wallet));
  setText(SK('ins'), fmt(m.insight));
  setText(SK('san'), Math.round(m.sanity) + '%');
  toggle(SK('san'), 'low', m.sanity < 40);
  const dots = nav.querySelectorAll('.dot');
  dots[2].hidden = !D.RESEARCH.some(r => D.canResearch(S.st, r) && m.insight >= r.cost);
  dots[3].hidden = !D.GEAR.some(it => (m.gear[it.id] || 0) < it.max && m.wallet >= D.gearCost(S.st, it));
}

window.addEventListener('popstate', () => { if (S.openId) closeGame(); });

// ---- boot ----
const fresh = load();
S.onInstall = id => {
  if (tab === 'home') showView('home');
  toast(`📲 <b>${BY_ID[id].name}</b> installed! Focus was re-split evenly.`);
};
const away = (Date.now() - S.st.lastSeen) / 1000;
if (!fresh && away > 5) catchUp(away, false);
dailyCheck(fresh);
if (fresh) {
  modal((card, close) => {
    card.classList.add('intro');
    card.innerHTML = `
      <div class="intro-phone">📱</div>
      <h2>Idle Meta</h2>
      <p>You play idle games. Lots of them.</p>
      <ul>
        <li>🤖 Your games <b>play themselves</b>. Pop in whenever you like.</li>
        <li>⚡ Split your <b>Focus</b> between games: faster games, smarter autopilots.</li>
        <li>🕒 Balance work, gaming and sleep. Stay <b>free-to-play</b>, or spend.</li>
        <li>🎁 Tap notifications for surprise loot.</li>
        <li>⭐ Level up to unlock new games and 🧪 research.</li>
      </ul>
      <button class="big-btn">Unlock my phone</button>`;
    card.querySelector('.big-btn').onclick = close;
  }, { sticky: true });
}
showView('home');
history.replaceState({}, '');

let last = Date.now(), uiT = 0, achT = 0;
function frame() {
  const now = Date.now(), dt = (now - last) / 1000;
  last = now;
  if (dt > 5) catchUp(dt, dt < 300);
  else if (dt > 0) step(dt, now);
  if (S.openId) shellUpdate();
  uiT += dt;
  if (uiT > 0.2) {
    uiT = 0;
    updateStatus();
    if (!S.openId) {
      if (tab === 'home' && view.count !== D.installed(S.st).length) showView('home');
      view.update();
    }
  }
  achT += dt;
  if (achT > 1) { achT = 0; checkAch(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

setInterval(save, 5000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
window.addEventListener('pagehide', save);
