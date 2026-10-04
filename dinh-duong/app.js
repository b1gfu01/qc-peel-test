'use strict';

/* ================== LƯU TRỮ ================== */
const STORE_KEY = 'dinhduong-phuoc-v1';

function makeDefaultFoods() {
  return DEFAULT_FOODS.map(([name, kcal, protein, cat], i) => ({ id: 'f' + (i + 1), name, kcal, protein, cat }));
}

function loadState() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { /* bỏ qua */ }
  if (!s || typeof s !== 'object') s = {};
  return {
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
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

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
function prettyDate(k, withWeekday = true) {
  const d = fromKey(k);
  const s = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  return withWeekday ? WEEKDAYS[d.getDay()] + ' ' + s : s;
}
function mondayOf(k) {
  const d = fromKey(k);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return toKey(d);
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ================== DỮ LIỆU NGÀY ================== */
function getDay(k, create = false) {
  let d = state.days[k];
  if (!d && create) {
    d = state.days[k] = { meals: {}, trained: false };
  }
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

/* ================== ĐIỀU HƯỚNG TAB ================== */
let currentTab = 'today';
document.querySelectorAll('.tabbar button').forEach((b) => {
  b.addEventListener('click', () => showTab(b.dataset.tab));
});
function showTab(name) {
  currentTab = name;
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + name));
  render();
  window.scrollTo(0, 0);
}

function render() {
  $('#appTitle').textContent = 'Dinh dưỡng của ' + state.settings.name;
  if (currentTab === 'today') renderToday();
  else if (currentTab === 'weight') renderWeight();
  else if (currentTab === 'week') renderWeek();
  else if (currentTab === 'settings') renderSettings();
}

/* ================== TAB HÔM NAY ================== */
let selDay = todayKey();
$('#dayPicker').addEventListener('change', (e) => { if (e.target.value) { selDay = e.target.value; renderToday(); } });
document.querySelectorAll('[data-day-shift]').forEach((b) => b.addEventListener('click', () => {
  selDay = addDays(selDay, Number(b.dataset.dayShift));
  renderToday();
}));
$('#trainedToggle').addEventListener('change', (e) => {
  getDay(selDay, true).trained = e.target.checked;
  save();
  renderToday();
});

function renderToday() {
  const S = state.settings;
  $('#dayPicker').value = selDay;
  const t = dayTotals(selDay);
  const isToday = selDay === todayKey();
  const label = isToday ? 'Hôm nay' : prettyDate(selDay);

  // Màu trạng thái
  let st = 'st-empty';
  if (t.items) {
    if (t.kcal > S.tdee) st = 'st-warn';
    else if (t.kcal >= S.kcalTarget - 150) st = 'st-ok';
    else st = 'st-light';
  }
  const diff = Math.round(S.kcalTarget - t.kcal);
  const diffText = diff >= 0 ? `còn ${fmt(diff)} kcal` : `dư ${fmt(-diff)} kcal`;
  const pPct = Math.min(100, (t.protein / S.protein) * 100);
  const kPct = Math.min(100, (t.kcal / S.kcalTarget) * 100);
  const pLeft = Math.max(0, S.protein - t.protein);

  const box = $('#daySummary');
  box.className = 'card summary ' + st;
  box.innerHTML = `
    <div class="metric-label">${esc(label)}</div>
    <div class="big">${fmt(t.kcal)} <small>/ ${fmt(S.kcalTarget)} kcal</small></div>
    <div class="sum-sub">${diffText}${t.kcal > S.tdee ? ' · trên TDEE ' + fmt(S.tdee) : ''}</div>
    <div class="bar"><i style="width:${kPct}%"></i></div>
    <div class="sum-row">
      <div>
        <div class="metric-label">Đạm</div>
        <div class="metric-val">${fmt(t.protein)}<small class="muted"> / ${S.protein}g</small></div>
        <div class="bar protein"><i style="width:${pPct}%"></i></div>
      </div>
      <div>
        <div class="metric-label">${pLeft > 0 ? 'Đạm còn thiếu' : 'Đạm'}</div>
        <div class="metric-val">${pLeft > 0 ? fmt(pLeft) + 'g' : '✅ Đủ'}</div>
        <div class="muted">Trưa: ${fmt(t.lunchProtein)}g đạm</div>
      </div>
    </div>`;

  $('#trainedToggle').checked = t.trained;

  // Nhắc nhở
  const alerts = [];
  const now = new Date();
  const dayOver = selDay < todayKey() || (isToday && now.getHours() >= 21);
  const lunchItems = (getDay(selDay)?.meals.trua || []).length;
  if ((lunchItems || (isToday && now.getHours() >= 14) || selDay < todayKey()) && t.items && t.lunchProtein < S.lunchProteinMin) {
    alerts.push(['warn', `🍱 Trưa thiếu đạm (${fmt(t.lunchProtein)}g < ${S.lunchProteinMin}g) — thủ xúc xích ức gà / trứng đi làm.`]);
  }
  if (t.kcal > S.tdee) {
    alerts.push(['warn', `Hôm nay trên mức duy trì. Không sao — giảm mỡ tính theo trung bình tuần, mai ăn bình thường lại.`]);
  }
  if (dayOver && t.items && t.kcal < S.minKcal) {
    alerts.push(['bad', `⚠️ Dưới ${fmt(S.minKcal)} kcal — thâm hụt quá sâu dễ mất cơ, tụt chuyển hoá. Đừng cắt cực đoan.`]);
  }
  if (t.trained && t.items && (dayOver || now.getHours() >= 18) && t.kcal < S.kcalTarget - 250) {
    alerts.push(['info', `🥊 Ngày tập nên ăn đủ ~${fmt(S.kcalTarget)} kcal để hồi phục, đừng để hụt sâu.`]);
  }
  $('#dayAlerts').innerHTML = alerts.map(([c, m]) => `<div class="alert ${c}">${m}</div>`).join('');

  // Các bữa
  const day = getDay(selDay);
  $('#mealList').innerHTML = MEALS.map((m) => {
    const items = (day && day.meals[m.key]) || [];
    const mt = mealTotals(items);
    const rows = items.map((it) => `
      <div class="item">
        <div class="item-main" data-edit="${m.key}|${it.id}">
          <div class="item-name">${esc(it.name)}${it.qty !== 1 ? ` <b>× ${fmt(it.qty, it.qty % 1 ? 1 : 0)}</b>` : ''}</div>
          <div class="item-meta">${fmt(it.kcal * it.qty)} kcal · ${fmt(r1(it.protein * it.qty), 1)}g đạm</div>
        </div>
        <button class="x" data-del="${m.key}|${it.id}" aria-label="Xoá">✕</button>
      </div>`).join('');
    const quick = quickFoods(m.key, items).map((f) =>
      `<button class="chip" data-quick="${m.key}|${f.id}">+ ${esc(shortName(f.name))}</button>`).join('');
    return `
      <div class="card">
        <div class="meal-head">
          <div>
            <h3>${m.icon} ${m.label}</h3>
            <div class="meal-totals">${items.length ? `${fmt(mt.kcal)} kcal · ${fmt(mt.protein)}g đạm` : 'Chưa nhập'}</div>
          </div>
          <button class="btn small primary" data-add="${m.key}">+ Thêm</button>
        </div>
        ${rows}
        ${quick ? `<div class="quick">${quick}</div>` : ''}
      </div>`;
  }).join('');
}

function shortName(n) {
  const s = n.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  return s.length > 26 ? s.slice(0, 24) + '…' : s;
}

// Gợi ý nhanh: món hay dùng nhất cho từng bữa (theo lịch sử), chưa có trong bữa hiện tại
function quickFoods(mealKey, currentItems) {
  const count = {};
  for (const d of Object.values(state.days)) {
    for (const it of (d.meals[mealKey] || [])) {
      if (it.foodId) count[it.foodId] = (count[it.foodId] || 0) + 1;
    }
  }
  const have = new Set(currentItems.map((i) => i.foodId));
  let ids = Object.keys(count).sort((a, b) => count[b] - count[a]);
  if (mealKey === 'sang' && !ids.includes('f9')) ids.unshift('f9'); // cà phê sữa mỗi ngày
  return ids.filter((id) => !have.has(id))
    .map((id) => state.foods.find((f) => f.id === id))
    .filter(Boolean)
    .slice(0, 3);
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
    const f = state.foods.find((x) => x.id === fid);
    if (f) { addEntry(selDay, mk, f, 1); toast('Đã thêm ' + f.name); renderToday(); }
    return;
  }

  const del = e.target.closest('[data-del]');
  if (del) {
    const [mk, id] = del.dataset.del.split('|');
    const d = getDay(selDay);
    d.meals[mk] = d.meals[mk].filter((it) => it.id !== id);
    save();
    renderToday();
    return;
  }

  const ed = e.target.closest('[data-edit]');
  if (ed) {
    const [mk, id] = ed.dataset.edit.split('|');
    const it = getDay(selDay).meals[mk].find((x) => x.id === id);
    const v = prompt(`Số lượng cho "${it.name}"`, it.qty);
    if (v === null) return;
    const n = parseFloat(String(v).replace(',', '.'));
    if (!(n > 0)) return toast('Số lượng không hợp lệ');
    it.qty = n;
    save();
    renderToday();
  }
});

/* ---------- Hộp thoại thêm món ---------- */
const addDlg = $('#addDialog');
let addMeal = 'sang';
let picked = null;

function openAddDialog(mealKey) {
  addMeal = mealKey;
  picked = null;
  $('#addTitle').textContent = 'Thêm vào bữa ' + MEALS.find((m) => m.key === mealKey).label;
  $('#foodSearch').value = '';
  $('#pickedBox').hidden = true;
  $('#newFoodBox').open = false;
  ['#nfName', '#nfKcal', '#nfProtein'].forEach((s) => { $(s).value = ''; });
  renderSuggest();
  addDlg.showModal();
  setTimeout(() => $('#foodSearch').focus(), 50);
}

function renderSuggest() {
  const q = norm($('#foodSearch').value.trim());
  const words = q.split(/\s+/).filter(Boolean);
  const list = state.foods.filter((f) => {
    const n = norm(f.name);
    return words.every((w) => n.includes(w));
  });
  let html = '';
  if (!q) {
    // Không gõ gì: hiện theo nhóm
    for (const cat of FOOD_CATEGORIES) {
      const fs = list.filter((f) => (f.cat || 'Món tự thêm') === cat);
      if (!fs.length) continue;
      html += `<div class="sg-group">${esc(cat)}</div>` + fs.map(sgRow).join('');
    }
  } else {
    html = list.slice(0, 30).map(sgRow).join('') ||
      `<div class="sg-group">Không thấy món — thêm món mới ở dưới 👇</div>`;
    $('#nfName').value = $('#foodSearch').value.trim();
    if (!list.length) $('#newFoodBox').open = true;
  }
  $('#foodSuggest').innerHTML = html;
}
function sgRow(f) {
  return `<button type="button" class="sg" data-pick="${f.id}"><span>${esc(f.name)}</span><span class="meta">${fmt(f.kcal)} kcal · ${fmt(f.protein, f.protein % 1 ? 1 : 0)}g</span></button>`;
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
  picked = state.foods.find((f) => f.id === b.dataset.pick);
  $('#pickedName').textContent = picked.name;
  $('#qtyInput').value = 1;
  $('#pickedBox').hidden = false;
  updatePicked();
  $('#pickedBox').scrollIntoView({ block: 'nearest' });
});
function getQty() {
  const n = parseFloat(String($('#qtyInput').value).replace(',', '.'));
  return n > 0 ? n : 0;
}
function updatePicked() {
  if (!picked) return;
  const q = getQty();
  $('#pickedTotal').textContent = `= ${fmt(picked.kcal * q)} kcal · ${fmt(r1(picked.protein * q), 1)}g đạm`;
}
$('#qtyInput').addEventListener('input', updatePicked);
$('#qtyMinus').addEventListener('click', () => { $('#qtyInput').value = Math.max(0.5, getQty() - 0.5); updatePicked(); });
$('#qtyPlus').addEventListener('click', () => { $('#qtyInput').value = getQty() + 0.5; updatePicked(); });
$('#confirmAdd').addEventListener('click', () => {
  const q = getQty();
  if (!picked || !q) return toast('Chọn món và số lượng');
  addEntry(selDay, addMeal, picked, q);
  addDlg.close();
  toast('Đã thêm ' + picked.name);
  renderToday();
});
$('#nfAdd').addEventListener('click', () => {
  const name = $('#nfName').value.trim();
  const kcal = parseFloat($('#nfKcal').value);
  const protein = parseFloat(String($('#nfProtein').value).replace(',', '.')) || 0;
  if (!name || !(kcal >= 0)) return toast('Nhập tên và calo');
  const food = { id: 'u' + uid(), name, kcal, protein, cat: 'Món tự thêm' };
  state.foods.push(food);
  addEntry(selDay, addMeal, food, 1);
  addDlg.close();
  toast('Đã lưu vào thư viện & thêm');
  renderToday();
});

/* ================== TAB CÂN NẶNG ================== */
function weightKeysSorted() {
  return Object.keys(state.weights).sort();
}
// Trung bình cân trong 7 ngày kết thúc tại endKey
function avg7(endKey) {
  const start = addDays(endKey, -6);
  const vals = weightKeysSorted().filter((k) => k >= start && k <= endKey).map((k) => state.weights[k].kg);
  return vals.length ? { avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length } : null;
}

$('#weightForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const k = $('#wDate').value;
  const kg = parseFloat(String($('#wKg').value).replace(',', '.'));
  if (!k || !(kg > 0)) return;
  const bf = parseFloat($('#wBf').value);
  const waist = parseFloat($('#wWaist').value);
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
  const last = keys.length ? state.weights[keys[keys.length - 1]] : null;
  const lastBf = [...keys].reverse().map((k) => state.weights[k].bf).find((v) => v > 0);
  const lastWaist = [...keys].reverse().map((k) => state.weights[k].waist).find((v) => v > 0);

  let change = '';
  if (a && aPrev) {
    const d = a.avg - aPrev.avg;
    change = `<div class="muted">So với 7 ngày trước: <b class="${d <= 0 ? 'good' : ''}">${d > 0 ? '+' : ''}${fmt(d, 2)} kg</b></div>`;
  }
  const fromStart = a ? a.avg - S.startWeight : null;

  $('#weightStats').innerHTML = `
    <div class="metric-label">Trung bình 7 ngày gần nhất</div>
    <div class="big">${a ? fmt(a.avg, 1) : '—'} <small>kg${a ? ` (${a.n} lần cân)` : ''}</small></div>
    ${change}
    <div class="stat-grid" style="margin-top:12px">
      <div><div class="metric-label">Lần cân gần nhất</div><div class="metric-val">${last ? fmt(last.kg, 1) : '—'}</div><div class="muted">${keys.length ? prettyDate(keys[keys.length - 1]) : ''}</div></div>
      <div><div class="metric-label">So với khởi điểm ${fmt(S.startWeight, 1)}</div><div class="metric-val">${fromStart === null ? '—' : (fromStart > 0 ? '+' : '') + fmt(fromStart, 1)}</div><div class="muted">theo TB 7 ngày</div></div>
      <div><div class="metric-label">% mỡ gần nhất</div><div class="metric-val">${lastBf ? fmt(lastBf, 1) + '%' : '—'}</div><div class="muted">khởi điểm ${fmt(S.startBodyFat, 1)}% · mục tiêu ${esc(S.goalBodyFat)}%</div></div>
      <div><div class="metric-label">Vòng eo gần nhất</div><div class="metric-val">${lastWaist ? fmt(lastWaist, 1) + ' cm' : '—'}</div></div>
    </div>`;

  $('#weightChart').innerHTML = weightChartSvg(keys.slice(-90));

  $('#weightList').innerHTML = keys.length ? [...keys].reverse().slice(0, 60).map((k) => {
    const w = state.weights[k];
    const extra = [w.bf ? fmt(w.bf, 1) + '% mỡ' : '', w.waist ? 'eo ' + fmt(w.waist, 1) + 'cm' : ''].filter(Boolean).join(' · ');
    return `<div class="wrow"><div><b>${fmt(w.kg, 1)} kg</b> <span class="muted">${prettyDate(k)}${extra ? ' · ' + extra : ''}</span></div><button class="x icon-btn" style="width:36px;height:36px;font-size:16px" data-wdel="${k}" aria-label="Xoá">✕</button></div>`;
  }).join('') : '<p class="muted">Chưa có lần cân nào.</p>';
}

function weightChartSvg(keys) {
  if (keys.length < 2) return '<p class="muted">Cần ít nhất 2 lần cân để vẽ biểu đồ.</p>';
  const W = 600, H = 240, pl = 40, pr = 10, pt = 12, pb = 26;
  const t0 = fromKey(keys[0]).getTime();
  const t1 = fromKey(keys[keys.length - 1]).getTime();
  const span = Math.max(1, t1 - t0);
  const raw = keys.map((k) => ({ k, v: state.weights[k].kg }));
  const avg = keys.map((k) => ({ k, v: avg7(k).avg }));
  const all = raw.map((p) => p.v);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 2) { const m = (hi + lo) / 2; lo = m - 1; hi = m + 1; }
  lo -= 0.3; hi += 0.3;
  const x = (k) => pl + ((fromKey(k).getTime() - t0) / span) * (W - pl - pr);
  const y = (v) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);

  let grid = '';
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const v = lo + ((hi - lo) * i) / steps;
    grid += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" opacity=".12"/>`;
    grid += `<text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="currentColor" opacity=".6">${fmt(v, 1)}</text>`;
  }
  const labelIdx = [0, Math.floor((keys.length - 1) / 2), keys.length - 1];
  const xl = [...new Set(labelIdx)].map((i) =>
    `<text x="${x(keys[i])}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === keys.length - 1 ? 'end' : 'middle'}" font-size="11" fill="currentColor" opacity=".6">${prettyDate(keys[i], false)}</text>`).join('');
  const path = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + x(p.k).toFixed(1) + ',' + y(p.v).toFixed(1)).join(' ');

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Biểu đồ cân nặng" style="color:var(--text)">
    ${grid}${xl}
    <path d="${path(raw)}" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3 3"/>
    ${raw.map((p) => `<circle cx="${x(p.k)}" cy="${y(p.v)}" r="3" fill="#94a3b8"><title>${prettyDate(p.k)}: ${fmt(p.v, 1)} kg</title></circle>`).join('')}
    <path d="${path(avg)}" fill="none" stroke="var(--brand)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
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
    ? `<p class="muted">Hôm nay chưa hết ngày nên chưa tính vào tổng kết (sẽ tính từ 20h).</p>` : '';
  const n = logged.length;
  const trainCount = days.filter((d) => d.trained).length;
  const wNow = weekWeightAvg(weekStart);
  const wPrev = weekWeightAvg(addDays(weekStart, -7));

  if (!n) {
    $('#weekReport').innerHTML = `<div class="card"><p class="muted">Tuần này chưa có ngày nào (đã xong) nhập bữa ăn.</p>${openNote}
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

  p.push(`Đạm trung bình <b>${fmt(avgProtein)}g/ngày</b>, đạt ≥${S.protein}g <b>${proteinOk}/${n}</b> ngày.` +
    (avgProtein < S.protein * 0.85 ? ' Thiếu đạm thì thâm hụt dễ ăn vào cơ — ưu tiên bổ sung đạm.' : ''));
  if (lunchFail >= 2) p.push(`🍱 Trưa sập <b>${lunchFail}</b> ngày (dưới ${S.lunchProteinMin}g đạm) — cần thủ đạm đi làm (xúc xích ức gà, trứng luộc, sữa cao đạm).`);
  else if (lunchFail === 1) p.push(`🍱 Trưa sập 1 ngày — giữ thói quen mang đạm theo.`);
  else p.push('🍱 Bữa trưa đủ đạm cả tuần — tốt!');

  p.push(`🥊 Tập <b>${trainCount}</b> buổi` + (trainCount >= 3 ? ' — đủ lịch.' : ' — mục tiêu 3 buổi boxing/tuần.'));
  if (trainLow) p.push(`Có ${trainLow} ngày tập ăn hụt sâu — ngày tập nên ăn đủ ~${fmt(S.kcalTarget)} để hồi phục.`);
  if (lowDays) p.push(`Có ${lowDays} ngày dưới ${fmt(S.minKcal)} kcal — tránh cắt ăn cực đoan.`);
  if (overDays && avgKcal <= S.tdee) p.push(`Có ${overDays} ngày ăn nhiều nhưng trung bình tuần vẫn ổn — một bữa không phá kế hoạch.`);

  if (wDiff !== null) {
    p.push(`⚖️ Cân TB tuần ${fmt(wNow, 1)} kg, ${wDiff <= 0 ? 'giảm' : 'tăng'} <b>${fmt(Math.abs(wDiff), 2)} kg</b> so với tuần trước.` +
      (wDiff > 0.2 && deficit > 0 ? ' Vẫn thâm hụt mà cân nhích lên thường do nước/muối/glycogen — theo dõi thêm 1–2 tuần.' : ''));
  } else if (wNow !== null) {
    p.push(`⚖️ Cân TB tuần ${fmt(wNow, 1)} kg (chưa có dữ liệu tuần trước để so).`);
  }

  const kpi = (v, l, cls = '') => `<div class="kpi"><div class="v ${cls}">${v}</div><div class="l">${l}</div></div>`;
  const tbl = days.map((d) => `<tr>
      <td>${prettyDate(d.k)}${d.trained ? ' 🥊' : ''}</td>
      <td>${d.items ? fmt(d.kcal) : '—'}</td>
      <td class="${d.items ? (d.protein >= S.protein ? 'good' : '') : ''}">${d.items ? fmt(d.protein) : '—'}</td>
      <td class="${d.items ? (d.lunchProtein >= S.lunchProteinMin ? 'good' : 'badc') : ''}">${d.items ? fmt(d.lunchProtein) : '—'}</td>
    </tr>`).join('');

  $('#weekReport').innerHTML = `
    <div class="kpis">
      ${kpi(fmt(avgKcal), 'kcal TB/ngày')}
      ${kpi((deficit >= 0 ? '−' : '+') + fmt(Math.abs(deficit)), 'kcal so với TDEE', deficit >= 0 ? 'good' : 'badc')}
      ${kpi(fmt(avgProtein) + 'g', 'đạm TB/ngày')}
      ${kpi(proteinOk + '/' + n, 'ngày đủ đạm ≥' + S.protein + 'g')}
      ${kpi(lunchOk + '/' + n, 'trưa đủ đạm ≥' + S.lunchProteinMin + 'g', lunchFail >= 2 ? 'badc' : '')}
      ${kpi(trainCount, 'buổi tập')}
      ${kpi(wNow !== null ? fmt(wNow, 1) : '—', 'cân TB tuần (kg)')}
      ${kpi(wDiff !== null ? (wDiff > 0 ? '+' : '') + fmt(wDiff, 2) : '—', 'kg so tuần trước', wDiff !== null && wDiff <= 0 ? 'good' : '')}
    </div>
    <div class="card verdict" style="margin-top:12px"><h2>Đánh giá</h2>${p.map((x) => `<p>${x}</p>`).join('')}${openNote}</div>
    <div class="card">
      <h2>Từng ngày</h2>
      <table class="daytable"><thead><tr><th>Ngày</th><th>kcal</th><th>Đạm</th><th>Trưa</th></tr></thead><tbody>${tbl}</tbody></table>
    </div>`;
}

/* ================== TAB CÀI ĐẶT ================== */
const SETTING_FIELDS = [
  ['name', 'Tên', 'text'],
  ['age', 'Tuổi', 'number'],
  ['startWeight', 'Cân khởi điểm (kg)', 'number', 0.1],
  ['startDate', 'Ngày khởi điểm', 'date'],
  ['bmr', 'BMR (kcal)', 'number'],
  ['tdee', 'TDEE duy trì (kcal)', 'number'],
  ['kcalTarget', 'Mục tiêu calo/ngày', 'number'],
  ['minKcal', 'Sàn calo tối thiểu', 'number'],
  ['protein', 'Đạm (g)', 'number'],
  ['carb', 'Tinh bột (g)', 'number'],
  ['fat', 'Béo (g)', 'number'],
  ['lunchProteinMin', 'Đạm tối thiểu bữa trưa (g)', 'number'],
  ['startBodyFat', '% mỡ khởi điểm', 'number', 0.1],
  ['startMuscle', 'Khối lượng cơ (kg)', 'number', 0.1],
  ['visceralFat', 'Mỡ nội tạng', 'number', 0.5],
  ['goalBodyFat', '% mỡ mục tiêu', 'text'],
];

function renderSettings() {
  const S = state.settings;
  $('#settingsFields').innerHTML = SETTING_FIELDS.map(([k, l, t, step]) =>
    `<label>${l}<input type="${t}" name="${k}" value="${esc(S[k] ?? '')}" ${step ? `step="${step}"` : ''} ${t === 'number' ? 'inputmode="decimal"' : ''}></label>`).join('') +
    `<p class="muted span2">Macro hiện tại ≈ ${fmt(S.protein * 4 + S.carb * 4 + S.fat * 9)} kcal (đạm×4 + tinh bột×4 + béo×9).</p>`;
  renderLibrary();
}

$('#settingsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  for (const [k, , t] of SETTING_FIELDS) {
    const v = fd.get(k);
    if (t === 'number') {
      const n = parseFloat(String(v).replace(',', '.'));
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
    html += `<div class="lib-group">${esc(cat)} (${fs.length})</div>` + fs.map((f) => `
      <div class="lib-row">
        <div class="item-main"><div class="item-name">${esc(f.name)}</div><div class="item-meta">${fmt(f.kcal)} kcal · ${fmt(f.protein, f.protein % 1 ? 1 : 0)}g đạm</div></div>
        <button class="btn small" data-lib-edit="${f.id}">Sửa</button>
        <button class="btn small danger" data-lib-del="${f.id}">Xoá</button>
      </div>`).join('');
  }
  $('#libList').innerHTML = html || '<p class="muted">Không có món nào.</p>';
}
$('#libSearch').addEventListener('input', renderLibrary);

const libDlg = $('#libDialog');
let libEditId = null;
$('#lfCat').innerHTML = FOOD_CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join('');
function openLibDialog(food) {
  libEditId = food ? food.id : null;
  $('#libDlgTitle').textContent = food ? 'Sửa món' : 'Thêm món';
  $('#lfName').value = food ? food.name : '';
  $('#lfKcal').value = food ? food.kcal : '';
  $('#lfProtein').value = food ? food.protein : '';
  $('#lfCat').value = food ? (food.cat || 'Món tự thêm') : 'Món tự thêm';
  libDlg.showModal();
}
$('#libAddBtn').addEventListener('click', () => openLibDialog(null));
$('#libList').addEventListener('click', (e) => {
  const ed = e.target.closest('[data-lib-edit]');
  if (ed) return openLibDialog(state.foods.find((f) => f.id === ed.dataset.libEdit));
  const del = e.target.closest('[data-lib-del]');
  if (del) {
    const f = state.foods.find((x) => x.id === del.dataset.libDel);
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
    kcal: parseFloat($('#lfKcal').value) || 0,
    protein: parseFloat(String($('#lfProtein').value).replace(',', '.')) || 0,
    cat: $('#lfCat').value,
  };
  if (!data.name) return;
  if (libEditId) Object.assign(state.foods.find((f) => f.id === libEditId), data);
  else state.foods.push({ id: 'u' + uid(), ...data });
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
      for (const it of (d.meals[m.key] || [])) {
        rows.push([k, m.label, it.name, it.qty, Math.round(it.kcal * it.qty), r1(it.protein * it.qty), d.trained ? 'x' : '']);
      }
    }
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
// Enter trong hộp thêm món: không đóng hộp thoại
addDlg.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.target.id === 'foodSearch') return;
  e.preventDefault();
  if (e.target.id === 'qtyInput') $('#confirmAdd').click();
  else if (e.target.closest('#newFoodBox')) $('#nfAdd').click();
});

// Mốc cân khởi điểm
if (!Object.keys(state.weights).length) {
  state.weights[state.settings.startDate] = { kg: state.settings.startWeight, bf: state.settings.startBodyFat };
}
save();
render();
