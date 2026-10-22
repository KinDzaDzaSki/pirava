/* ПИРАВА · катастарска мапа — app logic */
(function () {
  'use strict';
  const D = window.PIRAVA, IT = D.items, CATS = D.cats, W = D.W, H = D.H, OX = D.ox, OY = D.oy;
  const C = ['#FF7A33', '#B08968', '#C9A227', '#7A8A3F', '#9C5A7A', '#3E7C74', '#6E6A63', '#4A4642'];
  const NS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);
  const fmt = (n, d = 0) => { const s = Number(n).toFixed(d), p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return p[1] ? p[0] + ',' + p[1] : p[0]; };

  const svg = $('svg'), gO = $('gOrtho'), gP = $('gP'), gA = $('gA'), gS = $('gS');
  const FULL = [-25, -25, W + 50, H + 50];
  let vb = FULL.slice();
  const state = { tab: 'all', cats: new Set([0, 1, 2, 3, 4, 5, 6, 7]), locs: new Set(), q: '', sel: -1, ortho: false };

  /* ---------------- parcels ---------------- */
  const paths = IT.map((it, i) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', it[13]); p.setAttribute('class', 'pc');
    p.setAttribute('fill', C[it[2]]); p.dataset.i = i;
    gP.appendChild(p); return p;
  });
  IT.forEach(it => {
    if (it[6] & 4) {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', it[7]); t.setAttribute('y', it[8] + 4);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '13');
      t.setAttribute('fill', '#fff'); t.setAttribute('opacity', '.95');
      t.setAttribute('stroke', '#000'); t.setAttribute('stroke-width', '.6');
      t.textContent = '★'; gS.appendChild(t);
    }
  });

  /* ---------------- orthophoto (AKN WMTS, EPSG:6316) ---------------- */
  const TLX = 7397000.634424793;
  const LEV = [[560, 4808622], [280, 4736942], [140, 4701102], [70, 4701102], [35, 4701102], [17.92, 4696228],
               [8.96, 4693934], [4.48, 4693934], [2.24, 4693934], [1.12, 4693934], [0.56, 4693934], [0.28, 4693862], [0.14, 4693862]];
  const tileURL = (z, c, r) => 'https://e-uslugi.katastar.gov.mk/geo/proxy/ortofoto23/wmts?layer=APP_DATA%3AORTOFOTO_2023' +
    '&tilematrixset=APP_GRID_ORTOFOTO_2023&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image%2Fjpeg' +
    '&TileMatrix=APP_GRID_ORTOFOTO_2023%3A' + z + '&TileCol=' + c + '&TileRow=' + r;

  let orthoTimer = null, orthoKey = '';
  function orthoPlan() {
    const px = svg.clientWidth || 900;
    const target = vb[2] / px;
    let z = 0, best = Infinity;
    LEV.forEach((l, i) => { const d = Math.abs(l[0] - target); if (d < best) { best = d; z = i; } });
    z = Math.max(4, Math.min(12, z));
    for (; z <= 12; z++) {
      const tm = 256 * LEV[z][0], tly = LEV[z][1];
      const X0 = vb[0] + OX, X1 = vb[0] + vb[2] + OX;
      const Nt = OY + H - vb[1], Nb = OY + H - (vb[1] + vb[3]);
      const c0 = Math.floor((X0 - TLX) / tm) - 1, c1 = Math.floor((X1 - TLX) / tm) + 1;
      const r0 = Math.floor((tly - Nt) / tm) - 1, r1 = Math.floor((tly - Nb) / tm) + 1;
      if ((c1 - c0 + 1) * (r1 - r0 + 1) <= 64 || z === 12) return { z, tm, tly, c0, c1, r0, r1 };
    }
    return null;
  }
  function orthoDraw(force) {
    if (!state.ortho) { gO.textContent = ''; orthoKey = ''; return; }
    const key = vb.map(v => Math.round(v / 2)).join(',');
    if (key === orthoKey && !force) return;
    orthoKey = key;
    const plan = orthoPlan(); if (!plan) return;
    const { z, tm, tly, c0, c1, r0, r1 } = plan;
    const frag = document.createDocumentFragment();
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) {
      if (r < 0) continue;
      const xw = TLX + c * tm, nTop = tly - r * tm;
      const im = document.createElementNS(NS, 'image');
      im.setAttribute('x', (xw - OX).toFixed(1));
      im.setAttribute('y', (H - (nTop - OY)).toFixed(1));
      im.setAttribute('width', tm); im.setAttribute('height', tm);
      im.setAttribute('preserveAspectRatio', 'none');
      im.setAttribute('href', tileURL(z, c, r));
      im.setAttribute('opacity', '0');
      im.addEventListener('load', () => im.setAttribute('opacity', '1'));
      frag.appendChild(im);
    }
    gO.textContent = ''; gO.appendChild(frag);
  }
  function orthoSoon(ms) { clearTimeout(orthoTimer); orthoTimer = setTimeout(() => orthoDraw(false), ms === undefined ? 180 : ms); }

  /* ---------------- minimap ---------------- */
  const mmW = 152, mmH = Math.round(152 * H / W);
  $('mini').innerHTML = '<svg width="' + mmW + '" height="' + mmH + '" viewBox="0 0 ' + W + ' ' + H + '">' +
    '<path d="' + D.minibg + '" fill="#2a2721" stroke="#37332b" stroke-width=".8"/>' +
    '<rect id="mrect" x="0" y="0" width="10" height="10" fill="none" stroke="#e0762f" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>';

  /* ---------------- view ---------------- */
  function setVB() {
    svg.setAttribute('viewBox', vb.join(' '));
    const r = document.getElementById('mrect');
    if (r) { r.setAttribute('x', vb[0]); r.setAttribute('y', vb[1]); r.setAttribute('width', vb[2]); r.setAttribute('height', vb[3]); }
    const bw = svg.clientWidth || 1, mPerPx = vb[2] / bw;
    const target = 110 * mPerPx, nice = [10, 20, 25, 50, 100, 200, 250, 500, 1000];
    let L = nice[0]; for (const n of nice) if (n <= target) L = n;
    $('sb').style.width = Math.round(L / mPerPx) + 'px';
    $('sbt').textContent = L >= 1000 ? (L / 1000) + ' km' : L + ' m';
    orthoSoon();
  }

  function fits(i) {
    const it = IT[i], f = it[6];
    if (state.tab === 'band' && !(f & 16)) return false;
    if (state.tab === 'five' && !(f & 8)) return false;
    if (state.tab === 'gz' && !(f & 4)) return false;
    if (!state.cats.has(it[2])) return false;
    if (state.locs.size && !state.locs.has(it[3])) return false;
    if (state.q) {
      const q = state.q.toLowerCase();
      if (!(String(it[0]).toLowerCase().includes(q) || (it[5] || '').toLowerCase().includes(q))) return false;
    }
    return true;
  }

  let cur = [], prevActive = new Set();
  function apply() {
    cur = []; const nowActive = new Set();
    for (let i = 0; i < IT.length; i++) {
      const ok = fits(i);
      if (ok) { cur.push(i); nowActive.add(i); }
      paths[i].classList.toggle('dim', !ok);
      const was = prevActive.has(i);
      if (ok && !was) gA.appendChild(paths[i]);
      else if (!ok && was) gP.appendChild(paths[i]);
    }
    prevActive = nowActive;
    cur.sort((a, b) => IT[b][1] - IT[a][1]);
    const area = cur.reduce((s, i) => s + IT[i][1], 0);
    const med = cur.length ? IT[Math.floor(cur.length / 2)][1] : 0;
    $('c1').textContent = fmt(cur.length);
    $('c2').textContent = fmt(area / 10000, 2) + ' ha';
    $('c3').textContent = fmt(Math.round(med));
    $('resN').textContent = fmt(cur.length) + ' парцели';
    renderList();
  }

  function renderList() {
    const box = $('list'); box.innerHTML = ''; box.scrollTop = 0;
    const lim = Math.min(cur.length, 240);
    const frag = document.createDocumentFragment();
    for (let k = 0; k < lim; k++) {
      const i = cur[k], it = IT[i], d = document.createElement('div');
      d.className = 'row' + (i === state.sel ? ' on' : ''); d.dataset.i = i;
      d.innerHTML = '<span class="dot" style="background:' + C[it[2]] + '"></span><span class="mid"><span class="p">' + it[0] +
        ((it[6] & 4) ? ' <span style="color:#FF7A33">★</span>' : '') + '</span><span class="o">' + (it[5] || '—') +
        (it[3] ? ' · ' + it[3] : '') + '</span></span><span class="a">' + fmt(Math.round(it[1])) + '<i>m²</i></span>';
      d.onclick = () => { select(i, true); closeSheet(); };
      d.onmouseenter = () => paths[i].classList.add('sel');
      d.onmouseleave = () => { if (state.sel !== i) paths[i].classList.remove('sel'); };
      frag.appendChild(d);
    }
    box.appendChild(frag);
    if (cur.length > lim) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = '… уште ' + (cur.length - lim) + ' — зумирај или филтрирај'; box.appendChild(e); }
    if (!cur.length) { const e = document.createElement('div'); e.className = 'empty'; e.textContent = 'Нема резултати.'; box.appendChild(e); }
  }

  function select(i, zoom) {
    state.sel = i;
    paths.forEach((p, k) => p.classList.toggle('sel', k === i));
    [...document.querySelectorAll('.row')].forEach(r => r.classList.toggle('on', +r.dataset.i === i));
    const it = IT[i];
    const lat = (41.3169 + (H / 2 - it[8]) * 0.000009).toFixed(5);
    const lon = (22.5327 + (it[7] - W / 2) * 0.000010).toFixed(5);
    const card = $('dcard');
    card.classList.add('show');
    card.innerHTML = '<span class="x" id="dcx">✕</span><div class="t">парцела ' + it[0] + '</div>' +
      '<div class="sub">' + (it[3] || '—') + ' · ' + CATS[it[2]] + '</div>' +
      '<div class="r"><span>површина</span><b>' + fmt(it[1], 1) + ' м²</b></div>' +
      '<div class="r"><span>имотен лист</span><b>' + (it[4] || '—') + '</b></div>' +
      '<div class="r"><span>сопственик</span><b>' + (it[5] || '—') + '</b></div>' +
      '<div class="r"><span>статус</span><b>' + ((it[6] & 2) ? 'државна' : ((it[6] & 1) ? 'црковна' : 'приватна')) + '</b></div>' +
      '<div class="r"><span>координати</span><b>' + lat + ', ' + lon + '</b></div>' +
      '<div class="r"><span>карта</span><b><a target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + lat + ',' + lon + '">Google Maps ↗</a></b></div>';
    $('dcx').onclick = () => card.classList.remove('show');
    if (zoom) {
      const pad = Math.max(16, Math.max(it[11], it[12]) * 1.1);
      const w = Math.max(it[11] + pad * 2, 40), h = Math.max(it[12] + pad * 2, 40);
      vb = [it[9] + it[11] / 2 - w / 2, it[10] + it[12] / 2 - h / 2, w, h]; setVB();
    }
  }

  function fitSet(list) {
    if (!list.length) { vb = FULL.slice(); return setVB(); }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    list.forEach(i => { const it = IT[i]; x0 = Math.min(x0, it[9]); y0 = Math.min(y0, it[10]); x1 = Math.max(x1, it[9] + it[11]); y1 = Math.max(y1, it[10] + it[12]); });
    const pad = Math.max(30, (x1 - x0) * 0.07);
    let w = (x1 - x0) + 2 * pad, h = (y1 - y0) + 2 * pad;
    const cx = x0 + (x1 - x0) / 2, cy = y0 + (y1 - y0) / 2;
    const ar = (svg.clientWidth || 1) / (svg.clientHeight || 1);
    if (w / h > ar) h = w / ar; else w = h * ar;
    vb = [cx - w / 2, cy - h / 2, w, h]; setVB();
  }

  /* ---------------- pointers: pan + pinch ---------------- */
  const ptrs = new Map();
  let drag = null, pinch = null, downParcel = null, moved = false;

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  svg.addEventListener('pointerdown', e => {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { svg.setPointerCapture(e.pointerId); } catch (_) {}
    if (ptrs.size === 1) { drag = { x: e.clientX, y: e.clientY, vb: vb.slice() }; downParcel = e.target.closest('.pc'); moved = false; }
    else if (ptrs.size === 2) { const p = [...ptrs.values()]; pinch = { d: dist(p[0], p[1]), vb: vb.slice(), m: mid(p[0], p[1]) }; drag = null; }
  });

  svg.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = svg.getBoundingClientRect();
    if (ptrs.size >= 2 && pinch) {
      const p = [...ptrs.values()];
      const d = dist(p[0], p[1]);
      const k = pinch.d / Math.max(1, d);
      const mx = (pinch.m.x - r.left) / r.width, my = (pinch.m.y - r.top) / r.height;
      const nw = Math.min(W * 1.5, Math.max(14, pinch.vb[2] * k));
      const nh = pinch.vb[3] * (nw / pinch.vb[2]);
      const px = pinch.vb[0] + pinch.vb[2] * mx, py = pinch.vb[1] + pinch.vb[3] * my;
      vb = [px - nw * mx, py - nh * my, nw, nh]; setVB();
      moved = true; return;
    }
    if (!drag) return;
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) moved = true;
    vb = [drag.vb[0] - (e.clientX - drag.x) / r.width * drag.vb[2],
          drag.vb[1] - (e.clientY - drag.y) / r.height * drag.vb[3], drag.vb[2], drag.vb[3]];
    setVB();
  });

  function endPointer(e) {
    const had = ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (ptrs.size === 0) {
      const wasDrag = moved, target = downParcel;
      drag = null; downParcel = null; moved = false;
      if (!wasDrag && had) { const t = target || e.target.closest('.pc'); if (t) select(+t.dataset.i, false); }
    }
  }
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);

  svg.addEventListener('mousemove', e => {
    if (window.matchMedia('(max-width:860px)').matches) return;
    const t = e.target.closest('.pc');
    if (!t) { $('tip').style.opacity = 0; return; }
    const it = IT[+t.dataset.i];
    $('tip').innerHTML = '<b>' + it[0] + '</b> · ' + fmt(Math.round(it[1])) + ' m²<br><span style="opacity:.72">' +
      CATS[it[2]] + ' · ' + (it[3] || '—') + '</span>';
    const r = $('map').getBoundingClientRect();
    $('tip').style.opacity = 1;
    $('tip').style.left = Math.min(e.clientX - r.left + 16, r.width - 230) + 'px';
    $('tip').style.top = Math.min(e.clientY - r.top + 16, r.height - 64) + 'px';
  });
  svg.addEventListener('mouseleave', () => { $('tip').style.opacity = 0; });

  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width, my = (e.clientY - r.top) / r.height;
    const k = e.deltaY > 0 ? 1.25 : 0.8;
    const nw = Math.min(W * 1.4, Math.max(16, vb[2] * k)), nh = vb[3] * (nw / vb[2]);
    const px = vb[0] + vb[2] * mx, py = vb[1] + vb[3] * my;
    vb = [px - nw * mx, py - nh * my, nw, nh]; setVB();
  }, { passive: false });

  const zoomBy = f => { const ar = vb[3] / vb[2]; const w = vb[2] * f, h = w * ar; vb = [vb[0] + vb[2] / 2 - w / 2, vb[1] + vb[3] / 2 - h / 2, w, h]; setVB(); };
  $('zin').onclick = () => zoomBy(0.7);
  $('zout').onclick = () => zoomBy(1.4);
  $('zfit').onclick = () => { vb = FULL.slice(); setVB(); };

  /* ---------------- filters ---------------- */
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('on')); b.classList.add('on');
    state.tab = b.dataset.tab; apply(); fitSet(cur);
  });
  $('q').oninput = e => { state.q = e.target.value.trim(); apply(); };

  CATS.forEach((c, ci) => {
    const n = IT.filter(it => it[2] === ci).length;
    const b = document.createElement('button'); b.className = 'chip';
    b.innerHTML = '<span class="sw" style="background:' + C[ci] + '"></span>' + c + ' <b>' + n + '</b>';
    b.onclick = () => { state.cats.has(ci) ? state.cats.delete(ci) : state.cats.add(ci); b.classList.toggle('off', !state.cats.has(ci)); apply(); };
    $('cats').appendChild(b);
    const L = document.createElement('div');
    L.innerHTML = '<i style="background:' + C[ci] + '"></i>' + c + ' <b style="color:#948d82;font-weight:500">' + n + '</b>';
    $('legend').appendChild(L);
  });

  const locCount = new Map();
  IT.forEach(it => { if (it[3]) locCount.set(it[3], (locCount.get(it[3]) || 0) + 1); });
  [...locCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 9).forEach(([L, n]) => {
    const b = document.createElement('button'); b.className = 'chip';
    b.innerHTML = L + ' <b>' + n + '</b>';
    b.onclick = () => { state.locs.has(L) ? state.locs.delete(L) : state.locs.add(L); b.classList.toggle('off', !state.locs.has(L)); apply(); };
    $('locs').appendChild(b);
  });

  /* ---------------- orthophoto toggle ---------------- */
  $('orthoBtn').onclick = () => {
    state.ortho = !state.ortho;
    $('orthoBtn').classList.toggle('on', state.ortho);
    document.body.classList.toggle('ortho-on', state.ortho);
    orthoDraw(true);
  };

  /* ---------------- export ---------------- */
  $('exp').onclick = () => {
    const head = ['Парцела', 'Површина (m2)', 'Користење', 'Месност', 'Имотен лист', 'Сопственик', 'Статус'];
    const rows = cur.map(i => {
      const it = IT[i];
      return [it[0], it[1], CATS[it[2]], it[3], it[4], it[5], (it[6] & 2) ? 'државна' : ((it[6] & 1) ? 'црковна' : 'приватна')];
    });
    const csv = '\ufeff' + [head].concat(rows).map(r => r.join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'pirava_' + state.tab + '_' + cur.length + '.csv';
    a.click();
  };

  /* ---------------- mobile sheet ---------------- */
  const aside = $('aside');
  const openSheet = () => aside.classList.add('open');
  const closeSheet = () => aside.classList.remove('open');
  $('fab').onclick = () => aside.classList.toggle('open');
  $('handle').onclick = closeSheet;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { $('dcard').classList.remove('show'); closeSheet(); }
  });
  $('mini').addEventListener('click', e => {
    const r = $('mini').getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    vb = [x - vb[2] / 2, y - vb[3] / 2, vb[2], vb[3]]; setVB();
  });

  /* ---------------- boot ---------------- */
  const n = (k) => IT.filter(i => i[6] & k).length;
  $('nAll').textContent = fmt(IT.length);
  $('nBand').textContent = n(16);
  $('nFive').textContent = n(8);
  $('nGz').textContent = n(4);
  apply(); setVB();
  $('loader').classList.add('hide');
  setTimeout(() => { const l = $('loader'); if (l) l.remove(); }, 500);
})();
