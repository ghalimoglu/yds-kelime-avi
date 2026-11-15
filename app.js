'use strict';
/* =========================================================
   YDS Kelime Avı — tamamen çevrimdışı çalışan kelime oyunu
   ========================================================= */

// ---------- Veri ----------
const CATS = {
  v: { name: 'Fiiller', em: '⚡', color: 'var(--v)' },
  n: { name: 'İsimler', em: '📦', color: 'var(--n)' },
  a: { name: 'Sıfatlar', em: '🎨', color: 'var(--a)' },
  r: { name: 'Zarflar', em: '🚀', color: 'var(--r)' },
  c: { name: 'Bağlaçlar', em: '🔗', color: 'var(--c)' },
  p: { name: 'Phrasal V.', em: '🧩', color: 'var(--p)' },
};
const LEVELS = { 1: 'Kolay', 2: 'Orta', 3: 'Zor' };

const WORDS = window.YDS_RAW.trim().split('\n').map((line, i) => {
  const [en, tr, cat, lvl, ex, syn, tip, grp] = line.split('|');
  return {
    id: en, i, en, tr, cat, lvl: +lvl, ex, tip: tip || '', grp: grp || '',
    syn: (syn || '').split(',').map(s => s.trim()).filter(Boolean),
  };
});
const BY_ID = Object.fromEntries(WORDS.map(w => [w.id, w]));

// ---------- Kayıt (localStorage) ----------
const KEY = 'yds_avi_v1';
const INTERVALS = [0, 1, 2, 4, 7, 15, 30]; // kutuya göre kaç gün sonra tekrar
const today = () => {
  const d = new Date();
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
};
let S = load();
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.words) return Object.assign(defaults(), s);
  } catch (e) {}
  return defaults();
}
function defaults() {
  return { words: {}, xp: 0, streak: 0, lastDay: null, best: 0, newPerDay: 6, sound: true, totalSessions: 0 };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
const ws = id => S.words[id] || (S.words[id] = { b: 0, due: 0, c: 0, w: 0, seen: false });

function grade(id, ok) {
  const s = ws(id);
  s.seen = true;
  // Aynı gün içinde kutu en fazla bir kez yükselir (gerçek kalıcı ezber için)
  if (ok) { s.c++; if (s.lt !== today()) s.b = Math.min(s.b + 1, INTERVALS.length - 1); }
  else { s.w++; s.b = 1; }
  s.lt = today();
  s.due = today() + INTERVALS[s.b];
  save();
}
const isMastered = id => (S.words[id] && S.words[id].b >= 4);

// ---------- Rütbe ----------
const RANKS = [
  [0, 'Çaylak', '🐣'], [150, 'Kelime Avcısı', '🏹'], [400, 'Sözlük Kurdu', '🐛'],
  [800, 'Cümle Ustası', '🧠'], [1400, 'Akademisyen', '🎓'], [2200, 'YDS Efsanesi', '👑'],
];
function rank(xp = S.xp) {
  let r = RANKS[0], next = null;
  for (let k = 0; k < RANKS.length; k++) {
    if (xp >= RANKS[k][0]) { r = RANKS[k]; next = RANKS[k + 1] || null; }
  }
  return { name: r[1], em: r[2], from: r[0], to: next ? next[0] : null };
}

// ---------- Yardımcılar ----------
const $ = (sel, el = document) => el.querySelector(sel);
const app = $('#app');
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1600);
}

// İki kelime aynı boşluğa uyabilir mi? (çeldirici seçerken kaçınılır)
function related(a, b) {
  if (a.grp && a.grp === b.grp) return true;
  const low = x => x.toLowerCase();
  if (a.syn.map(low).includes(low(b.en)) || b.syn.map(low).includes(low(a.en))) return true;
  const first = w => w.tr.split(',')[0].trim();
  return first(a) === first(b);
}
function distractors(word, n = 3) {
  const cands = WORDS.filter(w => w.cat === word.cat && w !== word && !related(word, w));
  // aynı seviyeyi tercih et, biraz da rastgelelik
  const scored = shuffle(cands).sort((x, y) => Math.abs(x.lvl - word.lvl) - Math.abs(y.lvl - word.lvl));
  return scored.slice(0, n);
}
function exampleHTML(w) {
  const parts = w.ex.split('___');
  const ans = parts[0].trim() === '' ? cap(w.en) : w.en;
  return esc(parts[0]) + '<b>' + esc(ans) + '</b>' + esc(parts[1] || '');
}
function exampleText(w) {
  const parts = w.ex.split('___');
  return parts[0] + (parts[0].trim() === '' ? cap(w.en) : w.en) + (parts[1] || '');
}

// ---------- Ses ----------
let actx = null;
function beep(type) {
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const seq = type === 'ok' ? [[660, 0], [880, .09]] : type === 'win' ? [[523, 0], [659, .1], [784, .2], [1046, .3]] : [[220, 0], [180, .12]];
    seq.forEach(([f, t]) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type === 'bad' ? 'sawtooth' : 'triangle';
      o.frequency.value = f;
      const st = actx.currentTime + t;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(type === 'bad' ? 0.06 : 0.15, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.18);
      o.connect(g).connect(actx.destination);
      o.start(st); o.stop(st + 0.2);
    });
  } catch (e) {}
}
let enVoice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  enVoice = vs.find(v => /en[-_]US/i.test(v.lang) && /Samantha|Alex|Google/i.test(v.name)) ||
    vs.find(v => /en[-_](US|GB)/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function say(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; u.rate = 0.9;
  if (enVoice) u.voice = enVoice;
  speechSynthesis.speak(u);
}

// ---------- Konfeti ----------
function confetti() {
  const c = $('#confetti'), x = c.getContext('2d');
  c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio;
  x.scale(devicePixelRatio, devicePixelRatio);
  const cols = ['#ffb020', '#ff6fd8', '#2fd18a', '#6aa9ff', '#a66bff', '#fff'];
  const ps = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2, y: innerHeight * 0.35, vx: (Math.random() - .5) * 14, vy: Math.random() * -14 - 4,
    s: Math.random() * 7 + 4, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[Math.random() * cols.length | 0],
  }));
  let f = 0;
  (function tick() {
    x.clearRect(0, 0, innerWidth, innerHeight);
    ps.forEach(p => {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore();
    });
    if (++f < 180) requestAnimationFrame(tick); else x.clearRect(0, 0, innerWidth, innerHeight);
  })();
}

// ---------- Sürükle-bırak (iOS dahil dokunmatik uyumlu) ----------
// opts: { dropSel, onDrop(targetEl), onTap() }
function draggable(el, opts) {
  let sx, sy, ghost = null, over = null, id = null;
  el.addEventListener('pointerdown', e => {
    if (el.classList.contains('used')) return;
    id = e.pointerId; sx = e.clientX; sy = e.clientY;
    el.setPointerCapture(id);
  });
  el.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    if (!ghost && Math.hypot(e.clientX - sx, e.clientY - sy) > 6) {
      ghost = el.cloneNode(true);
      ghost.classList.add('ghost-drag'); ghost.classList.remove('sel');
      document.body.appendChild(ghost);
      el.style.opacity = '.3';
    }
    if (ghost) {
      ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const d = t && t.closest(opts.dropSel);
      if (d !== over) { over && over.classList.remove('over'); over = d; over && over.classList.add('over'); }
    }
  });
  const end = e => {
    if (e.pointerId !== id) return;
    id = null;
    if (ghost) {
      ghost.remove(); ghost = null; el.style.opacity = '';
      if (over) { over.classList.remove('over'); const d = over; over = null; opts.onDrop(d); }
    } else if (e.type === 'pointerup') {
      opts.onTap && opts.onTap();
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

// =========================================================
// EKRANLAR
// =========================================================
function render(html) { app.innerHTML = '<div class="fade">' + html + '</div>'; window.scrollTo(0, 0); }

// ---------- Ana sayfa ----------
function dailyPlan() {
  const t = today();
  const due = WORDS.filter(w => S.words[w.id] && S.words[w.id].seen && S.words[w.id].due <= t)
    .sort((a, b) => S.words[a.id].due - S.words[b.id].due).slice(0, 10);
  // yeni kelimeler: kolaydan zora, kategorileri karıştırarak
  const unseen = WORDS.filter(w => !(S.words[w.id] && S.words[w.id].seen));
  const fresh = [];
  for (const lv of [1, 2, 3]) {
    const pool = unseen.filter(w => w.lvl === lv);
    const byCat = {};
    pool.forEach(w => (byCat[w.cat] = byCat[w.cat] || []).push(w));
    const cats = Object.keys(byCat);
    let k = 0;
    while (fresh.length < S.newPerDay && cats.some(c => byCat[c].length)) {
      const c = cats[k++ % cats.length];
      if (byCat[c].length) fresh.push(byCat[c].shift());
    }
    if (fresh.length >= S.newPerDay) break;
  }
  return { due, fresh };
}

function home() {
  const r = rank();
  const pct = r.to ? Math.round((S.xp - r.from) / (r.to - r.from) * 100) : 100;
  const doneToday = S.lastDay === today();
  const { due, fresh } = dailyPlan();
  const mastered = WORDS.filter(w => isMastered(w.id)).length;
  const seen = WORDS.filter(w => S.words[w.id] && S.words[w.id].seen).length;
  const streakAlive = S.lastDay === today() || S.lastDay === today() - 1;

  const catRows = Object.entries(CATS).map(([k, c]) => {
    const all = WORDS.filter(w => w.cat === k);
    const m = all.filter(w => isMastered(w.id)).length;
    const s = all.filter(w => S.words[w.id] && S.words[w.id].seen).length;
    return `<div class="catrow"><div><span class="dot" style="background:${c.color}"></span>${c.name}</div>
      <div class="progress"><i style="width:${s / all.length * 100}%;background:${c.color};opacity:.45;position:relative">
      </i></div><div class="small mute" style="text-align:right">${m}/${all.length}</div></div>`;
  }).join('');

  render(`
    <div class="topbar">
      <div class="pill">🔥 ${streakAlive ? S.streak : 0} <span class="small mute">gün</span></div>
      <div class="pill">💎 ${S.xp} XP</div>
      <button class="iconbtn" id="settings">⚙️</button>
    </div>

    <div class="card hero">
      <div class="badge" style="background:#ffffff26">${r.em} ${r.name}</div>
      <h2>${doneToday ? 'Bugünkü görev tamam! 🎉' : 'Bugünün görevi'}</h2>
      <p>${doneToday
        ? 'Yarın yeni kelimeler seni bekliyor. İstersen serbest oyunla devam et.'
        : `${fresh.length} yeni kelime · ${due.length} tekrar · ~10 dakika`}</p>
      <button class="big" id="daily">${doneToday ? 'Bir tur daha oyna' : 'Başla ▶'}</button>
      <div class="row" style="margin-top:14px;gap:8px">
        <div class="progress grow" style="background:#0003"><i style="width:${pct}%;background:#fff"></i></div>
        <span class="small" style="opacity:.85">${r.to ? (r.to - S.xp) + ' XP → sonraki rütbe' : 'Zirvedesin!'}</span>
      </div>
    </div>

    <div class="grid2" style="margin-bottom:14px">
      <button class="tile" data-mode="sentence"><div class="em">🧲</div><b>Cümleye Sürükle</b><span>Kelimeyi boşluğa taşı</span></button>
      <button class="tile" data-mode="match"><div class="em">🔀</div><b>Eşleştir</b><span>İngilizce ↔ Türkçe</span></button>
      <button class="tile" data-mode="speed"><div class="em">⏱️</div><b>Hız Turu</b><span>60 saniye, kaç doğru?</span></button>
      <button class="tile" data-mode="learn"><div class="em">🃏</div><b>Kartlar</b><span>İpuçlarıyla öğren</span></button>
    </div>

    <div class="card">
      <div class="row between" style="margin-bottom:6px">
        <h3>İlerleme</h3>
        <button class="small" id="list" style="color:var(--accent);font-weight:800">Kelime listesi ›</button>
      </div>
      <div class="small mute" style="margin-bottom:6px">${seen} kelime görüldü · ${mastered} kelime ezberlendi / ${WORDS.length}</div>
      ${catRows}
    </div>
  `);
  $('#daily').onclick = () => startDaily();
  $('#settings').onclick = settings;
  $('#list').onclick = () => wordList('all');
  app.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => freeSetup(b.dataset.mode));
}

// ---------- Oturum motoru ----------
// Bir oturum = adımlar dizisi. Her adım bir oyun ekranı.
let SES = null;
function newSession(steps, title) {
  SES = { steps, idx: 0, xp: 0, correct: 0, wrong: 0, combo: 0, bestCombo: 0, title, learned: new Set(), daily: false };
  nextStep();
}
function nextStep() {
  if (SES.idx >= SES.steps.length) return finish();
  const st = SES.steps[SES.idx++];
  st();
}
function addXP(n) { SES.xp += n; }
function hit(id) {
  SES.correct++; SES.combo++; SES.bestCombo = Math.max(SES.bestCombo, SES.combo);
  const bonus = SES.combo >= 3 ? 5 : 0;
  addXP(10 + bonus);
  if (id) { grade(id, true); SES.learned.add(id); }
  beep('ok');
  if (SES.combo === 3 || SES.combo === 6 || SES.combo === 10) toast(`🔥 ${SES.combo} combo! +bonus XP`);
}
function miss(id) {
  SES.wrong++; SES.combo = 0;
  if (id) { grade(id, false); SES.learned.add(id); }
  beep('bad');
}
// Uygulama içi onay penceresi (confirm() iOS ana ekran uygulamasında çirkin duruyor)
function ask(msg, yes, danger) {
  return new Promise(res => {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="modal-box"><p>${msg}</p><div class="grid2">
      <button class="big ghost" data-a="0">Vazgeç</button>
      <button class="big ${danger ? 'badb' : ''}" data-a="1">${yes}</button></div></div>`;
    document.body.appendChild(m);
    m.onclick = e => {
      const b = e.target.closest('[data-a]');
      if (!b && e.target !== m) return;
      m.remove(); res(b ? b.dataset.a === '1' : false);
    };
  });
}
function quit() {
  const ses = SES;
  ask('Oturumdan çıkmak istiyor musun?<br><span class="mute">Kazandığın XP kaydedilecek.</span>', 'Çık').then(ok => {
    if (!ok || SES !== ses) return;
    if (ses.timer) clearInterval(ses.timer);
    S.xp += ses.xp; save(); SES = null; home();
  });
}
function head(progress) {
  return `<div class="gamehead">
    <button class="close" id="quit">✕</button>
    <div class="progress"><i style="width:${Math.round(progress * 100)}%"></i></div>
    <div class="combo">${SES.combo >= 2 ? '🔥' + SES.combo : ''}</div>
  </div>`;
}
function bindQuit() { const q = $('#quit'); if (q) q.onclick = quit; }

function intro(em, title, text, btn = 'Hadi!') {
  return () => {
    render(`<div class="step-intro"><div class="em">${em}</div><h2>${title}</h2><p>${text}</p>
      <button class="big" id="go">${btn}</button></div>`);
    $('#go').onclick = nextStep;
  };
}

function startDaily() {
  const { due, fresh } = dailyPlan();
  let pool = [...fresh, ...due];
  // tekrar yoksa ve yeni de bittiyse rastgele görülmüş kelimelerle oyna
  if (pool.length < 4) {
    const seen = shuffle(WORDS.filter(w => S.words[w.id] && S.words[w.id].seen));
    pool = [...pool, ...seen].slice(0, 8);
  }
  if (pool.length < 4) pool = [...pool, ...shuffle(WORDS)].slice(0, 6);
  pool = [...new Map(pool.map(w => [w.id, w])).values()];

  const steps = [];
  if (fresh.length) {
    steps.push(intro('🦉', 'Yeni kelimelerle tanış', `Bugün <b>${fresh.length}</b> yeni YDS kelimesi öğreneceksin. Kartı çevir, ipucunu oku, sesini dinle.`));
    steps.push(() => learnStep(fresh, 0));
  }
  const matchSet = shuffle(pool).slice(0, 6);
  steps.push(intro('🔀', 'Eşleştirme', 'İngilizce kelimeyi sürükleyip doğru Türkçe anlamın üstüne bırak. (Dokunarak da seçebilirsin.)'));
  steps.push(() => matchStep(matchSet));
  steps.push(intro('🧲', 'Cümleye yerleştir', 'YDS tam olarak bunu sorar: boşluğa hangi kelime gelir? Doğru kelimeyi cümledeki boşluğa sürükle.'));
  const sq = shuffle(pool).slice(0, 10);
  steps.push(() => sentenceStep(sq, 0));
  steps.push(intro('⏱️', 'Hız Turu', '60 saniye! Ne kadar çok doğru, o kadar çok XP. Düşünme, hisset!', 'Başlat'));
  const seenPool = WORDS.filter(w => S.words[w.id] && S.words[w.id].seen);
  steps.push(() => speedStep(seenPool.length >= 8 ? seenPool : [...seenPool, ...pool]));
  newSession(steps, 'Günlük görev');
  SES.daily = true;
}

// ---------- Serbest oyun seçimi ----------
let FREE = { cats: new Set(Object.keys(CATS)), lvls: new Set([1, 2, 3]) };
function freeSetup(mode) {
  const names = { sentence: '🧲 Cümleye Sürükle', match: '🔀 Eşleştir', speed: '⏱️ Hız Turu', learn: '🃏 Kartlar' };
  const draw = () => {
    const pool = WORDS.filter(w => FREE.cats.has(w.cat) && FREE.lvls.has(w.lvl));
    render(`
      <div class="gamehead"><button class="close" id="back">‹</button><h2 class="grow">${names[mode]}</h2></div>
      <div class="label">Kategori</div>
      <div class="seg" id="cats">${Object.entries(CATS).map(([k, c]) =>
        `<button data-c="${k}" class="${FREE.cats.has(k) ? 'on' : ''}">${c.em} ${c.name}</button>`).join('')}</div>
      <div class="label">Zorluk</div>
      <div class="seg" id="lvls">${Object.entries(LEVELS).map(([k, n]) =>
        `<button data-l="${k}" class="${FREE.lvls.has(+k) ? 'on' : ''}">${'★'.repeat(k)} ${n}</button>`).join('')}</div>
      <p class="mute">${pool.length} kelime seçili. Zor kelimeler ve hata yaptıkların öne çıkar.</p>
      <button class="big" id="go" ${pool.length < 4 ? 'disabled' : ''}>Oyna ▶</button>
    `);
    $('#back').onclick = home;
    app.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
      const k = b.dataset.c; FREE.cats.has(k) ? FREE.cats.delete(k) : FREE.cats.add(k); draw();
    });
    app.querySelectorAll('[data-l]').forEach(b => b.onclick = () => {
      const k = +b.dataset.l; FREE.lvls.has(k) ? FREE.lvls.delete(k) : FREE.lvls.add(k); draw();
    });
    $('#go').onclick = () => {
      // zayıf kelimeleri öne al
      const weight = w => { const s = S.words[w.id]; return s ? (s.b * 2 - s.w) + Math.random() * 3 : Math.random() * 3 - 1; };
      const sorted = pool.slice().sort((a, b) => weight(a) - weight(b));
      if (mode === 'sentence') newSession([() => sentenceStep(sorted.slice(0, 10), 0)], 'Cümle');
      if (mode === 'match') newSession([() => matchStep(shuffle(sorted.slice(0, 12)).slice(0, 6)), () => matchStep(shuffle(sorted.slice(6, 18)).slice(0, 6))].slice(0, sorted.length >= 10 ? 2 : 1), 'Eşleştir');
      if (mode === 'speed') newSession([() => speedStep(pool)], 'Hız');
      if (mode === 'learn') newSession([() => learnStep(sorted.slice(0, 8), 0)], 'Kartlar');
    };
  };
  draw();
}

// ---------- 1) Öğrenme kartları ----------
function learnStep(list, i) {
  if (i >= list.length) return nextStep();
  const w = list[i], c = CATS[w.cat];
  render(`
    ${head(i / list.length)}
    <div class="flip" id="flip"><div class="flip-in">
      <div class="face">
        <div class="row between"><span class="badge" style="color:${c.color}">${c.em} ${c.name}</span>
          <span class="badge lv${w.lvl}">${'★'.repeat(w.lvl)} ${LEVELS[w.lvl]}</span></div>
        <div class="word">${esc(w.en)}</div>
        <button class="speak" id="sp1">🔊 Dinle</button>
        <p class="hint" style="margin-top:22px">Anlamını tahmin et, sonra kartı çevir 👆</p>
      </div>
      <div class="face back">
        <div class="row between"><span class="badge" style="color:${c.color}">${c.em} ${c.name}</span>
          <button class="speak" id="sp2" style="margin:0">🔊</button></div>
        <div class="word" style="font-size:32px;margin-top:14px">${esc(w.en)}</div>
        <div class="tr">${esc(w.tr)}</div>
        ${w.syn.length ? `<div class="syn">≈ ${esc(w.syn.join(', '))}</div>` : ''}
        <div class="ex">“${exampleHTML(w)}”</div>
        ${w.tip ? `<div class="tip">💡 ${esc(w.tip)}</div>` : ''}
      </div>
    </div></div>
    <div id="btns"><button class="big ghost" id="turn">Kartı çevir</button></div>
  `);
  bindQuit();
  const flip = $('#flip');
  const turn = () => {
    if (flip.classList.contains('on')) return;
    flip.classList.add('on');
    say(w.en);
    $('#btns').innerHTML = `<div class="grid2"><button class="big ghost" id="new">🆕 Yeni öğrendim</button>
      <button class="big okb" id="knew">✅ Biliyordum</button></div>`;
    $('#new').onclick = () => { const s = ws(w.id); s.seen = true; s.b = Math.max(s.b, 1); s.due = today(); save(); addXP(3); learnStep(list, i + 1); };
    $('#knew').onclick = () => { const s = ws(w.id); s.seen = true; s.b = Math.max(s.b, 2); s.due = today() + INTERVALS[2]; save(); addXP(5); learnStep(list, i + 1); };
  };
  flip.onclick = e => { if (!e.target.closest('.speak')) turn(); };
  $('#turn').onclick = turn;
  $('#sp1').onclick = () => say(w.en);
  $('#sp2').onclick = () => say(exampleText(w));
}

// ---------- 2) Eşleştirme ----------
function matchStep(set) {
  if (set.length < 2) return nextStep();
  let left = set.length, mistakes = new Set(), selected = null;
  render(`
    ${head(0)}
    <div class="qtitle">Kelimeyi anlamına sürükle</div>
    <div class="pool" id="pool">${shuffle(set).map(w => `<div class="chip" data-id="${esc(w.id)}">${esc(w.en)}</div>`).join('')}</div>
    <div class="targets">${shuffle(set).map(w => `<div class="target" data-id="${esc(w.id)}">
      <div class="t">${esc(w.tr)}</div><div class="drop">?</div></div>`).join('')}</div>
  `);
  bindQuit();
  const bar = app.querySelector('.gamehead .progress i');
  const tryMatch = (chip, target) => {
    const id = chip.dataset.id;
    if (target.classList.contains('done')) return;
    if (target.dataset.id === id) {
      target.classList.add('done');
      target.querySelector('.drop').textContent = BY_ID[id].en;
      chip.classList.add('used'); chip.classList.remove('sel');
      say(BY_ID[id].en);
      if (mistakes.has(id)) { SES.combo = 0; beep('ok'); addXP(4); } else hit(id);
      left--;
      bar.style.width = ((set.length - left) / set.length * 100) + '%';
      if (left === 0) setTimeout(nextStep, 700);
    } else {
      if (!mistakes.has(id)) { mistakes.add(id); miss(id); } else beep('bad');
      target.classList.remove('badf'); void target.offsetWidth; target.classList.add('badf');
    }
    selected = null;
    app.querySelectorAll('.chip.sel').forEach(c => c.classList.remove('sel'));
  };
  app.querySelectorAll('.chip').forEach(chip => draggable(chip, {
    dropSel: '.target',
    onDrop: t => tryMatch(chip, t),
    onTap: () => {
      app.querySelectorAll('.chip.sel').forEach(c => c.classList.remove('sel'));
      selected = chip; chip.classList.add('sel'); say(BY_ID[chip.dataset.id].en);
    },
  }));
  app.querySelectorAll('.target').forEach(t => t.onclick = () => { if (selected) tryMatch(selected, t); });
}

// ---------- 3) Cümleye sürükle-bırak ----------
function sentenceStep(list, i) {
  if (i >= list.length) return nextStep();
  const w = list[i];
  const opts = shuffle([w, ...distractors(w, 3)]);
  const [pre, post] = w.ex.split('___');
  const atStart = pre.trim() === '';
  render(`
    ${head(i / list.length)}
    <div class="qtitle">${CATS[w.cat].em} Boşluğa hangisi gelir? <span class="badge lv${w.lvl}" style="margin-left:6px">${'★'.repeat(w.lvl)}</span></div>
    <div class="sentence">${esc(pre)}<span class="slot" id="slot">&nbsp;</span>${esc(post || '')}</div>
    <div class="chips">${opts.map(o => `<div class="chip" data-id="${esc(o.id)}">${esc(o.en)}</div>`).join('')}</div>
    <div class="feedback" id="fb"></div>
  `);
  bindQuit();
  const slot = $('#slot');
  let answered = false;
  const answer = chip => {
    if (answered) return;
    answered = true;
    const id = chip.dataset.id, ok = id === w.id;
    slot.textContent = atStart ? cap(BY_ID[id].en) : BY_ID[id].en;
    slot.classList.add(ok ? 'okf' : 'badf');
    chip.classList.add('used');
    app.querySelectorAll('.chip').forEach(c => c.style.pointerEvents = 'none');
    ok ? hit(w.id) : miss(w.id);
    const fb = $('#fb');
    fb.className = 'feedback ' + (ok ? 'ok' : 'bad');
    const picked = BY_ID[id];
    fb.innerHTML = `
      <h3>${ok ? ['Harika! 🎯', 'Süper! ✨', 'Tam isabet! 🔥', 'Aynen böyle! 💪'][Math.random() * 4 | 0] : 'Olmadı 😅'}</h3>
      <p>${ok ? '' : `Doğrusu: <b>${esc(w.en)}</b><br>`}<b>${esc(w.en)}</b> = ${esc(w.tr)}
      ${!ok ? `<br><span class="mute">(${esc(picked.en)} = ${esc(picked.tr)})</span>` : ''}
      ${w.tip ? `<br><span style="opacity:.85">💡 ${esc(w.tip)}</span>` : ''}</p>
      <div class="row"><button class="big ghost" id="spk" style="width:64px;flex:none">🔊</button>
      <button class="big ${ok ? 'okb' : 'badb'} grow" id="next">Devam</button></div>`;
    requestAnimationFrame(() => fb.classList.add('show'));
    if (!ok && list.filter(x => x === w).length < 2) list.push(w); // yanlışı tur sonunda bir kez daha sor
    $('#spk').onclick = () => say(exampleText(w));
    $('#next').onclick = () => sentenceStep(list, i + 1);
    if (ok) say(exampleText(w));
  };
  app.querySelectorAll('.chip').forEach(chip => draggable(chip, {
    dropSel: '#slot', onDrop: () => answer(chip), onTap: () => answer(chip),
  }));
}

// ---------- 4) Hız turu ----------
function speedStep(pool) {
  pool = pool.length >= 4 ? pool : WORDS;
  let time = 60, score = 0, last = null, timer = null, locked = false;
  const askQ = () => {
    let w; do { w = pool[Math.random() * pool.length | 0]; } while (w === last && pool.length > 1);
    last = w;
    const dir = Math.random() < 0.5; // true: EN→TR
    const opts = shuffle([w, ...distractors(w, 3)]);
    const box = $('#q');
    box.innerHTML = `
      <div class="qword" style="${dir ? '' : 'font-size:26px'}">${esc(dir ? w.en : w.tr)}</div>
      <div class="qsub">${dir ? 'Türkçesi hangisi?' : 'İngilizcesi hangisi?'}</div>
      <div class="opts">${opts.map(o => `<button class="opt" data-id="${esc(o.id)}">${esc(dir ? o.tr : o.en)}</button>`).join('')}</div>`;
    box.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      if (locked) return; locked = true;
      const ok = b.dataset.id === w.id;
      b.classList.add(ok ? 'okf' : 'badf');
      if (!ok) box.querySelector(`.opt[data-id="${CSS.escape(w.id)}"]`).classList.add('okf');
      if (ok) { score++; hit(null); } else miss(null);
      $('#sc').textContent = score;
      setTimeout(() => { locked = false; if (time > 0) askQ(); }, ok ? 350 : 1100);
    });
  };
  render(`
    ${head(0)}
    <div class="row between"><div class="pill">✅ <span id="sc">0</span></div><div class="timer" id="tm">60</div><div style="width:70px"></div></div>
    <div id="q"></div>
  `);
  bindQuit();
  const bar = app.querySelector('.gamehead .progress i');
  askQ();
  timer = SES.timer = setInterval(() => {
    if (!document.body.contains($('#tm'))) return clearInterval(timer);
    time--;
    $('#tm').textContent = time;
    bar.style.width = ((60 - time) / 60 * 100) + '%';
    if (time <= 10) $('#tm').classList.add('low');
    if (time <= 0) {
      clearInterval(timer);
      if (score > (S.best || 0)) { S.best = score; save(); toast('🏆 Yeni rekor: ' + score); }
      setTimeout(nextStep, 600);
    }
  }, 1000);
}

// ---------- Sonuç ----------
function finish() {
  const s = SES;
  let streakMsg = '';
  if (s.daily) {
    const t = today();
    if (S.lastDay !== t) {
      S.streak = S.lastDay === t - 1 ? S.streak + 1 : 1;
      S.lastDay = t;
      streakMsg = `🔥 ${S.streak} günlük seri!`;
      s.xp += 20; // günlük görev bonusu
    }
    S.totalSessions++;
  }
  const before = rank();
  S.xp += s.xp; save();
  const after = rank();
  const total = s.correct + s.wrong;
  const acc = total ? Math.round(s.correct / total * 100) : 100;
  const em = acc >= 90 ? '🏆' : acc >= 70 ? '🌟' : acc >= 50 ? '👍' : '💪';
  render(`
    <div class="result">
      <div class="em">${em}</div>
      <h2 style="font-size:30px;margin-top:8px">${acc >= 70 ? 'Muhteşem iş!' : 'Güzel çalıştın!'}</h2>
      ${streakMsg ? `<p style="font-size:20px;font-weight:800;color:var(--accent)">${streakMsg}</p>` : ''}
      ${after.name !== before.name ? `<p style="font-size:18px">Yeni rütbe: <b>${after.em} ${after.name}</b></p>` : ''}
      <div class="stats">
        <div class="stat"><b>+${s.xp}</b><span>XP</span></div>
        <div class="stat"><b>%${acc}</b><span>doğruluk</span></div>
        <div class="stat"><b>${s.bestCombo}</b><span>en iyi combo</span></div>
      </div>
      ${s.learned.size ? `<div class="card" style="text-align:left"><h3 style="margin-bottom:8px">Bu turdaki kelimeler</h3>
        ${[...s.learned].map(id => BY_ID[id]).map(w => `<div class="wl"><div class="grow"><div class="w">${esc(w.en)}</div>
        <div class="m">${esc(w.tr)}</div></div>${boxes(w.id)}</div>`).join('')}</div>` : ''}
      <button class="big" id="home">Ana sayfa</button>
    </div>`);
  confetti(); beep('win');
  $('#home').onclick = home;
  SES = null;
}
function boxes(id) {
  const b = (S.words[id] && S.words[id].b) || 0;
  return `<div class="boxes" title="Ezber seviyesi">${[1, 2, 3, 4, 5].map(k => `<i class="${b >= k ? 'f' : ''}"></i>`).join('')}</div>`;
}

// ---------- Kelime listesi ----------
function wordList(filter) {
  const list = WORDS.filter(w => filter === 'all' || w.cat === filter);
  render(`
    <div class="gamehead"><button class="close" id="back">‹</button><h2 class="grow">Kelime Listesi</h2></div>
    <div class="seg"><button data-f="all" class="${filter === 'all' ? 'on' : ''}">Tümü</button>
      ${Object.entries(CATS).map(([k, c]) => `<button data-f="${k}" class="${filter === k ? 'on' : ''}">${c.em} ${c.name}</button>`).join('')}</div>
    ${[1, 2, 3].map(lv => {
      const l = list.filter(w => w.lvl === lv);
      if (!l.length) return '';
      return `<div class="label" style="margin-top:14px">${'★'.repeat(lv)} ${LEVELS[lv]}</div>` + l.map(w => `
        <div class="wl" data-say="${esc(w.en)}"><div class="grow"><div class="w">${esc(w.en)}
          <span class="small" style="color:${CATS[w.cat].color}">· ${CATS[w.cat].name}</span></div>
          <div class="m">${esc(w.tr)}</div></div>${boxes(w.id)}</div>`).join('');
    }).join('')}
    <p class="small mute center" style="margin-top:20px">Yeşil çubuklar ezber seviyesini gösterir. 4+ çubuk = ezberlendi. Dinlemek için kelimeye dokun.</p>
  `);
  $('#back').onclick = home;
  app.querySelectorAll('[data-f]').forEach(b => b.onclick = () => wordList(b.dataset.f));
  app.querySelectorAll('[data-say]').forEach(b => b.onclick = () => say(b.dataset.say));
}

// ---------- Ayarlar ----------
function settings() {
  render(`
    <div class="gamehead"><button class="close" id="back">‹</button><h2 class="grow">Ayarlar</h2></div>
    <div class="card">
      <div class="label">Günde kaç yeni kelime?</div>
      <div class="seg" id="np">${[4, 6, 8, 10].map(n => `<button data-n="${n}" class="${S.newPerDay === n ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="label">Ses efektleri</div>
      <div class="seg"><button id="snd" class="${S.sound ? 'on' : ''}">${S.sound ? '🔊 Açık' : '🔇 Kapalı'}</button></div>
    </div>
    <div class="card small mute">
      <b style="color:var(--text)">Nasıl çalışır?</b><br>
      Her kelime 0–6 arası bir "ezber kutusunda" durur. Doğru bildikçe kutu yükselir ve kelime daha seyrek karşına çıkar
      (1, 2, 4, 7, 15, 30 gün). Yanlış yaparsan başa döner. Böylece her akşam ~10 dakikada hem yenileri öğrenir hem eskileri unutmazsın.
      <br><br>Tüm ilerleme bu cihazda saklanır, internet gerekmez.
      <br><br>En iyi hız turu skoru: <b style="color:var(--text)">${S.best || 0}</b> · Toplam günlük görev: <b style="color:var(--text)">${S.totalSessions}</b>
    </div>
    <button class="big badb" id="reset">İlerlemeyi sıfırla</button>
  `);
  $('#back').onclick = home;
  app.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { S.newPerDay = +b.dataset.n; save(); settings(); });
  $('#snd').onclick = () => { S.sound = !S.sound; save(); settings(); };
  $('#reset').onclick = () => {
    ask('Tüm ilerlemen, XP ve serin silinecek. Emin misin?', 'Sıfırla', true)
      .then(ok => { if (ok) { S = defaults(); save(); home(); } });
  };
}

// ---------- Başlat ----------
home();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
