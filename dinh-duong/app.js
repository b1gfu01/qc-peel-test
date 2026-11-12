'use strict';

/* ================== LƯU TRỮ ==================
 * Giữ nguyên khoá và cấu trúc dữ liệu của bản 1 để không mất dữ liệu cũ.
 * Bản 2 chỉ THÊM các trường tuỳ chọn: food.emoji, day.water, day.note, day.feel, settings.waterTarget.
 */
const STORE_KEY = 'dinhduong-phuoc-v1';
const SAFE_KEY = STORE_KEY + '-truoc-v2';     // bản sao giữ nguyên lúc nâng cấp lên giao diện mới
const SAFE_AT_KEY = SAFE_KEY + '-luc';

// Sao lưu tự động một lần trước khi bản mới ghi bất cứ thứ gì
try {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw && !localStorage.getItem(SAFE_KEY)) {
    localStorage.setItem(SAFE_KEY, raw);
    localStorage.setItem(SAFE_AT_KEY, new Date().toISOString());
  }
} catch (e) { /* bỏ qua */ }

function makeDefaultFoods() {
  return DEFAULT_FOODS.map(([name, kcal, protein, cat], i) => ({ id: 'f' + (i + 1), name, kcal, protein, cat }));
}

function loadState() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { /* bỏ qua */ }
  if (!s || typeof s !== 'object') s = {};
  return {
    ...s,
    settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) },
    foods: Array.isArray(s.foods) ? s.foods : makeDefaultFoods(),
    days: s.days || {},
    weights: s.weights || {},
  };
}

let state = loadState();

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('Không lưu được dữ liệu! Hãy xuất file sao lưu.');
  }
}

/* ================== TIỆN ÍCH ================== */
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmt = (n, d = 0) => Number(n).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
const r1 = (n) => Math.round(n * 10) / 10;
const fmtQ = (q) => fmt(q, q % 1 ? 1 : 0);
const num = (v) => parseFloat(String(v).replace(',', '.'));
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

function toKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function fromKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(k, n) {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
}
const todayKey = () => toKey(new Date());
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEKDAYS_LONG = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
function prettyDate(k, withWeekday = true) {
  const d = fromKey(k);
  const s = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  return withWeekday ? WEEKDAYS[d.getDay()] + ' ' + s : s;
}
function mondayOf(k) {
  const d = fromKey(k);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toKey(d);
}
function currentMealKey() {
  const h = new Date().getHours();
  return h < 10 ? 'sang' : h < 14 ? 'trua' : h < 17 ? 'xe' : h < 21 ? 'toi' : 'phu';
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- Icon món ---------- */
function iconForName(name, cat) {
  const n = norm(name);
  for (const [re, e] of ICON_RULES) if (re.test(n)) return e;
  return CATEGORY_ICONS[cat] || '🍽️';
}
const foodById = (id) => state.foods.find((f) => f.id === id);
const foodIcon = (f) => f.emoji || iconForName(f.name, f.cat);
function entryIcon(it) {
  const f = it.foodId && foodById(it.foodId);
  return f ? foodIcon(f) : iconForName(it.name);
}

/* ================== DỮ LIỆU NGÀY ================== */
function getDay(k, create = false) {
  let d = state.days[k];
  if (!d && create) d = state.days[k] = { meals: {}, trained: false };
  if (d && !d.meals) d.meals = {};
  return d;
}

function mealTotals(items) {
  return (items || []).reduce((a, it) => {
    a.kcal += it.kcal * it.qty;
    a.protein += it.protein * it.qty;
    return a;
  }, { kcal: 0, protein: 0 });
}

function dayTotals(k) {
  const d = getDay(k);
  const res = { kcal: 0, protein: 0, lunchProtein: 0, items: 0, trained: !!(d && d.trained) };
  if (!d) return res;
  for (const m of MEALS) {
    const items = d.meals[m.key] || [];
    const t = mealTotals(items);
    res.kcal += t.kcal;
    res.protein += t.protein;
    res.items += items.length;
    if (m.key === 'trua') res.lunchProtein = t.protein;
  }
  return res;
}

function dayStatus(t) {
  const S = state.settings;
  if (!t.items) return 'st-empty';
  if (t.kcal > S.tdee) return 'st-warn';
  if (t.kcal >= S.kcalTarget - 150) return 'st-ok';
  return 'st-light';
}

function loggingStreak() {
  let k = todayKey();
  if (!dayTotals(k).items) k = addDays(k, -1);
  let n = 0;
  while (dayTotals(k).items) { n++; k = addDays(k, -1); }
  return n;
}

/* ================== ĐIỀU HƯỚNG TAB ================== */
let currentTab = 'today';
document.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
function showTab(name) {
  currentTab = name;
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + name));
  render();
  window.scrollTo(0, 0);
}

function renderHeader() {
  const h = new Date().getHours();
  const greet = h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  $('#hello').textContent = `${greet}, ${state.settings.name} 👋`;
  const d = new Date();
  $('#helloSub').textContent = `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}`;
  const st = loggingStreak();
  $('#streak').hidden = st < 2;
  $('#streak').textContent = `🔥 ${st} ngày`;
  $('#streak').title = `Ghi nhật ký ${st} ngày liên tục`;
}

function render() {
  renderHeader();
  if (currentTab === 'today') renderToday();
  else if (currentTab === 'weight') renderWeight();
  else if (currentTab === 'week') renderWeek();
  else if (currentTab === 'settings') renderSettings();
}

/* ================== TAB HÔM NAY ================== */
let selDay = todayKey();
function selectDay(k) { selDay = k; renderToday(); }

$('#dayPicker').addEventListener('change', (e) => { if (e.target.value) selectDay(e.target.value); });
$('#monthLabel').addEventListener('click', () => {
  const p = $('#dayPicker');
  try { p.showPicker(); } catch (e) { p.click(); }
});
$('#goToday').addEventListener('click', () => selectDay(todayKey()));
document.querySelectorAll('[data-week-move]').forEach((b) => b.addEventListener('click', () => {
  selectDay(addDays(selDay, 7 * Number(b.dataset.weekMove)));
}));
$('#weekStrip').addEventListener('click', (e) => {
  const b = e.target.closest('[data-day]');
  if (b) selectDay(b.dataset.day);
});

function renderToday() {
  renderHeader();
  $('#dayPicker').value = selDay;
  renderStrip();
  const t = dayTotals(selDay);
  renderHero(t);
  renderAlerts(t);
  renderProteinHelper(t);
  renderMeals();
  renderJournal();
  renderTip();
}

function renderStrip() {
  const d = fromKey(selDay);
  $('#monthLabel').textContent = `Tháng ${d.getMonth() + 1}, ${d.getFullYear()} ▾`;
  $('#goToday').hidden = selDay === todayKey();
  const mon = mondayOf(selDay);
  const today = todayKey();
  let html = '';
  for (let i = 0; i < 7; i++) {
    const k = addDays(mon, i);
    const cls = ['sday', dayStatus(dayTotals(k))];
    if (k === selDay) cls.push('sel');
    if (k === today) cls.push('today');
    if (k > today) cls.push('future');
    html += `<button class="${cls.join(' ')}" data-day="${k}"><span class="wd">${WEEKDAYS[fromKey(k).getDay()]}</span><span class="dn">${fromKey(k).getDate()}</span><span class="dot"></span></button>`;
  }
  $('#weekStrip').innerHTML = html;
}

function ringSvg(pct, size, stroke, color, track) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - p)).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"
      style="transition: stroke-dashoffset .5s ease"/>
  </svg>`;
}

function renderHero(t) {
  const S = state.settings;
  const st = dayStatus(t);
  const remain = Math.round(S.kcalTarget - t.kcal);
  const pPct = t.protein / S.protein;
  const pLeft = Math.max(0, S.protein - t.protein);
  const isToday = selDay === todayKey();
  const badge = !t.items ? 'Chưa nhập bữa nào'
    : st === 'st-warn' ? '⚠️ Trên mức duy trì — nhắc nhẹ'
    : st === 'st-ok' ? '✅ Quanh mục tiêu'
    : '🌿 Đang thâm hụt nhẹ';

  const hero = $('#hero');
  hero.className = 'hero ' + (st === 'st-warn' ? 'st-warn' : '');
  hero.innerHTML = `
    <div class="hero-top">
      <div class="ring-wrap">
        ${ringSvg(t.kcal / S.kcalTarget, 136, 13, '#ffffff', 'rgba(255,255,255,.22)')}
        <div class="ring-center">
          <div class="ring-num">${fmt(Math.abs(remain))}</div>
          <div class="ring-sub">${remain >= 0 ? 'kcal còn lại' : 'kcal vượt mục tiêu'}</div>
        </div>
      </div>
      <div class="hero-stats">
        <div><div class="hs-label">${isToday ? 'Hôm nay đã ăn' : prettyDate(selDay) + ' đã ăn'}</div><div class="hs-val">${fmt(t.kcal)} <small>kcal</small></div></div>
        <div><div class="hs-label">Mục tiêu</div><div class="hs-val">${fmt(S.kcalTarget)} <small>/ TDEE ${fmt(S.tdee)}</small></div></div>
        <div><span class="hero-badge">${badge}</span></div>
      </div>
    </div>
    <div class="hero-macros">
      <div>
        <div class="hs-label">💪 Đạm</div>
        <div class="hs-val">${fmt(t.protein)}<small> / ${S.protein}g</small></div>
        <div class="hbar p"><i style="width:${Math.min(100, pPct * 100)}%"></i></div>
      </div>
      <div>
        <div class="hs-label">${pLeft > 0 ? 'Còn thiếu' : 'Đạm hôm nay'}</div>
        <div class="hs-val">${pLeft > 0 ? fmt(pLeft) + '<small> g đạm</small>' : 'Đủ rồi ✅'}</div>
        <div class="hs-label" style="margin-top:6px">Trưa: <b>${fmt(t.lunchProtein)}g</b> / ${S.lunchProteinMin}g</div>
      </div>
    </div>`;
}

function renderAlerts(t) {
  const S = state.settings;
  const alerts = [];
  const now = new Date();
  const isToday = selDay === todayKey();
  const past = selDay < todayKey();
  const dayOver = past || (isToday && now.getHours() >= 21);
  const lunchItems = (getDay(selDay)?.meals.trua || []).length;
  if ((lunchItems || (isToday && now.getHours() >= 14) || past) && t.items && t.lunchProtein < S.lunchProteinMin) {
    alerts.push(['warn', '🍱', `Trưa thiếu đạm (${fmt(t.lunchProtein)}g < ${S.lunchProteinMin}g) — thủ xúc xích ức gà / trứng đi làm.`]);
  }
  if (t.kcal > S.tdee) {
    alerts.push(['warn', '🙂', 'Hôm nay trên mức duy trì. Không sao — giảm mỡ tính theo trung bình tuần, mai ăn bình thường lại.']);
  }
  if (dayOver && t.items && t.kcal < S.minKcal) {
    alerts.push(['bad', '⚠️', `Dưới ${fmt(S.minKcal)} kcal — thâm hụt quá sâu dễ mất cơ, tụt chuyển hoá. Đừng cắt cực đoan.`]);
  }
  if (t.trained && t.items && (dayOver || now.getHours() >= 18) && t.kcal < S.kcalTarget - 250) {
    alerts.push(['info', '🥊', `Ngày tập nên ăn đủ ~${fmt(S.kcalTarget)} kcal để hồi phục, đừng để hụt sâu.`]);
  }
  $('#dayAlerts').innerHTML = alerts.map(([c, i, m]) => `<div class="alert ${c}"><span class="a-ico">${i}</span><span>${m}</span></div>`).join('');
}

// Gợi ý bù đạm: món giàu đạm/ít calo vừa với số calo còn lại
function renderProteinHelper(t) {
  const S = state.settings;
  const pLeft = S.protein - t.protein;
  const isToday = selDay === todayKey();
  const box = $('#proteinHelper');
  if (!isToday || !t.items || pLeft < 15 || new Date().getHours() < 11) { box.innerHTML = ''; return; }
  const room = Math.max(200, S.kcalTarget - t.kcal + 100);
  const picks = state.foods
    .filter((f) => f.protein >= 8 && f.kcal > 0 && f.kcal <= room)
    .sort((a, b) => b.protein / b.kcal - a.protein / a.kcal)
    .slice(0, 6);
  if (!picks.length) { box.innerHTML = ''; return; }
  const mk = currentMealKey();
  const ml = MEALS.find((m) => m.key === mk).label;
  box.innerHTML = `<div class="helper">
    <div class="helper-title">💡 Còn thiếu ${fmt(pLeft)}g đạm — bù nhanh vào bữa ${ml}:</div>
    <div class="chips">${picks.map((f) => `<button class="hchip" data-helper="${f.id}"><span style="font-size:20px">${foodIcon(f)}</span><span>${esc(shortName(f.name))}<br><b>+${fmt(f.protein, f.protein % 1 ? 1 : 0)}g</b> · ${fmt(f.kcal)} kcal</span></button>`).join('')}</div>
  </div>`;
}
$('#proteinHelper').addEventListener('click', (e) => {
  const b = e.target.closest('[data-helper]');
  if (!b) return;
  const f = foodById(b.dataset.helper);
  const mk = currentMealKey();
  addEntry(selDay, mk, f, 1);
  toast(`Đã thêm ${f.name} vào bữa ${MEALS.find((m) => m.key === mk).label}`);
  renderToday();
});

function renderMeals() {
  const day = getDay(selDay);
  const prev = getDay(addDays(selDay, -1));
  $('#mealList').innerHTML = MEALS.map((m) => {
    const items = (day && day.meals[m.key]) || [];
    const mt = mealTotals(items);
    const rows = items.map((it) => `
      <div class="item" data-edit="${m.key}|${it.id}">
        <span class="food-ico">${entryIcon(it)}</span>
        <div class="item-main">
          <div class="item-name">${esc(it.name)}${it.qty !== 1 ? ` <span class="q">× ${fmtQ(it.qty)}</span>` : ''}</div>
        </div>
        <div class="item-kcal">${fmt(it.kcal * it.qty)}<small>${fmt(r1(it.protein * it.qty), 1)}g đạm</small></div>
      </div>`).join('');
    const prevItems = (prev && prev.meals[m.key]) || [];
    const copy = !items.length && prevItems.length
      ? `<button class="chip copy" data-copy="${m.key}">↺ Giống hôm trước (${fmt(mealTotals(prevItems).kcal)} kcal)</button>` : '';
    const quick = quickFoods(m.key, items).map((f) =>
      `<button class="chip" data-quick="${m.key}|${f.id}">${foodIcon(f)} ${esc(shortName(f.name))}</button>`).join('');
    return `
      <div class="card meal">
        <div class="meal-head">
          <span class="meal-ico m-${m.key}">${m.icon}</span>
          <div class="meal-info">
            <h3>${m.label}</h3>
            <div class="meal-totals">${items.length ? `<b>${fmt(mt.kcal)} kcal</b> · ${fmt(mt.protein)}g đạm` : 'Chưa nhập'}</div>
          </div>
          <button class="add-btn" data-add="${m.key}" aria-label="Thêm món vào bữa ${m.label}">+</button>
        </div>
        ${rows ? `<div class="items">${rows}</div>` : ''}
        ${copy || quick ? `<div class="quick">${copy}${quick}</div>` : ''}
      </div>`;
  }).join('');
}

function shortName(n) {
  const s = n.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  return s.length > 24 ? s.slice(0, 22) + '…' : s;
}

// Gợi ý nhanh: món hay dùng nhất cho từng bữa (theo lịch sử), chưa có trong bữa hiện tại
function quickFoods(mealKey, currentItems) {
  const count = {};
  for (const d of Object.values(state.days)) {
    for (const it of ((d.meals || {})[mealKey] || [])) {
      if (it.foodId) count[it.foodId] = (count[it.foodId] || 0) + 1;
    }
  }
  const have = new Set(currentItems.map((i) => i.foodId));
  const ids = Object.keys(count).sort((a, b) => count[b] - count[a]);
  if (mealKey === 'sang' && !ids.includes('f9')) ids.unshift('f9'); // cà phê sữa mỗi ngày
  return ids.filter((id) => !have.has(id)).map(foodById).filter(Boolean).slice(0, 3);
}

function addEntry(dayKey, mealKey, food, qty) {
  const d = getDay(dayKey, true);
  (d.meals[mealKey] = d.meals[mealKey] || []).push({
    id: uid(), foodId: food.id, name: food.name, kcal: Number(food.kcal), protein: Number(food.protein), qty,
  });
  save();
}

$('#mealList').addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) return openAddDialog(add.dataset.add);

  const q = e.target.closest('[data-quick]');
  if (q) {
    const [mk, fid] = q.dataset.quick.split('|');
    const f = foodById(fid);
    if (f) { addEntry(selDay, mk, f, 1); toast('Đã thêm ' + f.name); renderToday(); }
    return;
  }

  const cp = e.target.closest('[data-copy]');
  if (cp) {
    const mk = cp.dataset.copy;
    const src = getDay(addDays(selDay, -1)).meals[mk] || [];
    const d = getDay(selDay, true);
    d.meals[mk] = (d.meals[mk] || []).concat(src.map((it) => ({ ...it, id: uid() })));
    save();
    toast(`Đã chép ${src.length} món từ hôm trước`);
    renderToday();
    return;
  }

  const ed = e.target.closest('[data-edit]');
  if (ed) {
    const [mk, id] = ed.dataset.edit.split('|');
    openEditDialog(mk, id);
  }
});

/* ---------- Nhật ký ngày: nước, tập, cảm giác, ghi chú ---------- */
function glassSvg(full) {
  return `<svg viewBox="0 0 34 42" aria-hidden="true">
    <path d="M4 3h26l-3 35a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3Z" fill="${full ? 'var(--water-soft)' : 'none'}" stroke="${full ? 'var(--water)' : 'var(--line)'}" stroke-width="2.2" stroke-linejoin="round"/>
    ${full ? '<path d="M6.4 14h21.2l-2.2 23.6a2 2 0 0 1-2 1.9H10.6a2 2 0 0 1-2-1.9Z" fill="var(--water)"/>' : ''}
  </svg>`;
}

function renderJournal() {
  const S = state.settings;
  const d = getDay(selDay) || {};
  const water = d.water || 0;
  const target = S.waterTarget || 8;
  const glasses = Array.from({ length: Math.max(target, water) }, (_, i) =>
    `<button class="glass" data-water="${i + 1}" aria-label="${i + 1} ly">${glassSvg(i < water)}</button>`).join('');
  $('#journal').innerHTML = `
    <div class="card">
      <h2 class="card-title">📝 Nhật ký ngày</h2>
      <div class="j-section">
        <div class="water-meta"><span class="j-label" style="margin:0">💧 Nước uống</span><span><b>${fmt(water * 0.25, water % 4 ? 2 : 0)}</b> / ${fmt(target * 0.25, target % 4 ? 2 : 0)} lít</span></div>
        <div class="water-row">${glasses}<button class="glass" data-water="${water + 1}" aria-label="Thêm 1 ly" style="font-size:20px;color:var(--muted)">＋</button></div>
      </div>
      <div class="j-section toggle-row">
        <div><div class="j-label" style="margin:0">🥊 Có tập hôm nay</div><div class="muted">Boxing + finisher kháng lực</div></div>
        <label class="switch"><input type="checkbox" id="trainedToggle" ${d.trained ? 'checked' : ''}><span></span></label>
      </div>
      <div class="j-section">
        <div class="j-label">Cảm giác hôm nay</div>
        <div class="feels">${FEELINGS.map((f) => `<button class="feel ${d.feel === f.key ? 'on' : ''}" data-feel="${f.key}"><span>${f.icon}</span>${f.label}</button>`).join('')}</div>
      </div>
      <div class="j-section">
        <div class="j-label">Ghi chú</div>
        <textarea id="dayNote" placeholder="vd: ngủ 5 tiếng, ăn tiệc cưới, đau vai, ăn mặn…">${esc(d.note || '')}</textarea>
      </div>
    </div>`;
}

$('#journal').addEventListener('click', (e) => {
  const w = e.target.closest('[data-water]');
  if (w) {
    const d = getDay(selDay, true);
    const n = Number(w.dataset.water);
    d.water = (d.water || 0) === n ? n - 1 : n;
    save();
    renderJournal();
    return;
  }
  const f = e.target.closest('[data-feel]');
  if (f) {
    const d = getDay(selDay, true);
    d.feel = d.feel === f.dataset.feel ? undefined : f.dataset.feel;
    save();
    renderJournal();
  }
});
$('#journal').addEventListener('change', (e) => {
  if (e.target.id !== 'trainedToggle') return;
  getDay(selDay, true).trained = e.target.checked;
  save();
  renderToday();
});
let noteTimer;
$('#journal').addEventListener('input', (e) => {
  if (e.target.id !== 'dayNote') return;
  const k = selDay;
  const v = e.target.value;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => {
    const d = getDay(k, true);
    if (v.trim()) d.note = v; else delete d.note;
    save();
  }, 400);
});

function renderTip() {
  const d = fromKey(selDay);
  const idx = Math.floor(d.getTime() / 86400000) % TIPS.length;
  $('#tipCard').innerHTML = `<div class="tip"><span class="tip-ico">🧠</span><div><div class="tip-title">Mẹo của Fu hôm nay</div><div class="tip-text">${TIPS[idx]}</div></div></div>`;
}

/* ---------- Hộp thêm món ---------- */
const addDlg = $('#addDialog');
let addMeal = 'sang';
let picked = null;
let addCat = '';

function openAddDialog(mealKey) {
  addMeal = mealKey;
  picked = null;
  addCat = '';
  const m = MEALS.find((x) => x.key === mealKey);
  $('#addTitle').textContent = `${m.icon} Thêm vào bữa ${m.label}`;
  $('#foodSearch').value = '';
  $('#pickedBox').hidden = true;
  $('#newFoodBox').open = false;
  ['#nfName', '#nfKcal', '#nfProtein'].forEach((s) => { $(s).value = ''; });
  renderCatChips();
  renderSuggest();
  addDlg.showModal();
}

function renderCatChips() {
  const cats = ['', 'Hay ăn', ...FOOD_CATEGORIES.filter((c) => state.foods.some((f) => (f.cat || 'Món tự thêm') === c))];
  $('#catChips').innerHTML = cats.map((c) =>
    `<button type="button" class="chip ${addCat === c ? 'on' : ''}" data-cat="${esc(c)}">${c === '' ? 'Tất cả' : c === 'Hay ăn' ? '⭐ Hay ăn' : (CATEGORY_ICONS[c] || '') + ' ' + esc(c)}</button>`).join('');
}
$('#catChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  addCat = b.dataset.cat;
  renderCatChips();
  renderSuggest();
});

function usageCounts() {
  const count = {};
  for (const d of Object.values(state.days)) {
    for (const items of Object.values(d.meals || {})) {
      for (const it of items) if (it.foodId) count[it.foodId] = (count[it.foodId] || 0) + 1;
    }
  }
  return count;
}

function renderSuggest() {
  const q = norm($('#foodSearch').value.trim());
  const words = q.split(/\s+/).filter(Boolean);
  let list = state.foods.filter((f) => words.every((w) => norm(f.name).includes(w)));
  let html = '';
  if (addCat === 'Hay ăn') {
    const count = usageCounts();
    list = list.filter((f) => count[f.id]).sort((a, b) => count[b.id] - count[a.id]).slice(0, 20);
    html = list.map(sgRow).join('') || '<div class="sg-group">Chưa có món nào hay ăn</div>';
  } else if (addCat) {
    html = list.filter((f) => (f.cat || 'Món tự thêm') === addCat).map(sgRow).join('');
  } else if (!q) {
    for (const cat of FOOD_CATEGORIES) {
      const fs = list.filter((f) => (f.cat || 'Món tự thêm') === cat);
      if (fs.length) html += `<div class="sg-group">${CATEGORY_ICONS[cat] || ''} ${esc(cat)}</div>` + fs.map(sgRow).join('');
    }
  } else {
    html = list.slice(0, 30).map(sgRow).join('');
  }
  if (q) {
    $('#nfName').value = $('#foodSearch').value.trim();
    if (!list.length) {
      html = '<div class="sg-group">Không thấy món — thêm món mới ở dưới 👇</div>';
      $('#newFoodBox').open = true;
    }
  }
  $('#foodSuggest').innerHTML = html;
}
function sgRow(f) {
  return `<button type="button" class="sg" data-pick="${f.id}"><span class="food-ico">${foodIcon(f)}</span><span class="sg-name">${esc(f.name)}</span><span class="meta"><b>${fmt(f.kcal)} kcal</b>${fmt(f.protein, f.protein % 1 ? 1 : 0)}g đạm</span></button>`;
}
$('#foodSearch').addEventListener('input', renderSuggest);
$('#foodSearch').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const first = $('#foodSuggest [data-pick]');
    if (first) first.click();
  }
});
$('#foodSuggest').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pick]');
  if (!b) return;
  picked = foodById(b.dataset.pick);
  $('#pickedIcon').textContent = foodIcon(picked);
  $('#pickedName').textContent = picked.name;
  $('#qtyInput').value = 1;
  $('#pickedBox').hidden = false;
  updatePicked();
  $('#pickedBox').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});
function getQty(sel) {
  const n = num($(sel).value);
  return n > 0 ? n : 0;
}
function updatePicked() {
  if (!picked) return;
  const q = getQty('#qtyInput');
  $('#pickedTotal').textContent = `= ${fmt(picked.kcal * q)} kcal · ${fmt(r1(picked.protein * q), 1)}g đạm`;
}
$('#qtyInput').addEventListener('input', updatePicked);
$('#qtyMinus').addEventListener('click', () => { $('#qtyInput').value = Math.max(0.5, getQty('#qtyInput') - 0.5); updatePicked(); });
$('#qtyPlus').addEventListener('click', () => { $('#qtyInput').value = getQty('#qtyInput') + 0.5; updatePicked(); });
$('#confirmAdd').addEventListener('click', () => {
  const q = getQty('#qtyInput');
  if (!picked || !q) return toast('Chọn món và số lượng');
  addEntry(selDay, addMeal, picked, q);
  addDlg.close();
  toast('Đã thêm ' + picked.name);
  renderToday();
});
$('#nfAdd').addEventListener('click', () => {
  const name = $('#nfName').value.trim();
  const kcal = num($('#nfKcal').value);
  const protein = num($('#nfProtein').value) || 0;
  if (!name || !(kcal >= 0)) return toast('Nhập tên và calo');
  const food = { id: 'u' + uid(), name, kcal, protein, cat: 'Món tự thêm' };
  state.foods.push(food);
  addEntry(selDay, addMeal, food, 1);
  addDlg.close();
  toast('Đã lưu vào thư viện & thêm');
  renderToday();
});

/* ---------- Hộp sửa món đã nhập ---------- */
const editDlg = $('#editDialog');
let editing = null; // { mk, id }
$('#edMeal').innerHTML = MEALS.map((m) => `<option value="${m.key}">${m.icon} ${m.label}</option>`).join('');

function editItem() {
  const d = getDay(selDay);
  return d && (d.meals[editing.mk] || []).find((x) => x.id === editing.id);
}
function openEditDialog(mk, id) {
  editing = { mk, id };
  const it = editItem();
  if (!it) return;
  $('#edIcon').textContent = entryIcon(it);
  $('#edName').textContent = it.name;
  $('#edQty').value = it.qty;
  $('#edMeal').value = mk;
  updateEdit();
  editDlg.showModal();
}
function updateEdit() {
  const it = editItem();
  const q = getQty('#edQty');
  $('#edTotal').textContent = `= ${fmt(it.kcal * q)} kcal · ${fmt(r1(it.protein * q), 1)}g đạm`;
}
$('#edQty').addEventListener('input', updateEdit);
$('#edMinus').addEventListener('click', () => { $('#edQty').value = Math.max(0.5, getQty('#edQty') - 0.5); updateEdit(); });
$('#edPlus').addEventListener('click', () => { $('#edQty').value = getQty('#edQty') + 0.5; updateEdit(); });
$('#edSave').addEventListener('click', () => {
  const it = editItem();
  const q = getQty('#edQty');
  if (!q) return toast('Số lượng không hợp lệ');
  it.qty = q;
  const to = $('#edMeal').value;
  if (to !== editing.mk) {
    const d = getDay(selDay);
    d.meals[editing.mk] = d.meals[editing.mk].filter((x) => x.id !== it.id);
    (d.meals[to] = d.meals[to] || []).push(it);
  }
  save();
  editDlg.close();
  toast('Đã cập nhật');
  renderToday();
});
$('#edDelete').addEventListener('click', () => {
  const d = getDay(selDay);
  const it = editItem();
  d.meals[editing.mk] = d.meals[editing.mk].filter((x) => x.id !== editing.id);
  save();
  editDlg.close();
  toast('Đã xoá ' + it.name);
  renderToday();
});

/* ================== TAB CÂN NẶNG ================== */
let wRange = 90;
function weightKeysSorted() {
  return Object.keys(state.weights).sort();
}
// Trung bình cân trong 7 ngày kết thúc tại endKey
function avg7(endKey) {
  const start = addDays(endKey, -6);
  const vals = weightKeysSorted().filter((k) => k >= start && k <= endKey).map((k) => state.weights[k].kg);
  return vals.length ? { avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length } : null;
}

$('#wRange').addEventListener('click', (e) => {
  const b = e.target.closest('[data-range]');
  if (!b) return;
  wRange = Number(b.dataset.range);
  document.querySelectorAll('#wRange button').forEach((x) => x.classList.toggle('on', x === b));
  renderWeight();
});

$('#weightForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const k = $('#wDate').value;
  const kg = num($('#wKg').value);
  if (!k || !(kg > 0)) return;
  const bf = num($('#wBf').value);
  const waist = num($('#wWaist').value);
  state.weights[k] = { kg, ...(bf > 0 ? { bf } : {}), ...(waist > 0 ? { waist } : {}) };
  save();
  toast('Đã lưu cân ' + fmt(kg, 1) + ' kg');
  $('#wKg').value = ''; $('#wBf').value = ''; $('#wWaist').value = '';
  renderWeight();
});
$('#weightList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-wdel]');
  if (!b) return;
  if (!confirm('Xoá lần cân ngày ' + prettyDate(b.dataset.wdel) + '?')) return;
  delete state.weights[b.dataset.wdel];
  save();
  renderWeight();
});

function renderWeight() {
  const S = state.settings;
  if (!$('#wDate').value) $('#wDate').value = todayKey();
  const keys = weightKeysSorted();
  const today = todayKey();
  const a = avg7(today);
  const aPrev = avg7(addDays(today, -7));
  const lastKey = keys[keys.length - 1];
  const last = lastKey ? state.weights[lastKey] : null;
  const lastBf = [...keys].reverse().map((k) => state.weights[k].bf).find((v) => v > 0);
  const lastWaist = [...keys].reverse().map((k) => state.weights[k].waist).find((v) => v > 0);
  const d7 = a && aPrev ? a.avg - aPrev.avg : null;
  const fromStart = a ? a.avg - S.startWeight : null;

  // Tiến độ % mỡ: từ khởi điểm về cận trên của mục tiêu (vd "15–18" → 18)
  const goalNums = String(S.goalBodyFat).match(/[\d.,]+/g);
  const goalBf = goalNums ? num(goalNums[goalNums.length - 1]) : null;
  let bfProgress = '';
  if (lastBf && goalBf && S.startBodyFat > goalBf) {
    const pct = Math.max(0, Math.min(1, (S.startBodyFat - lastBf) / (S.startBodyFat - goalBf)));
    bfProgress = `<div class="progress-line">
      <div class="hs-label">Tiến độ % mỡ: ${fmt(S.startBodyFat, 1)}% → ${fmt(goalBf, 0)}% · đã đi <b>${fmt(pct * 100)}%</b> chặng</div>
      <div class="hbar"><i style="width:${pct * 100}%"></i></div></div>`;
  }

  $('#weightHero').innerHTML = `
    <div class="hs-label">Trung bình 7 ngày gần nhất</div>
    <div class="w-big">${a ? fmt(a.avg, 1) : '—'} <small>kg</small></div>
    <div style="margin-top:6px">${d7 !== null ? `<span class="hero-badge">${d7 <= 0 ? '▼' : '▲'} ${fmt(Math.abs(d7), 2)} kg so với 7 ngày trước</span>` : `<span class="hero-badge">${a ? a.n + ' lần cân trong 7 ngày' : 'Chưa có lần cân trong 7 ngày'}</span>`}</div>
    <div class="w-grid">
      <div class="w-tile"><div class="l">Lần cân gần nhất</div><div class="v">${last ? fmt(last.kg, 1) + ' kg' : '—'}</div><div class="s">${lastKey ? prettyDate(lastKey) : ''}</div></div>
      <div class="w-tile"><div class="l">So với khởi điểm ${fmt(S.startWeight, 1)}</div><div class="v">${fromStart === null ? '—' : (fromStart > 0 ? '+' : '') + fmt(fromStart, 1) + ' kg'}</div><div class="s">theo TB 7 ngày</div></div>
      <div class="w-tile"><div class="l">% mỡ gần nhất</div><div class="v">${lastBf ? fmt(lastBf, 1) + '%' : '—'}</div><div class="s">mục tiêu ${esc(S.goalBodyFat)}%</div></div>
      <div class="w-tile"><div class="l">Vòng eo</div><div class="v">${lastWaist ? fmt(lastWaist, 1) + ' cm' : '—'}</div><div class="s">${lastWaist ? 'lần đo gần nhất' : 'chưa đo'}</div></div>
    </div>
    ${bfProgress}`;

  const shown = wRange ? keys.filter((k) => k >= addDays(today, -wRange)) : keys;
  $('#weightChart').innerHTML = weightChartSvg(shown);

  $('#weightList').innerHTML = keys.length ? [...keys].reverse().slice(0, 60).map((k) => {
    const w = state.weights[k];
    const i = keys.indexOf(k);
    const prev = i > 0 ? state.weights[keys[i - 1]].kg : null;
    const dd = prev !== null ? w.kg - prev : null;
    const extra = [w.bf ? fmt(w.bf, 1) + '% mỡ' : '', w.waist ? 'eo ' + fmt(w.waist, 1) + 'cm' : ''].filter(Boolean).join(' · ');
    return `<div class="wrow">
      <span class="wd-date">${prettyDate(k)}</span>
      <span class="wd-kg">${fmt(w.kg, 1)}</span>
      ${dd !== null && Math.abs(dd) >= 0.05 ? `<span class="delta ${dd < 0 ? 'down' : 'up'}">${dd > 0 ? '+' : ''}${fmt(dd, 1)}</span>` : ''}
      <span class="wd-extra">${extra}</span>
      <button class="del-btn" data-wdel="${k}" aria-label="Xoá">✕</button></div>`;
  }).join('') : '<p class="muted">Chưa có lần cân nào.</p>';
}

function weightChartSvg(keys) {
  if (keys.length < 2) return '<p class="muted">Cần ít nhất 2 lần cân trong khoảng này để vẽ biểu đồ.</p>';
  const W = 600, H = 250, pl = 42, pr = 12, pt = 14, pb = 28;
  const t0 = fromKey(keys[0]).getTime();
  const span = Math.max(1, fromKey(keys[keys.length - 1]).getTime() - t0);
  const raw = keys.map((k) => ({ k, v: state.weights[k].kg }));
  const avg = keys.map((k) => ({ k, v: avg7(k).avg }));
  const all = raw.map((p) => p.v);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 2) { const m = (hi + lo) / 2; lo = m - 1; hi = m + 1; }
  lo -= 0.3; hi += 0.3;
  const x = (k) => pl + ((fromKey(k).getTime() - t0) / span) * (W - pl - pr);
  const y = (v) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);

  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4;
    grid += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" opacity=".08"/>`;
    grid += `<text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="currentColor" opacity=".5">${fmt(v, 1)}</text>`;
  }
  const labelIdx = [...new Set([0, Math.floor((keys.length - 1) / 2), keys.length - 1])];
  const xl = labelIdx.map((i) =>
    `<text x="${x(keys[i])}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === keys.length - 1 ? 'end' : 'middle'}" font-size="11" fill="currentColor" opacity=".5">${prettyDate(keys[i], false)}</text>`).join('');
  const path = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + x(p.k).toFixed(1) + ',' + y(p.v).toFixed(1)).join(' ');
  const area = path(avg) + ` L${x(keys[keys.length - 1]).toFixed(1)},${H - pb} L${x(keys[0]).toFixed(1)},${H - pb} Z`;
  const lastA = avg[avg.length - 1];

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Biểu đồ cân nặng" style="color:var(--text)">
    <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--brand)" stop-opacity=".28"/><stop offset="1" stop-color="var(--brand)" stop-opacity="0"/></linearGradient></defs>
    ${grid}${xl}
    <path d="${area}" fill="url(#wg)"/>
    ${raw.map((p) => `<circle cx="${x(p.k)}" cy="${y(p.v)}" r="3.2" fill="#9fb0a9" opacity=".8"><title>${prettyDate(p.k)}: ${fmt(p.v, 1)} kg</title></circle>`).join('')}
    <path d="${path(avg)}" fill="none" stroke="var(--brand)" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(lastA.k)}" cy="${y(lastA.v)}" r="6" fill="var(--card)" stroke="var(--brand)" stroke-width="3"/>
  </svg>`;
}

/* ================== TAB TỔNG KẾT TUẦN ================== */
let weekStart = mondayOf(todayKey());
document.querySelectorAll('[data-week-shift]').forEach((b) => b.addEventListener('click', () => {
  weekStart = addDays(weekStart, 7 * Number(b.dataset.weekShift));
  renderWeek();
}));

function weekWeightAvg(startKey) {
  const end = addDays(startKey, 6);
  const vals = weightKeysSorted().filter((k) => k >= startKey && k <= end).map((k) => state.weights[k].kg);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function weekChartSvg(days) {
  const S = state.settings;
  const W = 600, H = 220, pl = 8, pr = 8, pt = 22, pb = 26;
  const max = Math.max(S.tdee * 1.15, ...days.map((d) => d.kcal));
  const bw = (W - pl - pr) / 7;
  const y = (v) => pt + (1 - v / max) * (H - pt - pb);
  const colors = { 'st-light': '#8be0b8', 'st-ok': 'var(--brand)', 'st-warn': '#f5a524', 'st-empty': 'var(--line)' };
  let bars = '';
  days.forEach((d, i) => {
    const cx = pl + bw * i + bw / 2;
    const h = d.items ? Math.max(3, H - pb - y(d.kcal)) : 3;
    bars += `<rect x="${cx - bw * 0.3}" y="${H - pb - h}" width="${bw * 0.6}" height="${h}" rx="8" fill="${colors[dayStatus(d)]}"/>`;
    if (d.items) bars += `<text x="${cx}" y="${H - pb - h - 6}" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">${fmt(d.kcal / 1000, 1)}k</text>`;
    bars += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="12" fill="currentColor" opacity=".55">${WEEKDAYS[fromKey(d.k).getDay()]}${d.trained ? '🥊' : ''}</text>`;
  });
  const line = (v, label, dash) => `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" opacity=".35" stroke-dasharray="${dash}"/>
    <text x="${W - pr}" y="${y(v) - 4}" text-anchor="end" font-size="10.5" fill="currentColor" opacity=".55">${label}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calo từng ngày trong tuần" style="color:var(--text);width:100%;height:auto;display:block">
    ${line(S.kcalTarget, 'Mục tiêu ' + fmt(S.kcalTarget), '6 5')}${line(S.tdee, 'TDEE ' + fmt(S.tdee), '2 4')}${bars}</svg>`;
}

function renderWeek() {
  const S = state.settings;
  const end = addDays(weekStart, 6);
  $('#weekLabel').textContent = `Tuần ${prettyDate(weekStart, false)} – ${prettyDate(end, false)}`;

  const days = [];
  for (let i = 0; i < 7; i++) {
    const k = addDays(weekStart, i);
    days.push({ k, ...dayTotals(k) });
  }
  // Hôm nay chưa xong (trước 20h) thì chưa tính vào tổng kết, tránh báo hụt sai
  const openDay = todayKey() >= weekStart && todayKey() <= end && new Date().getHours() < 20 ? todayKey() : null;
  const logged = days.filter((d) => d.items > 0 && d.k !== openDay);
  const openNote = openDay && dayTotals(openDay).items
    ? '<p class="muted">Hôm nay chưa hết ngày nên chưa tính vào tổng kết (sẽ tính từ 20h).</p>' : '';
  const n = logged.length;
  const trainCount = days.filter((d) => d.trained).length;
  const wNow = weekWeightAvg(weekStart);
  const wPrev = weekWeightAvg(addDays(weekStart, -7));
  const chart = `<div class="card"><h2 class="card-title">📊 Calo từng ngày</h2>${weekChartSvg(days)}</div>`;

  if (!n) {
    $('#weekReport').innerHTML = `${chart}<div class="card"><p class="muted">Tuần này chưa có ngày nào (đã xong) nhập bữa ăn.</p>${openNote}
      ${trainCount ? `<p>Số buổi tập: <b>${trainCount}</b></p>` : ''}
      ${wNow ? `<p>Cân TB tuần: <b>${fmt(wNow, 1)} kg</b></p>` : ''}</div>`;
    return;
  }

  const totalKcal = logged.reduce((a, d) => a + d.kcal, 0);
  const avgKcal = totalKcal / n;
  const avgProtein = logged.reduce((a, d) => a + d.protein, 0) / n;
  const deficit = S.tdee * n - totalKcal;
  const fatKg = deficit / 7700;
  const proteinOk = logged.filter((d) => d.protein >= S.protein).length;
  const lunchOk = logged.filter((d) => d.lunchProtein >= S.lunchProteinMin).length;
  const lunchFail = n - lunchOk;
  const lowDays = logged.filter((d) => d.kcal < S.minKcal).length;
  const overDays = logged.filter((d) => d.kcal > S.tdee).length;
  const trainLow = logged.filter((d) => d.trained && d.kcal < S.kcalTarget - 250).length;
  const wDiff = wNow !== null && wPrev !== null ? wNow - wPrev : null;
  const waterDays = days.filter((d) => (getDay(d.k)?.water || 0) > 0);
  const avgWater = waterDays.length ? waterDays.reduce((a, d) => a + getDay(d.k).water, 0) / waterDays.length : null;

  // Đánh giá bằng lời
  const p = [];
  p.push(`Tuần này (${n}/7 ngày có nhập) trung bình <b>${fmt(Math.round(avgKcal / 10) * 10)} kcal/ngày</b>, ` +
    (deficit >= 0
      ? `thâm hụt tổng <b>~${fmt(Math.round(deficit / 50) * 50)} kcal</b> (~${fmt(fatKg, 1)} kg mỡ).`
      : `<b>dư ~${fmt(Math.round(-deficit / 50) * 50)} kcal</b> so với mức duy trì.`));
  if (n < 7) p.push(`<span class="muted">Thâm hụt chỉ tính trên ${n} ngày có nhập (TDEE ${fmt(S.tdee)} × ${n}).</span>`);

  if (avgKcal < S.minKcal) p.push('⚠️ Trung bình dưới ' + fmt(S.minKcal) + ' kcal — quá sâu, dễ mất cơ và tụt chuyển hoá. Ăn thêm lên ~' + fmt(S.kcalTarget) + '.');
  else if (avgKcal <= S.kcalTarget + 100) p.push('✅ Calo trung bình nằm trong vùng recomp — đúng hướng.');
  else if (avgKcal <= S.tdee) p.push('Calo hơi cao hơn mục tiêu nhưng vẫn dưới duy trì — vẫn thâm hụt, siết nhẹ lại là được.');
  else p.push('Tuần này ăn trên mức duy trì. Không phải thảm hoạ — tuần sau quay lại ~' + fmt(S.kcalTarget) + ' kcal là ổn.');

  p.push(`💪 Đạm trung bình <b>${fmt(avgProtein)}g/ngày</b>, đạt ≥${S.protein}g <b>${proteinOk}/${n}</b> ngày.` +
    (avgProtein < S.protein * 0.85 ? ' Thiếu đạm thì thâm hụt dễ ăn vào cơ — ưu tiên bổ sung đạm.' : ''));
  if (lunchFail >= 2) p.push(`🍱 Trưa sập <b>${lunchFail}</b> ngày (dưới ${S.lunchProteinMin}g đạm) — cần thủ đạm đi làm (xúc xích ức gà, trứng luộc, sữa cao đạm).`);
  else if (lunchFail === 1) p.push('🍱 Trưa sập 1 ngày — giữ thói quen mang đạm theo.');
  else p.push('🍱 Bữa trưa đủ đạm cả tuần — tốt!');

  p.push(`🥊 Tập <b>${trainCount}</b> buổi` + (trainCount >= 3 ? ' — đủ lịch.' : ' — mục tiêu 3 buổi boxing/tuần.'));
  if (trainLow) p.push(`Có ${trainLow} ngày tập ăn hụt sâu — ngày tập nên ăn đủ ~${fmt(S.kcalTarget)} để hồi phục.`);
  if (lowDays) p.push(`Có ${lowDays} ngày dưới ${fmt(S.minKcal)} kcal — tránh cắt ăn cực đoan.`);
  if (overDays && avgKcal <= S.tdee) p.push(`Có ${overDays} ngày ăn nhiều nhưng trung bình tuần vẫn ổn — một bữa không phá kế hoạch.`);
  if (avgWater !== null && avgWater < (S.waterTarget || 8) * 0.75) p.push(`💧 Nước TB ~${fmt(avgWater * 0.25, 1)} lít/ngày — uống thêm, khát hay bị nhầm thành đói.`);

  if (wDiff !== null) {
    p.push(`⚖️ Cân TB tuần ${fmt(wNow, 1)} kg, ${wDiff <= 0 ? 'giảm' : 'tăng'} <b>${fmt(Math.abs(wDiff), 2)} kg</b> so với tuần trước.` +
      (wDiff > 0.2 && deficit > 0 ? ' Vẫn thâm hụt mà cân nhích lên thường do nước/muối/glycogen — theo dõi thêm 1–2 tuần.' : ''));
  } else if (wNow !== null) {
    p.push(`⚖️ Cân TB tuần ${fmt(wNow, 1)} kg (chưa có dữ liệu tuần trước để so).`);
  }

  const kpi = (ico, v, l, cls = '') => `<div class="kpi"><div class="k-ico">${ico}</div><div class="v ${cls}">${v}</div><div class="l">${l}</div></div>`;
  const tbl = days.map((d) => {
    const dd = getDay(d.k) || {};
    const feel = FEELINGS.find((f) => f.key === dd.feel);
    return `<tr>
      <td>${prettyDate(d.k)}${d.trained ? ' 🥊' : ''}${feel ? ' ' + feel.icon : ''}${dd.note ? ` <span title="${esc(dd.note)}">📝</span>` : ''}</td>
      <td>${d.items ? fmt(d.kcal) : '—'}</td>
      <td class="${d.items ? (d.protein >= S.protein ? 'good' : '') : ''}">${d.items ? fmt(d.protein) : '—'}</td>
      <td class="${d.items ? (d.lunchProtein >= S.lunchProteinMin ? 'good' : 'badc') : ''}">${d.items ? fmt(d.lunchProtein) : '—'}</td>
    </tr>`;
  }).join('');
  const notes = days.filter((d) => getDay(d.k)?.note).map((d) => `<p><b>${prettyDate(d.k)}:</b> ${esc(getDay(d.k).note)}</p>`).join('');

  $('#weekReport').innerHTML = `
    <div class="kpis">
      ${kpi('🔥', fmt(avgKcal), 'kcal TB/ngày')}
      ${kpi('📉', (deficit >= 0 ? '−' : '+') + fmt(Math.abs(deficit)), `kcal so TDEE · ~${fmt(Math.abs(fatKg), 1)} kg mỡ`, deficit >= 0 ? 'good' : 'badc')}
      ${kpi('💪', fmt(avgProtein) + 'g', 'đạm TB/ngày')}
      ${kpi('🎯', proteinOk + '/' + n, 'ngày đủ đạm ≥' + S.protein + 'g')}
      ${kpi('🍱', lunchOk + '/' + n, 'trưa đủ đạm ≥' + S.lunchProteinMin + 'g', lunchFail >= 2 ? 'badc' : '')}
      ${kpi('🥊', trainCount, 'buổi tập')}
      ${kpi('⚖️', wNow !== null ? fmt(wNow, 1) : '—', 'cân TB tuần (kg)')}
      ${kpi(wDiff !== null && wDiff <= 0 ? '▼' : '▲', wDiff !== null ? (wDiff > 0 ? '+' : '') + fmt(wDiff, 2) : '—', 'kg so tuần trước', wDiff !== null && wDiff <= 0 ? 'good' : '')}
    </div>
    ${chart}
    <div class="card verdict"><h2 class="card-title">🧠 Fu đánh giá</h2>${p.map((x) => `<p>${x}</p>`).join('')}${openNote}</div>
    <div class="card">
      <h2 class="card-title">📅 Từng ngày</h2>
      <table class="daytable"><thead><tr><th>Ngày</th><th>kcal</th><th>Đạm</th><th>Trưa</th></tr></thead><tbody>${tbl}</tbody></table>
    </div>
    ${notes ? `<div class="card verdict"><h2 class="card-title">📝 Ghi chú trong tuần</h2>${notes}</div>` : ''}`;
}

/* ================== TAB CÀI ĐẶT ================== */
const SETTING_FIELDS = [
  ['👤 Hồ sơ'],
  ['name', 'Tên', 'text'],
  ['age', 'Tuổi', 'number'],
  ['startWeight', 'Cân khởi điểm (kg)', 'number', 0.1],
  ['startDate', 'Ngày khởi điểm', 'date'],
  ['🎯 Mục tiêu mỗi ngày'],
  ['kcalTarget', 'Calo/ngày', 'number'],
  ['minKcal', 'Sàn calo tối thiểu', 'number'],
  ['bmr', 'BMR (kcal)', 'number'],
  ['tdee', 'TDEE duy trì (kcal)', 'number'],
  ['protein', 'Đạm (g)', 'number'],
  ['lunchProteinMin', 'Đạm tối thiểu bữa trưa (g)', 'number'],
  ['carb', 'Tinh bột (g)', 'number'],
  ['fat', 'Béo (g)', 'number'],
  ['waterTarget', 'Nước (số ly 250ml)', 'number'],
  ['💪 Chỉ số cơ thể'],
  ['startBodyFat', '% mỡ khởi điểm', 'number', 0.1],
  ['goalBodyFat', '% mỡ mục tiêu', 'text'],
  ['startMuscle', 'Khối lượng cơ (kg)', 'number', 0.1],
  ['visceralFat', 'Mỡ nội tạng', 'number', 0.5],
];

function renderSettings() {
  const S = state.settings;
  let html = '';
  let open = false;
  for (const [k, l, t, step] of SETTING_FIELDS) {
    if (!l) {
      if (open) html += '</div>';
      html += `<div class="set-group">${k}</div><div class="grid2">`;
      open = true;
      continue;
    }
    html += `<label>${l}<input type="${t}" name="${k}" value="${esc(S[k] ?? '')}" ${step ? `step="${step}"` : ''} ${t === 'number' ? 'inputmode="decimal"' : ''}></label>`;
  }
  html += '</div>';
  html += `<p class="muted">Macro hiện tại ≈ ${fmt(S.protein * 4 + S.carb * 4 + S.fat * 9)} kcal (đạm×4 + tinh bột×4 + béo×9).</p>`;
  $('#settingsFields').innerHTML = html;
  renderLibrary();
  renderSafety();
}

$('#settingsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  for (const [k, l, t] of SETTING_FIELDS) {
    if (!l) continue;
    const v = fd.get(k);
    if (t === 'number') {
      const n = num(v);
      if (!isNaN(n)) state.settings[k] = n;
    } else if (v !== null) {
      state.settings[k] = String(v).trim();
    }
  }
  save();
  toast('Đã lưu cài đặt');
  render();
});

function renderLibrary() {
  const q = norm($('#libSearch').value.trim());
  const list = state.foods.filter((f) => !q || norm(f.name).includes(q));
  let html = '';
  for (const cat of FOOD_CATEGORIES) {
    const fs = list.filter((f) => (f.cat || 'Món tự thêm') === cat);
    if (!fs.length) continue;
    html += `<div class="lib-group">${CATEGORY_ICONS[cat] || ''} ${esc(cat)} (${fs.length})</div>` + fs.map((f) => `
      <div class="lib-row">
        <span class="food-ico">${foodIcon(f)}</span>
        <div class="item-main"><div class="item-name">${esc(f.name)}</div><div class="item-meta">${fmt(f.kcal)} kcal · ${fmt(f.protein, f.protein % 1 ? 1 : 0)}g đạm</div></div>
        <button class="btn small" data-lib-edit="${f.id}">Sửa</button>
        <button class="btn small danger" data-lib-del="${f.id}" aria-label="Xoá">✕</button>
      </div>`).join('');
  }
  $('#libList').innerHTML = html || '<p class="muted">Không có món nào.</p>';
}
$('#libSearch').addEventListener('input', renderLibrary);

const libDlg = $('#libDialog');
let libEditId = null;
let libEmoji = '';
$('#lfCat').innerHTML = FOOD_CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join('');
function renderEmojiGrid() {
  $('#lfEmojiGrid').innerHTML = `<button type="button" class="auto ${libEmoji ? '' : 'on'}" data-emoji="">Tự</button>` +
    EMOJI_CHOICES.map((e) => `<button type="button" class="${libEmoji === e ? 'on' : ''}" data-emoji="${e}">${e}</button>`).join('');
}
$('#lfEmojiGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-emoji]');
  if (!b) return;
  libEmoji = b.dataset.emoji;
  renderEmojiGrid();
});
function openLibDialog(food) {
  libEditId = food ? food.id : null;
  libEmoji = (food && food.emoji) || '';
  $('#libDlgTitle').textContent = food ? 'Sửa món' : 'Thêm món';
  $('#lfName').value = food ? food.name : '';
  $('#lfKcal').value = food ? food.kcal : '';
  $('#lfProtein').value = food ? food.protein : '';
  $('#lfCat').value = food ? (food.cat || 'Món tự thêm') : 'Món tự thêm';
  renderEmojiGrid();
  libDlg.showModal();
}
$('#libAddBtn').addEventListener('click', () => openLibDialog(null));
$('#libList').addEventListener('click', (e) => {
  const ed = e.target.closest('[data-lib-edit]');
  if (ed) return openLibDialog(foodById(ed.dataset.libEdit));
  const del = e.target.closest('[data-lib-del]');
  if (del) {
    const f = foodById(del.dataset.libDel);
    if (!confirm(`Xoá "${f.name}" khỏi thư viện? (Các ngày đã nhập vẫn giữ nguyên)`)) return;
    state.foods = state.foods.filter((x) => x.id !== f.id);
    save();
    renderLibrary();
  }
});
libDlg.addEventListener('close', () => {
  if (libDlg.returnValue !== 'save') return;
  const data = {
    name: $('#lfName').value.trim(),
    kcal: num($('#lfKcal').value) || 0,
    protein: num($('#lfProtein').value) || 0,
    cat: $('#lfCat').value,
  };
  if (!data.name) return;
  if (libEditId) {
    const f = foodById(libEditId);
    Object.assign(f, data);
    if (libEmoji) f.emoji = libEmoji; else delete f.emoji;
  } else {
    state.foods.push({ id: 'u' + uid(), ...data, ...(libEmoji ? { emoji: libEmoji } : {}) });
  }
  save();
  toast('Đã lưu món');
  renderLibrary();
});

/* ---------- Sao lưu ---------- */
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('#exportBtn').addEventListener('click', () => {
  download(`dinh-duong-backup-${todayKey()}.json`, JSON.stringify(state, null, 2), 'application/json');
});
$('#exportCsvBtn').addEventListener('click', () => {
  const rows = [['Ngày', 'Bữa', 'Món', 'Số lượng', 'kcal', 'Đạm (g)', 'Có tập']];
  for (const k of Object.keys(state.days).sort()) {
    const d = state.days[k];
    for (const m of MEALS) {
      for (const it of ((d.meals || {})[m.key] || [])) {
        rows.push([k, m.label, it.name, it.qty, Math.round(it.kcal * it.qty), r1(it.protein * it.qty), d.trained ? 'x' : '']);
      }
    }
  }
  rows.push([]);
  rows.push(['Ngày', 'Nước (ly)', 'Cảm giác', 'Ghi chú']);
  for (const k of Object.keys(state.days).sort()) {
    const d = state.days[k];
    if (d.water || d.feel || d.note) rows.push([k, d.water || '', (FEELINGS.find((f) => f.key === d.feel) || {}).label || '', d.note || '']);
  }
  rows.push([]);
  rows.push(['Ngày', 'Cân (kg)', '% mỡ', 'Eo (cm)']);
  for (const k of weightKeysSorted()) {
    const w = state.weights[k];
    rows.push([k, w.kg, w.bf ?? '', w.waist ?? '']);
  }
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  download(`dinh-duong-${todayKey()}.csv`, '﻿' + csv, 'text/csv');
});
$('#importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== 'object' || !data.days) throw new Error('bad');
    if (!confirm('Nhập file sẽ THAY THẾ toàn bộ dữ liệu hiện tại. Tiếp tục?')) return;
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    state = loadState();
    save();
    toast('Đã nhập dữ liệu');
    render();
  } catch (err) {
    toast('File không hợp lệ');
  }
});

function renderSafety() {
  let at = null;
  try { at = localStorage.getItem(SAFE_KEY) && localStorage.getItem(SAFE_AT_KEY); } catch (e) { /* bỏ qua */ }
  $('#safetyBox').innerHTML = at ? `<div class="safety">🛡️ Đã tự sao lưu dữ liệu cũ lúc nâng cấp giao diện (${new Date(at).toLocaleString('vi-VN')}).
    <button class="btn small" id="restoreSafe" type="button">Khôi phục bản đó</button></div>` : '';
}
$('#safetyBox').addEventListener('click', (e) => {
  if (!e.target.closest('#restoreSafe')) return;
  if (!confirm('Khôi phục dữ liệu về lúc trước khi nâng cấp giao diện? Những gì nhập SAU lúc đó sẽ mất. Nên Xuất JSON trước.')) return;
  localStorage.setItem(STORE_KEY, localStorage.getItem(SAFE_KEY));
  state = loadState();
  toast('Đã khôi phục');
  render();
});

$('#resetBtn').addEventListener('click', () => {
  if (!confirm('Xoá TOÀN BỘ dữ liệu (bữa ăn, cân nặng, thư viện)? Nên xuất JSON trước.')) return;
  if (!confirm('Chắc chắn chưa? Không hoàn tác được.')) return;
  localStorage.removeItem(STORE_KEY);
  state = loadState();
  save();
  toast('Đã xoá dữ liệu');
  render();
});

/* ================== KHỞI ĐỘNG ================== */
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close('cancel')));
// Chạm ra ngoài bottom sheet để đóng
document.querySelectorAll('dialog.sheet').forEach((dl) => dl.addEventListener('click', (e) => {
  if (e.target === dl) dl.close('cancel');
}));
// Enter trong hộp thêm món: không đóng hộp thoại
addDlg.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.target.id === 'foodSearch') return;
  e.preventDefault();
  if (e.target.id === 'qtyInput') $('#confirmAdd').click();
  else if (e.target.closest('#newFoodBox')) $('#nfAdd').click();
});
editDlg.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('#edSave').click(); }
});

// Mốc cân khởi điểm (chỉ khi chưa có lần cân nào)
if (!Object.keys(state.weights).length) {
  state.weights[state.settings.startDate] = { kg: state.settings.startWeight, bf: state.settings.startBodyFat };
  save();
}
render();
