// The phone's own tabs: Home (the dashboard), Life, Research, Gear, Trophies.
import { S, wipe, doPrestige } from './core.js';
import { GAMES, BY_ID, SOON } from './games/index.js';
import * as D from './data.js';
import { fmt, usd, fmtTime, setText, toggle, show, fill, burst, modal } from './util.js';

const GREET = ['Just one more tap.', 'Your games missed you.', 'Numbers are going up.', 'Have you tried turning it off and prestiging?', 'Remember to blink.', 'The grind respects you.'];

// Move one game's Focus share, borrowing from unassigned focus first, then from the biggest other game.
function nudgeFocus(st, id, delta) {
  const a = st.meta.alloc, ids = D.installed(st).map(d => d.id);
  if (delta < 0) { a[id] = Math.max(0, (a[id] || 0) + delta); return; }
  if ((a[id] || 0) >= 100) return;
  if (D.allocTotal(st) + delta > 100) {
    const donor = ids.filter(x => x !== id && (a[x] || 0) > 0).sort((x, y) => a[y] - a[x])[0];
    if (!donor) return;
    a[donor] -= Math.min(delta, a[donor]);
  }
  a[id] = Math.min(100, (a[id] || 0) + delta, 100 - (D.allocTotal(st) - (a[id] || 0)));
}

function sparkPath(h) {
  if (h.length < 2) return ['', ''];
  const lo = Math.min(...h), hi = Math.max(...h), span = hi - lo || 1;
  const pts = h.map((v, i) => [(i / (h.length - 1)) * 100, 26 - ((v - lo) / span) * 22]);
  const line = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
  return [line, `${line} L100 28 L0 28Z`];
}

export function mountHome(root, openGame) {
  const st = S.st, m = st.meta, ids = D.installed(st).map(d => d.id);
  const hr = new Date().getHours();
  root.innerHTML = `
    <section class="hello">
      <h1>${hr < 5 ? 'Up late' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'}, gamer</h1>
      <p>${GREET[Math.floor(Math.random() * GREET.length)]} <span class="streak">🔥 ${m.streak.n}-day streak</span></p>
    </section>
    <section class="events" data-k="events"></section>
    <section class="cards">${GAMES.map(def => (st.games[def.id] ? cardHTML(def) : lockedHTML(def))).join('')}</section>
    <section>
      <div class="sec-h">Coming soon to the App Store</div>
      <div class="soon">${SOON.map(x => `<div class="soon-card"><span class="app-icon sm">${x.art}</span><b>${x.name}</b><small>${x.genre}</small></div>`).join('')}</div>
    </section>
    <a class="home-link" href="https://stilotto.github.io/">More games from Stilotto →</a>`;
  const armed = {};
  root.onclick = e => {
    const card = e.target.closest('[data-id]');
    if (!card) return;
    const id = card.dataset.id, g = st.games[id], def = BY_ID[id];
    const b = e.target.closest('button, [data-open]');
    if (!b) return;
    if (b.dataset.f) nudgeFocus(st, id, +b.dataset.f);
    else if (b.dataset.m) {
      const B = D.BUDGET_STEPS, i = Math.max(0, B.indexOf(m.budget[id] || 0));
      m.budget[id] = B[Math.max(0, Math.min(B.length - 1, i + +b.dataset.m))];
    } else if (b.hasAttribute('data-auto')) g.auto = !g.auto;
    else if (b.hasAttribute('data-ap')) g.autoPrestige = !g.autoPrestige;
    else if (b.hasAttribute('data-prest')) {
      if (def.gain(g.s, D.prestigeMult(st)) < 1) return;
      if (Date.now() - (armed[id] || 0) > 4000) { armed[id] = Date.now(); return; }
      armed[id] = 0;
      const r = b.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, ['#ffd84d', '#ff7ac6', '#fff'], 30);
      doPrestige(id);
    } else if (b.hasAttribute('data-open')) openGame(id);
    cards.find(c => c.id === id) && update();
  };
  const cards = ids.map(id => {
    const el = root.querySelector(`[data-id="${id}"]`), k = n => el.querySelector(`[data-k="${n}"]`);
    return { id, def: BY_ID[id], el, ...Object.fromEntries(['stat', 'sub', 'pc', 'fp', 'fx', 'amt', 'pay', 'alert', 'badge', 'boost', 'ev', 'auto', 'autoBtn', 'prest', 'ap', 'line', 'area', 'trend'].map(n => [n, k(n)])) };
  });
  const evEl = root.querySelector('[data-k="events"]');
  function update() {
    const now = Date.now(), active = m.events.filter(e => e.until > now);
    // Rebuild the event list only when the set of events changes; tick the countdowns in place.
    const evKey = active.map(e => e.type + e.id + e.until).join('|');
    if (evEl.dataset.key !== evKey) {
      evEl.dataset.key = evKey;
      evEl.innerHTML = active.map(e => { const E = D.EVENTS[e.type], d = BY_ID[e.id]; return `<div class="event"><span class="app-icon xs">${d.art}</span><div><b>${E.icon} ${E.name}</b><small>${d.name}: ${E.desc}</small></div><em></em></div>`; }).join('');
    }
    evEl.querySelectorAll('.event em').forEach((el, i) => setText(el, fmtTime((active[i].until - now) / 1000)));
    for (const c of cards) {
      const g = st.games[c.id], P = c.def.prestige;
      const ctx = { now, open: false, auto: g.auto, mult: D.gameMult(st, c.id, now, false), autoTaps: D.autoTaps(st), pm: D.prestigeMult(st) };
      const info = c.def.card(g.s, ctx), gain = c.def.gain(g.s, ctx.pm), b = m.budget[c.id] || 0;
      setText(c.stat, info.stat);
      setText(c.sub, info.sub);
      setText(c.pc, String(g.prestiges));
      setText(c.fp, `${m.alloc[c.id] || 0}%`);
      setText(c.fx, `×${D.focusMult(st, c.id).toFixed(1)}`);
      setText(c.amt, `${usd(b)}/pay`);
      setText(c.pay, g.spent ? `💳 ${usd(g.spent)} spent` : '🦸 F2P · +50% XP');
      toggle(c.pay, 'f2p', !g.spent);
      setText(c.alert, info.alert);
      show(c.alert, !!info.alert);
      show(c.boost, g.boostUntil > now);
      const ev = active.find(e => e.id === c.id);
      show(c.ev, !!ev);
      if (ev) setText(c.ev, `${D.EVENTS[ev.type].icon} ${D.EVENTS[ev.type].name}`);
      toggle(c.autoBtn, 'on', g.auto);
      setText(c.auto, g.auto ? `Autopilot · ${Math.round(D.autoSkill(st, c.id) * 100)}% skill` : 'Autopilot off');
      show(c.prest, gain >= 1);
      const isArmed = now - (armed[c.id] || 0) < 4000;
      toggle(c.prest, 'armed', isArmed);
      if (gain >= 1) setText(c.prest, isArmed ? 'Tap again to confirm' : `${P.icon} ${P.one} +${fmt(gain)}`);
      show(c.ap, D.has(st, 'a3'));
      toggle(c.ap, 'on', g.autoPrestige);
      setText(c.ap, g.autoPrestige ? '📜 Auto-prestige on' : '📜 Auto-prestige off');
      const [line, area] = sparkPath(g.hist);
      if (c.line.getAttribute('d') !== line) { c.line.setAttribute('d', line); c.area.setAttribute('d', area); }
      const h = g.hist;
      setText(c.trend, h.length > 1 ? (h[h.length - 1] > h[0] ? `▲ ${c.def.scoreLabel} rising` : h[h.length - 1] < h[0] ? `▼ reset since` : '— steady') : 'tracking…');
      const n = (g.chestAt <= now ? 1 : 0) + (info.alert ? 1 : 0);
      show(c.badge, n > 0);
      setText(c.badge, String(n));
    }
  }
  return { count: ids.length, update };
}

function cardHTML(def) {
  const P = def.prestige;
  return `
    <div class="gcard theme-${def.theme}" data-id="${def.id}">
      <div class="gc-top" data-open role="button" tabindex="0" aria-label="Play ${def.name}">
        <span class="app-icon">${def.art}<i class="badge" data-k="badge" hidden></i></span>
        <span class="gc-mid">
          <span class="gc-name">${def.name}</span>
          <span class="gc-dev">${def.dev} · ${def.genre}</span>
          <span class="gc-stat" data-k="stat"></span>
          <span class="gc-sub" data-k="sub"></span>
        </span>
        <span class="gc-go" aria-hidden="true">▶</span>
      </div>
      <div class="spark-wrap">
        <svg class="sparkline" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><path class="spark-area" data-k="area"/><path class="spark-line" data-k="line"/></svg>
        <small data-k="trend"></small>
      </div>
      <div class="chips">
        <span class="chip">${P.icon} <b data-k="pc"></b> ${P.noun}</span>
        <span class="chip focus">⚡ <b data-k="fx"></b> speed</span>
        <span class="chip" data-k="pay"></span>
        <span class="chip boost" data-k="boost" hidden>🚀 Boosted</span>
        <span class="chip event" data-k="ev" hidden></span>
      </div>
      <div class="gc-ctrl">
        <div class="ctl focus"><span>⚡</span><button data-f="-5" aria-label="Less focus">−</button><b data-k="fp"></b><button data-f="5" aria-label="More focus">+</button></div>
        <div class="ctl money"><span>💳</span><button data-m="-1" aria-label="Spend less">−</button><b data-k="amt"></b><button data-m="1" aria-label="Spend more">+</button></div>
      </div>
      <div class="gc-foot">
        <button class="auto" data-auto data-k="autoBtn">🤖 <b data-k="auto"></b></button>
        <button class="ap" data-ap data-k="ap" hidden></button>
        <button class="prest-btn" data-prest data-k="prest" hidden></button>
      </div>
      <div class="gc-alert" data-k="alert" hidden></div>
    </div>`;
}
function lockedHTML(def) {
  return `
    <div class="gcard locked">
      <div class="gc-top">
        <span class="app-icon">${def.art}<span class="lock">🔒</span></span>
        <span class="gc-mid">
          <span class="gc-name">${def.name}</span>
          <span class="gc-dev">${def.dev} · ${def.genre}</span>
          <span class="gc-sub">Unlocks at level ${def.unlock}</span>
        </span>
      </div>
    </div>`;
}

// ---------------- Life ----------------
export function mountLife(root) {
  const st = S.st, m = st.meta, defs = D.installed(st);
  root.innerHTML = `
    <section class="panel">
      <div class="panel-h"><span>🕒 Your day</span><small>24 hours. Spend them wisely.</small></div>
      <div class="day-bar"><i class="d-work" data-k="bw"></i><i class="d-game" data-k="bg"></i><i class="d-sleep" data-k="bs"></i></div>
      <div class="day-row"><span>💼 Work <b data-k="hw"></b></span><input type="range" min="0" max="16" step="1" value="${m.day.work}" data-d="work" aria-label="Work hours"></div>
      <div class="day-row"><span>🎮 Gaming <b data-k="hg"></b></span><input type="range" min="0" max="16" step="1" value="${m.day.game}" data-d="game" aria-label="Gaming hours"></div>
      <div class="day-row"><span>😴 Sleep <b data-k="hs"></b></span><em class="muted small">whatever's left</em></div>
      <div class="sum3">
        <div><small>Paycheck</small><b data-k="salary"></b></div>
        <div><small>Max Focus</small><b data-k="cap"></b></div>
        <div><small>Offline speed</small><b data-k="off"></b></div>
      </div>
      <div class="sanity">
        <div class="sanity-top"><span>🧠 Sanity</span><b data-k="san"></b><em data-k="srate"></em></div>
        <div class="bar sanity-bar"><i data-k="sbar"></i></div>
        <p class="note" data-k="stip"></p>
      </div>
    </section>

    <section class="panel">
      <div class="panel-h"><span>⚡ Focus</span><small>set each game's share on its Home card</small></div>
      <div class="sum3">
        <div><small>Max Focus</small><b data-k="cap2"></b></div>
        <div><small>Juggling</small><b data-k="pen"></b></div>
        <div><small>Usable</small><b data-k="eff"></b></div>
      </div>
      <div class="alloc-bar">${defs.map(d => `<i class="theme-${d.theme}" data-seg="${d.id}"></i>`).join('')}</div>
      <div class="legend">${defs.map(d => `<span><i class="theme-${d.theme}"></i>${d.name} <b data-lg="${d.id}"></b></span>`).join('')}</div>
      <div class="row-btns"><button class="ghost" data-act="even">Split evenly</button><span class="muted small" data-k="free"></span></div>
      <p class="note">Focus makes a game faster and makes its 🤖 autopilot smarter. Each extra game costs some Focus to juggle, but adds <b>+25% XP</b> from variety.</p>
    </section>

    <section class="panel">
      <div class="panel-h"><span>💵 Wallet</span></div>
      <div class="sum3">
        <div><small>Wallet</small><b data-k="wallet"></b></div>
        <div><small>Per payday</small><b data-k="salary2"></b></div>
        <div><small>Next payday</small><b data-k="next"></b></div>
      </div>
      <div class="bar money"><i data-k="paybar"></i></div>
      <div class="sum-line"><span>Auto-budget per payday</span><b data-k="budget"></b></div>
      <div class="sum-line"><span>Lifetime real-money spend</span><b data-k="spent"></b></div>
      <p class="note">Budgets turn into gems each payday (${D.gemsPerDollar(st)} 💎 per $1). Set them on each Home card. Games you never pay for give <b>+50% XP</b>.</p>
    </section>

    <section class="panel">
      <div class="panel-h"><span>✨ XP bonuses</span></div>
      <div class="sum-line"><span>🎮 Variety (${defs.length} game${defs.length > 1 ? 's' : ''})</span><b>+${Math.round(D.varietyBonus(st) * 100)}%</b></div>
      ${defs.map(d => `<div class="sum-line"><span>${d.name}</span><b data-xp="${d.id}"></b></div>`).join('')}
    </section>`;

  const K = n => root.querySelector(`[data-k="${n}"]`);
  root.oninput = e => {
    const r = e.target.closest('input[data-d]');
    if (!r) return;
    const k = r.dataset.d, other = k === 'work' ? 'game' : 'work';
    m.day[k] = Math.min(+r.value, 24 - m.day[other]);
    r.value = m.day[k];
  };
  root.onclick = e => {
    if (!e.target.closest('[data-act="even"]')) return;
    const each = Math.floor(100 / defs.length);
    defs.forEach((d, i) => { m.alloc[d.id] = each + (i === 0 ? 100 - each * defs.length : 0); });
  };
  return {
    update() {
      const day = D.dayOf(st), rate = D.sanityRate(st);
      K('bw').style.flexGrow = day.work; K('bg').style.flexGrow = day.game; K('bs').style.flexGrow = day.sleep;
      setText(K('hw'), day.work + 'h'); setText(K('hg'), day.game + 'h'); setText(K('hs'), day.sleep + 'h');
      setText(K('salary'), usd(D.salary(st)));
      setText(K('cap'), fmt(D.focusCap(st)));
      setText(K('off'), Math.round(D.offlineEff(st) * 100) + '%');
      setText(K('san'), Math.round(m.sanity) + '%');
      setText(K('srate'), `${rate >= 0 ? '+' : '−'}${Math.abs(rate * 60).toFixed(1)}/min`);
      toggle(K('srate'), 'bad', rate < 0);
      fill(K('sbar'), m.sanity / 100);
      const sm = D.sanityMult(st);
      setText(K('stip'), sm > 1 ? '😌 Well rested: every game +10%.' : sm < 1 ? `😵 Burnt out: every game ×${sm.toFixed(2)}. Sleep more or game less.` : day.sleep < 7 ? 'Running on too little sleep. Sanity is draining.' : day.game > 10 ? 'That is a lot of gaming. Sanity is draining.' : 'Balanced. Above 80% you get a Well-rested bonus.');
      setText(K('cap2'), fmt(D.focusCap(st)));
      setText(K('pen'), defs.length > 1 ? `−${Math.round((1 - D.effFocus(st) / Math.max(1, D.focusCap(st))) * 100)}%` : 'none');
      setText(K('eff'), fmt(D.effFocus(st)));
      const free = 100 - D.allocTotal(st);
      setText(K('free'), free > 0 ? `${free}% unassigned` : 'All Focus assigned');
      for (const d of defs) {
        root.querySelector(`[data-seg="${d.id}"]`).style.flexGrow = m.alloc[d.id] || 0;
        setText(root.querySelector(`[data-lg="${d.id}"]`), `${m.alloc[d.id] || 0}%`);
        setText(root.querySelector(`[data-xp="${d.id}"]`), st.games[d.id].spent ? '—' : '🦸 F2P +50%');
      }
      setText(K('wallet'), usd(m.wallet));
      setText(K('salary2'), usd(D.salary(st)));
      setText(K('next'), fmtTime(D.payEvery(st) - m.payT));
      fill(K('paybar'), m.payT / D.payEvery(st));
      setText(K('budget'), usd(defs.reduce((a, d) => a + (m.budget[d.id] || 0), 0)));
      setText(K('spent'), usd(m.stats.spent));
    },
  };
}

// ---------------- Research ----------------
export function mountResearch(root) {
  const st = S.st, ROW = 88, H = ROW * 6;
  const NB = D.BRANCHES.length, pos = r => ({ x: ((r.br + 0.5) / NB) * 100, y: r.t * ROW + 40 });
  const lines = [];
  for (const r of D.RESEARCH) for (const q of r.req || []) {
    const a = pos(D.RESEARCH.find(x => x.id === q)), b = pos(r);
    lines.push(`<line data-l="${q}>${r.id}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`);
  }
  let sel = D.RESEARCH.find(r => D.canResearch(st, r))?.id || 'f1';
  root.innerHTML = `
    <section class="res-head">
      <div><h2>Research</h2><p class="muted small">Gamer knowledge. Earn 💡 Insight from level-ups, prestiges and trophies.</p></div>
      <div class="ins-big">💡 <b data-k="ins"></b></div>
    </section>
    <div class="branches">${D.BRANCHES.map(b => `<span style="--c:${b.color}">${b.name}</span>`).join('')}</div>
    <div class="tree" style="height:${H}px">
      <svg class="tree-lines" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">${lines.join('')}</svg>
      ${D.RESEARCH.map(r => {
        const p = pos(r), c = r.id === 'cap' ? '#ffffff' : D.BRANCHES[r.br].color;
        return `<button class="rnode${r.id === 'cap' ? ' cap' : ''}" data-r="${r.id}" style="left:${p.x}%;top:${p.y}px;--c:${c}" aria-label="${r.name}"><span>${r.icon}</span><i>${r.cost}</i></button>`;
      }).join('')}
    </div>
    <div class="res-detail" data-k="detail"></div>`;
  const detail = root.querySelector('[data-k="detail"]');
  function renderDetail() {
    detail.hidden = !sel;
    if (!sel) return;
    const r = D.RESEARCH.find(x => x.id === sel), done = D.has(st, r.id), can = D.canResearch(st, r);
    const need = (r.req || []).filter(q => !D.has(st, q)).map(q => D.RESEARCH.find(x => x.id === q).name);
    detail.innerHTML = `
      <div class="rd-icon" style="--c:${r.id === 'cap' ? '#fff' : D.BRANCHES[r.br].color}">${r.icon}</div>
      <div class="rd-mid"><b>${r.name}</b><p>${r.desc}</p>${need.length ? `<small>Requires ${need.join(', ')}</small>` : ''}</div>
      <button class="big-btn sm" data-act="buy" ${done || !can ? 'disabled' : ''}>${done ? 'Learned ✓' : `💡 ${r.cost}`}</button>`;
  }
  root.onclick = e => {
    const n = e.target.closest('[data-r]');
    if (n) { sel = n.dataset.r === sel ? null : n.dataset.r; renderDetail(); return; }
    if (e.target.closest('[data-act="buy"]') && sel) {
      const r = D.RESEARCH.find(x => x.id === sel);
      if (!D.canResearch(st, r) || st.meta.insight < r.cost) return;
      st.meta.insight -= r.cost;
      st.meta.research[r.id] = true;
      const b = root.querySelector(`[data-r="${r.id}"]`).getBoundingClientRect();
      burst(b.left + b.width / 2, b.top + b.height / 2, [D.BRANCHES[Math.floor(r.br)]?.color || '#fff', '#fff'], 28);
      sel = D.RESEARCH.find(x => D.canResearch(st, x))?.id || sel;
      renderDetail();
    }
  };
  renderDetail();
  return {
    update() {
      setText(root.querySelector('[data-k="ins"]'), fmt(st.meta.insight));
      for (const r of D.RESEARCH) {
        const el = root.querySelector(`[data-r="${r.id}"]`), done = D.has(st, r.id), can = D.canResearch(st, r);
        toggle(el, 'done', done);
        toggle(el, 'avail', can);
        toggle(el, 'afford', can && st.meta.insight >= r.cost);
        toggle(el, 'sel', r.id === sel);
      }
      root.querySelectorAll('[data-l]').forEach(l => { const [, b] = l.dataset.l.split('>'); toggle(l, 'lit', D.has(st, l.dataset.l.split('>')[0]) && (D.has(st, b) || D.canResearch(st, D.RESEARCH.find(x => x.id === b)))); });
      const btn = detail.querySelector('button'), r = D.RESEARCH.find(x => x.id === sel);
      if (sel && btn && !D.has(st, sel)) { btn.disabled = !D.canResearch(st, r); toggle(btn, 'off', st.meta.insight < r.cost); }
    },
  };
}

// ---------------- Gear ----------------
export function mountGear(root) {
  const st = S.st, m = st.meta;
  root.innerHTML = `
    <section class="res-head"><div><h2>Gear</h2><p class="muted small">Real-life upgrades for a serious gamer. Paid from your wallet.</p></div><div class="ins-big money">💵 <b data-k="wallet"></b></div></section>
    <div class="list">${D.GEAR.map(it => `
      <div class="row gear" data-g="${it.id}">
        <div class="row-icon">${it.icon}</div>
        <div class="row-mid"><div class="row-name">${it.name} <em data-k="lv"></em></div><div class="row-sub">${it.desc} per level</div><div class="pips" data-k="pips"></div></div>
        <button class="buy money" data-act="buy"><b data-k="cost"></b></button>
      </div>`).join('')}</div>
    <p class="note center">Money spent on gear is money not spent on gems. Choose wisely. Or don't, it's your wallet.</p>`;
  root.onclick = e => {
    const b = e.target.closest('[data-act="buy"]');
    if (!b) return;
    const it = D.GEAR.find(x => x.id === b.closest('[data-g]').dataset.g), lv = m.gear[it.id] || 0, c = D.gearCost(st, it);
    if (lv >= it.max || m.wallet < c) return;
    m.wallet = Math.round((m.wallet - c) * 100) / 100;
    m.gear[it.id] = lv + 1;
    burst(e.clientX, e.clientY, ['#3ddc84', '#fff']);
  };
  return {
    update() {
      setText(root.querySelector('[data-k="wallet"]'), usd(m.wallet));
      for (const it of D.GEAR) {
        const el = root.querySelector(`[data-g="${it.id}"]`), lv = m.gear[it.id] || 0, max = lv >= it.max, c = D.gearCost(st, it);
        setText(el.querySelector('[data-k="lv"]'), `Lv ${lv}/${it.max}`);
        setText(el.querySelector('[data-k="cost"]'), max ? 'Maxed' : usd(c));
        toggle(el.querySelector('.buy'), 'off', max || m.wallet < c);
        const pips = el.querySelector('[data-k="pips"]');
        if (pips.childElementCount !== it.max) pips.innerHTML = '<i></i>'.repeat(it.max);
        [...pips.children].forEach((p, i) => toggle(p, 'on', i < lv));
      }
    },
  };
}

// ---------------- Trophies ----------------
export function mountTrophies(root) {
  const st = S.st, m = st.meta;
  root.innerHTML = `
    <section class="res-head"><div><h2>Trophies</h2><p class="muted small">Each one is worth 💡 Insight and +2% speed in every game.</p></div><div class="ins-big gold">🏆 <b data-k="count"></b></div></section>
    <div class="lvl-line"><span>⭐ Level <b data-k="lv"></b></span><span data-k="lvxp"></span></div>
    <div class="trophies">${D.ACH.map(a => `<div class="trophy" data-a="${a.id}"><span>${a.icon}</span><b>${a.name}</b><small>${a.desc}</small><i>+${a.insight} 💡</i></div>`).join('')}</div>
    <section class="panel">
      <div class="panel-h"><span>📊 Stats</span></div>
      <div data-k="stats"></div>
    </section>
    <p class="center"><button class="ghost danger" data-act="wipe">Delete save and start over</button></p>`;
  root.onclick = e => {
    if (!e.target.closest('[data-act="wipe"]')) return;
    modal((card, close) => {
      card.innerHTML = `<h2>Start over?</h2><p class="muted">Every game, level, trophy and dollar goes away. This can't be undone.</p><div class="pay-btns"><button class="ghost" data-x>Keep playing</button><button class="big-btn danger" data-ok>Delete everything</button></div>`;
      card.querySelector('[data-x]').onclick = close;
      card.querySelector('[data-ok]').onclick = wipe;
    });
  };
  return {
    update() {
      setText(root.querySelector('[data-k="count"]'), `${Object.keys(m.ach).length}/${D.ACH.length}`);
      setText(root.querySelector('[data-k="lv"]'), String(m.level));
      setText(root.querySelector('[data-k="lvxp"]'), `${fmt(m.xp)} / ${fmt(D.xpNeed(m.level))} XP to level ${m.level + 1}`);
      D.ACH.forEach(a => toggle(root.querySelector(`[data-a="${a.id}"]`), 'got', !!m.ach[a.id]));
      const s = m.stats, rows = [
        ['Level', m.level], ['Taps', fmt(s.taps)], ['Loot drops opened', s.loot], ['Legendaries', s.legend],
        ['Prestiges', s.prestiges], ['Paychecks', s.paydays], ['Real money spent', usd(s.spent)], ['Login streak', `${m.streak.n} days`],
      ];
      const html = rows.map(([k, v]) => `<div class="sum-line"><span>${k}</span><b>${v}</b></div>`).join('');
      const el = root.querySelector('[data-k="stats"]');
      if (el.innerHTML !== html) el.innerHTML = html;
    },
  };
}
