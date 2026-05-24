// ═══════════════════ STATE ═══════════════════
const S = {
  contracts: [],
  regulations: [],
  sources: [],
  currentId: null,
  step: 1,
  editId: null,
  fScope: [],
  fInsts: []
};

// ═══════════════════ STORAGE ═══════════════════
function save() {
  try { localStorage.setItem('pmc_v2', JSON.stringify(S.contracts)); } catch(e) { alert('ไม่สามารถบันทึก: ' + e.message); }
}
function load() {
  try { const d = localStorage.getItem('pmc_v2'); if (d) S.contracts = JSON.parse(d); } catch(e) { S.contracts = []; }
}
function saveRegs() {
  try { localStorage.setItem('pmc_v2_regs', JSON.stringify(S.regulations)); } catch(e) {}
}
function loadRegs() {
  try { const d = localStorage.getItem('pmc_v2_regs'); if (d) S.regulations = JSON.parse(d); } catch(e) {}
}
function saveSources() {
  try { localStorage.setItem('pmc_v2_sources', JSON.stringify(S.sources)); } catch(e) {}
}
function loadSources() {
  try { const d = localStorage.getItem('pmc_v2_sources'); if (d) S.sources = JSON.parse(d); } catch(e) {}
}

// ═══════════════════ UTILS ═══════════════════
const uid = () => '_' + Math.random().toString(36).substr(2,9) + Date.now().toString(36);

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s + 'T12:00:00').toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' });
}
function fmtDateShort(s) {
  if (!s) return '—';
  return new Date(s + 'T12:00:00').toLocaleDateString('th-TH', { day:'2-digit', month:'2-digit', year:'2-digit' });
}
function fmtMoney(v) {
  if (!v && v !== 0) return '—';
  return parseFloat(v).toLocaleString('th-TH', { minimumFractionDigits: 2 });
}
function daysLeft(e) {
  if (!e) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.ceil((new Date(e + 'T12:00:00') - now) / 86400000);
}

function allItems(c) {
  let r = [];
  (c.installments || []).forEach(i => {
    r = r.concat(i.deliverables || [], i.vendorDocs || [], i.myDocs || []);
  });
  return r;
}

function progress(c) {
  const a = allItems(c);
  if (!a.length) return 0;
  return Math.round(a.filter(i => i.completed).length / a.length * 100);
}

function contractStatus(c) {
  const now = new Date(); now.setHours(0,0,0,0);
  const end = new Date(c.endDate + 'T12:00:00');
  const a = allItems(c);
  if (a.length && a.every(i => i.completed)) return 'completed';
  if (end < now) return 'overdue';
  return 'active';
}

function instStatus(i) {
  const now = new Date(); now.setHours(0,0,0,0);
  const s = new Date(i.startDate + 'T12:00:00');
  const e = new Date(i.endDate + 'T12:00:00');
  const a = [...(i.deliverables||[]), ...(i.vendorDocs||[]), ...(i.myDocs||[])];
  if (a.length && a.every(x => x.completed)) return 'completed';
  if (e < now) return 'overdue';
  if (s <= now && now <= e) return 'active';
  return 'pending';
}

function badge(st) {
  const m = {
    active: '<span class="badge badge-active">● กำลังดำเนินการ</span>',
    completed: '<span class="badge badge-done">✓ เสร็จสิ้น</span>',
    overdue: '<span class="badge badge-over">⚠ เกินกำหนด</span>',
    pending: '<span class="badge badge-pending">○ รอดำเนินการ</span>'
  };
  return m[st] || m.pending;
}

// ═══════════════════ VIEWS ═══════════════════
function goHome() {
  S.currentId = null;
  showView('v-home');
  document.getElementById('nav-home').classList.add('active');
  document.getElementById('nav-regs').classList.remove('active');
  renderDashboard();
  renderSidebar();
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function switchTab(el, tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  ['t-overview','t-timeline','t-installments','t-dochistory'].forEach(id => {
    document.getElementById(id)?.classList.toggle('is-active', id === tabId);
  });
  if (tabId === 't-timeline') renderGantt();
  if (tabId === 't-installments') renderInstallments();
  if (tabId === 't-dochistory') renderDocTimeline();
}

// ═══════════════════ DASHBOARD ═══════════════════
function renderDashboard() {
  const filter = document.getElementById('f-status-filter')?.value || '';
  const total = S.contracts.length;
  const active = S.contracts.filter(c => contractStatus(c) === 'active').length;
  const over = S.contracts.filter(c => contractStatus(c) === 'overdue').length;
  const done = S.contracts.filter(c => contractStatus(c) === 'completed').length;

  document.getElementById('stats-row').innerHTML = `
    <div class="stat"><div class="stat-icon stat-icon--total">📁</div><div><div class="stat-v">${total}</div><div class="stat-l">สัญญาทั้งหมด</div></div></div>
    <div class="stat"><div class="stat-icon stat-icon--active">🟢</div><div><div class="stat-v stat-v--active">${active}</div><div class="stat-l">กำลังดำเนินการ</div></div></div>
    <div class="stat"><div class="stat-icon stat-icon--over">🔴</div><div><div class="stat-v stat-v--over">${over}</div><div class="stat-l">เกินกำหนด</div></div></div>
    <div class="stat"><div class="stat-icon stat-icon--done">✅</div><div><div class="stat-v stat-v--done">${done}</div><div class="stat-l">เสร็จสิ้น</div></div></div>
  `;

  let list = S.contracts;
  if (filter) list = list.filter(c => contractStatus(c) === filter);

  const cg = document.getElementById('cg');
  if (!list.length) {
    cg.innerHTML = `<div class="empty empty--wide"><div class="empty-ic">📋</div><div class="empty-t">ยังไม่มีสัญญา</div><div class="empty-d">กดปุ่มด้านบนเพื่อเพิ่มสัญญาแรก</div><button class="btn btn-primary" onclick="openAdd()">+ เพิ่มสัญญาใหม่</button></div>`;
    return;
  }

  cg.innerHTML = list.map(c => {
    const st = contractStatus(c);
    const pct = progress(c);
    const dl = daysLeft(c.endDate);
    const dlText = dl === null ? '' : dl < 0 ? `เกินกำหนด ${Math.abs(dl)} วัน` : dl === 0 ? 'ครบกำหนดวันนี้' : `เหลือ ${dl} วัน`;
    const dlColor = dl !== null && dl < 0 ? '#dc2626' : dl !== null && dl <= 30 ? '#d97706' : '#059669';
    const ti = (c.installments || []).length;
    const di = (c.installments || []).filter(i => instStatus(i) === 'completed').length;
    return `<div class="cc ${st}" onclick="openDetail('${c.id}')">
      <div class="cc-name">${c.projectName}</div>
      <div class="cc-row">${badge(st)}</div>
      <div class="cc-row">🏢 ${c.vendor || '—'} &nbsp;|&nbsp; 📄 ${c.contractNumber || '—'}</div>
      <div class="cc-row" style="justify-content:space-between">
        <span>📅 ${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}</span>
        <span style="color:${dlColor};font-weight:700;font-size:11px">${dlText}</span>
      </div>
      <div class="prog"><div class="prog-fill" style="width:${pct}%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-3)">
        <span>งวด ${di}/${ti} เสร็จสิ้น</span>
        <span style="font-weight:800;color:var(--blue)">${pct}%</span>
      </div>
      ${c.contractValue ? `<div style="margin-top:10px;font-size:13px;font-weight:700;color:var(--navy)">💰 ${fmtMoney(c.contractValue)} บาท</div>` : ''}
    </div>`;
  }).join('');
}

// ═══════════════════ SIDEBAR ═══════════════════
function renderSidebar() {
  const q = (document.getElementById('sb-search')?.value || '').toLowerCase();
  const list = S.contracts.filter(c => c.projectName.toLowerCase().includes(q));
  document.getElementById('sb-count').textContent = S.contracts.length;
  const el = document.getElementById('sb-list');
  if (!list.length) { el.innerHTML = `<div class="sb-empty">ไม่พบสัญญา</div>`; return; }
  el.innerHTML = list.map(c => {
    const st = contractStatus(c);
    const pct = progress(c);
    return `<div class="sb-contract ${c.id === S.currentId ? 'active' : ''}" onclick="openDetail('${c.id}')">
      <div class="sb-contract-name">${c.projectName}</div>
      <div class="sb-contract-meta">${badge(st)}<span class="mono-pct">${pct}%</span></div>
      <div class="mini-bar"><div class="mini-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

// ═══════════════════ DETAIL ═══════════════════
function openDetail(id) {
  S.currentId = id;
  document.getElementById('nav-home').classList.remove('active');
  document.getElementById('nav-regs').classList.remove('active');
  showView('v-detail');
  renderDetail();
  renderSidebar();
}

function renderDetail() {
  const c = S.contracts.find(x => x.id === S.currentId);
  if (!c) { goHome(); return; }

  const st = contractStatus(c);
  const pct = progress(c);
  const dl = daysLeft(c.endDate);

  document.getElementById('bc-name').textContent = c.projectName;
  document.getElementById('d-project-name').textContent = c.projectName;
  document.getElementById('d-status-badge').innerHTML = badge(st);
  document.getElementById('d-contract-no').textContent = `📄 ${c.contractNumber || 'ไม่ระบุเลขที่'}`;
  document.getElementById('d-vendor').textContent = `🏢 ${c.vendor || '—'}`;

  document.getElementById('d-info').innerHTML = `
    <div class="ig-item"><div class="ig-label">วันที่เริ่มสัญญา</div><div class="ig-value">📅 ${fmtDate(c.startDate)}</div></div>
    <div class="ig-item"><div class="ig-label">วันที่สิ้นสุดสัญญา</div><div class="ig-value">📅 ${fmtDate(c.endDate)}</div></div>
    <div class="ig-item"><div class="ig-label">มูลค่าสัญญา</div><div class="ig-value">💰 ${c.contractValue ? fmtMoney(c.contractValue) + ' บาท' : '—'}</div></div>
    <div class="ig-item"><div class="ig-label">จำนวนงวด</div><div class="ig-value">📊 ${(c.installments||[]).length} งวด</div></div>
    <div class="ig-item"><div class="ig-label">เวลาที่เหลือ</div><div class="ig-value" style="color:${dl<0?'#dc2626':dl<=30?'#d97706':'#059669'}">${dl===null?'—':dl<0?`เกินกำหนด ${Math.abs(dl)} วัน`:dl===0?'ครบกำหนดวันนี้':`เหลือ ${dl} วัน`}</div></div>
    <div class="ig-item"><div class="ig-label">หมายเหตุ</div><div class="ig-value" style="font-size:13px;font-weight:500">${c.notes || '—'}</div></div>
  `;

  document.getElementById('d-prog-bar').style.width = pct + '%';
  document.getElementById('d-prog-pct').textContent = pct + '%';

  const scopeEl = document.getElementById('d-scope');
  if (!c.scopeItems?.length) {
    scopeEl.innerHTML = '<div style="color:var(--text-3);font-size:14px">ยังไม่ได้กำหนดขอบเขตงาน</div>';
  } else {
    scopeEl.innerHTML = c.scopeItems.map(s => `<div class="scope-row">${s}</div>`).join('');
  }

  // Reset to overview tab
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.tabs .tab')?.classList.add('active');
  ['t-overview','t-timeline','t-installments','t-dochistory'].forEach(id => {
    document.getElementById(id)?.classList.toggle('is-active', id === 't-overview');
  });
}

function editCurrent() { if (S.currentId) openEdit(S.currentId); }

function deleteCurrent() {
  const c = S.contracts.find(x => x.id === S.currentId);
  if (!c) return;
  if (!confirm(`ยืนยันการลบสัญญา\n"${c.projectName}"\n\nไม่สามารถกู้คืนได้`)) return;
  S.contracts = S.contracts.filter(x => x.id !== S.currentId);
  save();
  goHome();
}

// ═══════════════════ GANTT ═══════════════════
function renderGantt() {
  const c = S.contracts.find(x => x.id === S.currentId);
  const el = document.getElementById('gantt-inner');
  if (!c?.installments?.length) {
    el.innerHTML = '<div class="empty"><div class="empty-ic">📅</div><div class="empty-t">ไม่มีข้อมูลงวด</div></div>';
    return;
  }

  const cStart = new Date(c.startDate + 'T12:00:00');
  const cEnd   = new Date(c.endDate   + 'T12:00:00');
  const totalDays = (cEnd - cStart) / 86400000 || 1;

  const months = [];
  let cur = new Date(cStart); cur.setDate(1);
  while (cur <= cEnd) { months.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }
  const mw   = Math.max(70, Math.min(120, 640 / months.length));
  const barW = months.length * mw;

  const barColors = {
    completed: 'linear-gradient(90deg,#059669,#10b981)',
    overdue:   'linear-gradient(90deg,#dc2626,#ef4444)',
    active:    'linear-gradient(90deg,#2357c5,#60a5fa)',
    pending:   'linear-gradient(90deg,#94a3b8,#cbd5e1)'
  };

  // helpers
  const dateX = d => {
    if (!d) return null;
    const x = Math.round(((new Date(d + 'T12:00:00') - cStart) / 86400000 / totalDays) * barW);
    return (x >= -4 && x <= barW + 4) ? x : null;
  };
  const gridBg = months.map(() => `<div style="width:${mw}px;border-left:1px solid #f1f5f9;height:100%"></div>`).join('');
  const todayX = dateX(new Date().toISOString().split('T')[0]);
  const todayLineHtml = todayX !== null
    ? `<div style="position:absolute;left:${todayX}px;top:0;bottom:0;width:2px;background:rgba(220,38,38,.4);z-index:4;pointer-events:none">
         <span style="position:absolute;top:3px;left:4px;font-size:9px;color:#dc2626;font-weight:700;white-space:nowrap;font-family:'IBM Plex Mono',monospace">วันนี้</span>
       </div>`
    : '';

  // legend
  const legend = `<div style="display:flex;align-items:center;gap:14px;padding:10px 14px;background:var(--surface-2);border-bottom:1px solid var(--border);font-size:11px;color:var(--text-3)">
    <span style="font-weight:700;color:var(--text-2)">สัญลักษณ์:</span>
    <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#059669;margin-right:4px;vertical-align:middle"></span>สิ่งที่ต้องส่งมอบ (เสร็จ)</span>
    <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#2357c5;margin-right:4px;vertical-align:middle"></span>เอกสารจากผู้รับจ้าง</span>
    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;transform:rotate(45deg);background:#d97706;margin-right:6px;vertical-align:middle"></span>เอกสารที่ต้องดำเนินการ</span>
    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;transform:rotate(45deg);background:#dc2626;margin-right:6px;vertical-align:middle"></span>เกินกำหนด</span>
    <span style="margin-left:4px">▶ คลิกงวดเพื่อดูเอกสาร</span>
  </div>`;

  let html = `<div class="gantt-wrap" style="border-radius:0;border:none">` + legend +
    `<table class="gantt-tbl" style="min-width:${305+barW}px;border-collapse:collapse;table-layout:fixed">
    <colgroup>
      <col style="width:165px">
      <col style="width:90px">
      <col style="width:50px">
      <col style="width:${barW}px">
    </colgroup>
    <thead>
      <tr>
        <th>งวด / เอกสาร</th>
        <th>ช่วงเวลา</th>
        <th style="text-align:center">%</th>
        <th style="padding:0">
          <div style="display:flex;border-left:1px solid rgba(255,255,255,.1)">
            ${months.map(m => `<div style="width:${mw}px;padding:10px 4px;text-align:center;font-size:10px;border-left:1px solid rgba(255,255,255,.1)">${m.toLocaleDateString('th-TH',{month:'short',year:'2-digit'})}</div>`).join('')}
          </div>
        </th>
      </tr>
    </thead><tbody>`;

  c.installments.forEach((inst, idx) => {
    const is  = new Date(inst.startDate + 'T12:00:00');
    const ie  = new Date(inst.endDate   + 'T12:00:00');
    const off = Math.max(0, (is - cStart) / 86400000);
    const dur = Math.max(1, (ie - is) / 86400000);
    const left  = (off / totalDays) * barW;
    const width = Math.max(24, (dur / totalDays) * barW);
    const ist = instStatus(inst);
    const allItems = [...(inst.deliverables||[]), ...(inst.vendorDocs||[]), ...(inst.myDocs||[])];
    const pct = allItems.length ? Math.round(allItems.filter(x => x.completed).length / allItems.length * 100) : 0;

    // Dot markers on the main Gantt bar row
    let markers = '';
    (inst.vendorDocs||[]).filter(d => d.date).forEach(d => {
      const x = dateX(d.date);
      if (x !== null) markers += `<div title="📥 ${d.name}&#10;📅 ${fmtDate(d.date)}" style="position:absolute;left:${x-4}px;top:5px;width:8px;height:8px;border-radius:50%;background:#2357c5;border:1.5px solid #fff;z-index:6;cursor:default"></div>`;
    });
    (inst.myDocs||[]).filter(d => d.dueDate).forEach(d => {
      const x = dateX(d.dueDate);
      const over = daysLeft(d.dueDate) < 0 && !d.completed;
      if (x !== null) markers += `<div title="📤 ${d.name}&#10;📅 ${fmtDate(d.dueDate)}${over?' ⚠ เกินกำหนด':''}" style="position:absolute;left:${x-4}px;bottom:5px;width:8px;height:8px;border-radius:2px;transform:rotate(45deg);background:${over?'#dc2626':'#d97706'};border:1.5px solid #fff;z-index:6;cursor:default"></div>`;
    });

    html += `
    <tr style="cursor:pointer" onclick="toggleGanttDocs('${inst.id}')">
      <td style="font-weight:700;font-size:13px;padding:10px 12px">
        <div style="display:flex;align-items:center;gap:7px">
          <span id="gt-${inst.id}" style="font-size:11px;color:var(--blue);transition:transform .2s;display:inline-block;flex-shrink:0">▶</span>
          <div>งวดที่ ${inst.number||idx+1}
            ${inst.name ? `<div style="font-weight:400;font-size:11px;color:var(--text-3);margin-top:1px">${inst.name}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="font-size:11px;color:var(--text-3);font-family:'IBM Plex Mono',monospace;padding:10px 12px">${fmtDateShort(inst.startDate)}<br>–${fmtDateShort(inst.endDate)}</td>
      <td style="text-align:center;font-weight:800;font-size:13px;color:${pct===100?'#059669':'var(--blue)'};padding:10px 12px">${pct}%</td>
      <td class="gantt-cell">
        <div style="position:absolute;inset:0;display:flex">${gridBg}</div>
        ${todayLineHtml}
        ${markers}
        <div style="position:absolute;left:${left}px;width:${width}px;height:26px;top:50%;transform:translateY(-50%);border-radius:5px;background:${barColors[ist]};display:flex;align-items:center;padding:0 8px;box-shadow:0 2px 6px rgba(0,0,0,.15);overflow:hidden">
          <span style="color:#fff;font-size:11px;font-weight:700;white-space:nowrap">งวด${inst.number||idx+1}</span>
        </div>
      </td>
    </tr>
    <tr id="gd-${inst.id}" style="display:none">
      <td colspan="4" style="padding:0;border-bottom:2px solid var(--border-strong)">
        ${buildGanttDocRows(inst, barW, totalDays, cStart, gridBg, todayLineHtml)}
      </td>
    </tr>`;
  });

  html += `</tbody></table></div>`;
  el.innerHTML = html;
}

function toggleGanttDocs(instId) {
  const row   = document.getElementById('gd-' + instId);
  const arrow = document.getElementById('gt-' + instId);
  if (!row) return;
  const opening = row.style.display === 'none';
  row.style.display = opening ? 'table-row' : 'none';
  if (arrow) arrow.style.transform = opening ? 'rotate(90deg)' : '';
}

function buildGanttDocRows(inst, barW, totalDays, cStart, gridBg, todayLineHtml) {
  function dateX(d) {
    if (!d) return null;
    var x = Math.round(((new Date(d + 'T12:00:00') - cStart) / 86400000 / totalDays) * barW);
    return (x >= -4 && x <= barW + 4) ? x : null;
  }

  var sections = [
    { key: 'deliverables', title: '📦 สิ่งที่ต้องส่งมอบ',      dotColor: '#059669', diamond: false, items: inst.deliverables || [], dateField: null },
    { key: 'vendorDocs',   title: '📥 เอกสารจากผู้รับจ้าง',    dotColor: '#2357c5', diamond: false, items: inst.vendorDocs   || [], dateField: 'date' },
    { key: 'myDocs',       title: '📤 เอกสารที่ต้องดำเนินการ', dotColor: '#d97706', diamond: true,  items: inst.myDocs       || [], dateField: 'dueDate' }
  ];

  var INFO_W = 305; // px — matches outer cols 1–3 (165+90+50)
  var out = '';
  var hasSomething = false;

  sections.forEach(function(sec) {
    var hasItems  = sec.items.length > 0;
    var hasReport = sec.key === 'deliverables' && inst.deliverableReportFileName;
    if (!hasItems && !hasReport) return;
    hasSomething = true;

    // ── Section header row ──
    out += '<div style="display:flex;align-items:stretch;background:var(--navy)">'
         +   '<div style="width:' + INFO_W + 'px;min-width:' + INFO_W + 'px;padding:6px 12px 6px 20px;font-size:10px;font-weight:700;color:rgba(255,255,255,.75);text-transform:uppercase;letter-spacing:.7px">' + sec.title + '</div>'
         +   '<div style="flex:1;position:relative;height:26px">'
         +     '<div style="position:absolute;inset:0;display:flex;opacity:.35">' + gridBg + '</div>'
         +     todayLineHtml
         +   '</div>'
         + '</div>';

    // ── Document item rows ──
    sec.items.forEach(function(item) {
      var dateStr = sec.dateField ? (item[sec.dateField] || null) : null;
      var x       = dateX(dateStr);
      var validX  = x !== null;
      var isOver  = !!(dateStr && !item.completed && daysLeft(dateStr) < 0);
      var dotColor = item.completed ? '#059669' : (isOver ? '#dc2626' : sec.dotColor);
      var dotStyle = sec.diamond
        ? 'border-radius:2px;transform:translate(-50%,-50%) rotate(45deg)'
        : 'border-radius:50%;transform:translate(-50%,-50%)';

      var dot = validX
        ? '<div style="position:absolute;left:' + x + 'px;top:50%;width:10px;height:10px;background:' + dotColor + ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);z-index:5;' + dotStyle + '"></div>'
        : '';
      var dotLabel = (validX && dateStr)
        ? '<div style="position:absolute;left:' + (x + 8) + 'px;top:50%;transform:translateY(-50%);font-size:10px;color:var(--text-3);white-space:nowrap;font-family:\'IBM Plex Mono\',monospace">' + fmtDateShort(dateStr) + '</div>'
        : '';

      var extra = '';
      if (sec.key === 'vendorDocs' && item.detail)     extra = '<div style="font-size:11px;color:var(--text-3);margin-top:2px">📝 ' + item.detail + '</div>';
      if (sec.key === 'myDocs'     && item.regulation) extra = '<div style="font-size:11px;color:#7c3aed;margin-top:2px">⚖️ ' + item.regulation + '</div>';

      var rowH = extra ? '64px' : '46px';

      out += '<div style="display:flex;align-items:stretch;border-top:1px solid var(--border)">'
           +   '<div style="width:' + INFO_W + 'px;min-width:' + INFO_W + 'px;padding:8px 12px 8px 28px">'
           +     '<div style="display:flex;align-items:flex-start;gap:7px">'
           +       '<span style="font-size:14px;flex-shrink:0;margin-top:1px">' + (item.completed ? '✅' : '⬜') + '</span>'
           +       '<div style="min-width:0">'
           +         '<div style="font-size:13px;font-weight:500;color:' + (item.completed ? 'var(--text-3)' : 'var(--text)') + ';text-decoration:' + (item.completed ? 'line-through' : 'none') + ';line-height:1.35">' + (item.name || '') + '</div>'
           +         (dateStr ? '<div style="font-size:11px;color:' + (isOver ? '#dc2626' : 'var(--text-3)') + ';margin-top:2px;font-family:\'IBM Plex Mono\',monospace">📅 ' + fmtDate(dateStr) + (isOver ? ' · เกินกำหนด' : '') + '</div>' : '')
           +         extra
           +         (item.completedDate && item.completed ? '<div style="font-size:11px;color:var(--green);margin-top:2px">✓ เสร็จ ' + fmtDate(item.completedDate) + '</div>' : '')
           +       '</div>'
           +     '</div>'
           +   '</div>'
           +   '<div style="flex:1;position:relative;min-height:' + rowH + '">'
           +     '<div style="position:absolute;inset:0;display:flex">' + gridBg + '</div>'
           +     todayLineHtml
           +     dot + dotLabel
           +   '</div>'
           + '</div>';
    });

    // ── Shared report file (deliverables) ──
    if (sec.key === 'deliverables' && hasReport) {
      out += '<div style="border-top:1px solid var(--border);background:var(--surface-2);padding:6px 12px 6px 44px;font-size:12px;color:var(--blue)">📄 ไฟล์รายงานผล: ' + inst.deliverableReportFileName + '</div>';
    }
  });

  if (!hasSomething) {
    out = '<div style="padding:12px 20px;font-size:13px;color:var(--text-3)">ไม่มีเอกสารในงวดนี้</div>';
  }

  return out;
}

// ═══════════════════ INSTALLMENTS VIEW ═══════════════════
function renderInstallments() {
  const c = S.contracts.find(x => x.id === S.currentId);
  const el = document.getElementById('inst-list');
  if (!c?.installments?.length) {
    el.innerHTML = `<div class="empty"><div class="empty-ic">📂</div><div class="empty-t">ไม่มีข้อมูลงวด</div><div class="empty-d">แก้ไขสัญญาเพื่อเพิ่มข้อมูลงวด</div></div>`;
    return;
  }

  el.innerHTML = c.installments.map((inst, idx) => {
    const ist = instStatus(inst);
    const a = [...(inst.deliverables||[]),...(inst.vendorDocs||[]),...(inst.myDocs||[])];
    const done = a.filter(x => x.completed).length;
    const pct = a.length ? Math.round(done/a.length*100) : 0;
    const isOpen = true;

    return `<div class="inst-card" id="ic-${inst.id}">
      <div class="inst-hd" onclick="toggleInst('${inst.id}')">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="num-badge">${inst.number||idx+1}</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--navy)">งวดที่ ${inst.number||idx+1}${inst.name ? ': ' + inst.name : ''}</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:2px">
              📅 ${fmtDate(inst.startDate)} – ${fmtDate(inst.endDate)}
              ${inst.percentage ? ` &nbsp;|&nbsp; 💰 ${inst.percentage}%` : ''}
              ${c.contractValue && inst.percentage ? ` (${fmtMoney(c.contractValue * inst.percentage / 100)} บาท)` : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          ${badge(ist)}
          <span style="font-size:13px;font-weight:800;color:var(--blue);font-family:'IBM Plex Mono',monospace">${pct}%</span>
          <span class="collapse-arrow ${isOpen?'open':''}" id="ca-${inst.id}">▼</span>
        </div>
      </div>
      <div class="collapsible ${isOpen?'open':''}" id="cb-${inst.id}">
        <div class="inst-body">
          <div style="margin-bottom:16px">
            <div class="big-prog"><div class="big-prog-fill" style="width:${pct}%"></div></div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-3);margin-top:4px">
              <span>เสร็จแล้ว ${done}/${a.length} รายการ</span><span style="font-weight:700">${pct}%</span>
            </div>
          </div>
          ${clSection('📦 สิ่งที่ต้องส่งมอบ', inst.deliverables||[], c.id, inst.id, 'deliverables', inst)}
          ${clSection('📥 เอกสารจากผู้รับจ้าง', inst.vendorDocs||[], c.id, inst.id, 'vendorDocs', inst)}
          ${clSection('📤 เอกสารที่ต้องดำเนินการ', inst.myDocs||[], c.id, inst.id, 'myDocs', inst)}
        </div>
      </div>
    </div>`;
  }).join('');
}

function clSection(title, items, cId, instId, key, inst) {
  const done = items.filter(i => i.completed).length;
  const itemsHtml = items.length === 0
    ? `<div style="font-size:13px;color:var(--text-3);padding:6px 0">ไม่มีรายการ</div>`
    : items.map(item => {
        let metaHtml = '';
        if (key === 'myDocs') {
          const dueDl = item.dueDate ? daysLeft(item.dueDate) : null;
          const over = dueDl !== null && dueDl < 0 && !item.completed;
          const dueLabel = item.dueDate
            ? (dueDl < 0 ? `เกินกำหนด ${Math.abs(dueDl)} วัน` : dueDl === 0 ? 'ครบกำหนดวันนี้' : `ภายใน ${fmtDate(item.dueDate)}`)
            : '';
          metaHtml = `
            ${item.dueDate ? `<span class="tag-due${over?' overdue':''}">📅 ${dueLabel}</span>` : ''}
            ${item.regulation ? `<span class="tag-reg" title="${item.regulation}">⚖️ ${item.regulation}</span>` : ''}`;
        } else if (key === 'vendorDocs') {
          metaHtml = `
            ${item.date ? `<span class="tag-due">📅 ${fmtDate(item.date)}</span>` : ''}
            ${item.detail ? `<span class="tag-reg" style="color:var(--text-2);background:var(--surface-2);border-color:var(--border)">📝 ${item.detail}</span>` : ''}`;
        }
        const fileHtml = key !== 'deliverables' ? `
            ${item.fileName ? `<span class="tag-file" onclick="dlFile('${cId}','${instId}','${key}','${item.id}')">📎 ${item.fileName}</span>` : ''}
            <label class="tag-attach">
              📎 ${item.fileName ? 'เปลี่ยนไฟล์' : 'แนบไฟล์'}
              <input type="file" class="hidden-file" onchange="attachFile('${cId}','${instId}','${key}','${item.id}',this)">
            </label>` : '';
        return `
        <div class="cl-item ${item.completed?'done-item':''}" id="cli-${item.id}">
          <input type="checkbox" ${item.completed?'checked':''} onchange="toggleItem('${cId}','${instId}','${key}','${item.id}',this.checked)">
          <div class="cl-item-content">
            <div class="cl-name ${item.completed?'struck':''}">${item.name}</div>
            <div class="cl-meta">
              ${metaHtml}
              ${item.completedDate ? `<span class="tag-date">✓ ${fmtDate(item.completedDate)}</span>` : ''}
              ${fileHtml}
            </div>
          </div>
        </div>`;
      }).join('');

  const sharedFileHtml = key === 'deliverables' ? `
    <div style="margin-top:8px;padding:10px 12px;background:var(--bg);border:1px dashed var(--border-strong);border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <span style="font-size:13px;font-weight:600;color:var(--text-2)">📄 ไฟล์รายงานผล <span style="font-weight:400;font-size:12px;color:var(--text-3)">(รวมทุกรายการ)</span></span>
      <div style="display:flex;align-items:center;gap:8px">
        ${inst?.deliverableReportFileName ? `<span class="tag-file" onclick="dlDelivReport('${cId}','${instId}')">📎 ${inst.deliverableReportFileName}</span>` : ''}
        <label class="tag-attach" style="cursor:pointer">
          📎 ${inst?.deliverableReportFileName ? 'เปลี่ยนไฟล์' : 'แนบไฟล์รายงาน'}
          <input type="file" class="hidden-file" onchange="attachDelivReport('${cId}','${instId}',this)">
        </label>
      </div>
    </div>` : '';

  return `<div class="cl-section">
    <div class="cl-title">
      <span>${title}</span>
      <span style="font-weight:400;font-size:11px;color:var(--text-3)">${done}/${items.length}</span>
    </div>
    ${itemsHtml}
    ${sharedFileHtml}
  </div>`;
}

function toggleInst(instId) {
  const cb = document.getElementById('cb-' + instId);
  const ca = document.getElementById('ca-' + instId);
  cb.classList.toggle('open');
  ca.classList.toggle('open');
}

// ═══════════════════ CHECKLIST ACTIONS ═══════════════════
function toggleItem(cId, instId, key, itemId, checked) {
  const c = S.contracts.find(x => x.id === cId);
  const inst = c?.installments?.find(x => x.id === instId);
  const item = (inst?.[key] || []).find(x => x.id === itemId);
  if (!item) return;
  item.completed = checked;
  item.completedDate = checked ? new Date().toISOString().split('T')[0] : null;
  save();
  renderInstallments();
  renderSidebar();
  // update progress bar in overview if visible
  const pct = progress(c);
  const pb = document.getElementById('d-prog-bar');
  const pp = document.getElementById('d-prog-pct');
  if (pb) pb.style.width = pct + '%';
  if (pp) pp.textContent = pct + '%';
}

function attachFile(cId, instId, key, itemId, input) {
  if (!input.files?.[0]) return;
  const file = input.files[0];
  if (file.size > 4 * 1024 * 1024) { alert('ไฟล์ขนาดใหญ่เกินไป (สูงสุด 4MB)'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const c = S.contracts.find(x => x.id === cId);
    const inst = c?.installments?.find(x => x.id === instId);
    const item = (inst?.[key] || []).find(x => x.id === itemId);
    if (!item) return;
    item.fileData = e.target.result;
    item.fileName = file.name;
    save();
    renderInstallments();
  };
  reader.readAsDataURL(file);
}

function dlFile(cId, instId, key, itemId) {
  const c = S.contracts.find(x => x.id === cId);
  const inst = c?.installments?.find(x => x.id === instId);
  const item = (inst?.[key] || []).find(x => x.id === itemId);
  if (!item?.fileData) return;
  const a = document.createElement('a');
  a.href = item.fileData;
  a.download = item.fileName;
  a.click();
}

function attachDelivReport(cId, instId, input) {
  if (!input.files?.[0]) return;
  const file = input.files[0];
  if (file.size > 4 * 1024 * 1024) { alert('ไฟล์ขนาดใหญ่เกินไป (สูงสุด 4MB)'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const c = S.contracts.find(x => x.id === cId);
    const inst = c?.installments?.find(x => x.id === instId);
    if (!inst) return;
    inst.deliverableReportFile = e.target.result;
    inst.deliverableReportFileName = file.name;
    save();
    renderInstallments();
  };
  reader.readAsDataURL(file);
}

function dlDelivReport(cId, instId) {
  const c = S.contracts.find(x => x.id === cId);
  const inst = c?.installments?.find(x => x.id === instId);
  if (!inst?.deliverableReportFile) return;
  const a = document.createElement('a');
  a.href = inst.deliverableReportFile;
  a.download = inst.deliverableReportFileName;
  a.click();
}

// ═══════════════════ FORM / MODAL ═══════════════════
let editId = null, fStep = 1, fScope = [], fInsts = [];

function openAdd() {
  editId = null; fStep = 1; fScope = []; fInsts = [];
  resetForm();
  document.getElementById('m-contract-title').textContent = 'เพิ่มสัญญาใหม่';
  showStep(1);
  document.getElementById('m-contract').classList.add('open');
}

function openEdit(id) {
  const c = S.contracts.find(x => x.id === id);
  if (!c) return;
  editId = id; fStep = 1;
  fScope = [...(c.scopeItems || [])];
  fInsts = JSON.parse(JSON.stringify(c.installments || []));
  resetForm();
  document.getElementById('f-name').value = c.projectName || '';
  document.getElementById('f-cno').value = c.contractNumber || '';
  document.getElementById('f-vendor').value = c.vendor || '';
  document.getElementById('f-val').value = c.contractValue || '';
  document.getElementById('f-instcount').value = (c.installments||[]).length;
  document.getElementById('f-sdate').value = c.startDate || '';
  document.getElementById('f-edate').value = c.endDate || '';
  document.getElementById('f-notes').value = c.notes || '';
  document.getElementById('m-contract-title').textContent = 'แก้ไขสัญญา';
  showStep(1);
  document.getElementById('m-contract').classList.add('open');
}

function resetForm() {
  ['f-name','f-cno','f-vendor','f-val','f-instcount','f-sdate','f-edate','f-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function showStep(n) {
  fStep = n;
  ['fs1','fs2','fs3'].forEach((id, i) => {
    document.getElementById(id).style.display = (i+1 === n) ? 'block' : 'none';
  });
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById('stp' + i);
    el.className = 'step ' + (i < n ? 's-done' : i === n ? 's-active' : '');
  }
  document.getElementById('btn-prev').style.display = n > 1 ? 'inline-flex' : 'none';
  document.getElementById('btn-next').style.display = n < 3 ? 'inline-flex' : 'none';
  document.getElementById('btn-save').style.display = n === 3 ? 'inline-flex' : 'none';
  if (n === 2) renderScopeForm();
  if (n === 3) renderInstsForm();
}

function nextStep() {
  if (fStep === 1) {
    if (!document.getElementById('f-name').value.trim()) return alert('กรุณาระบุชื่อโครงการ');
    if (!document.getElementById('f-vendor').value.trim()) return alert('กรุณาระบุชื่อผู้รับจ้าง');
    if (!document.getElementById('f-sdate').value) return alert('กรุณาระบุวันที่เริ่มสัญญา');
    if (!document.getElementById('f-edate').value) return alert('กรุณาระบุวันที่สิ้นสุดสัญญา');
    if (!document.getElementById('f-instcount').value) return alert('กรุณาระบุจำนวนงวด');
  }
  showStep(fStep + 1);
}

function prevStep() { showStep(fStep - 1); }

// ── Scope Form ──
let scopeInputMode = 'bulk';

function scopeMode(mode) {
  scopeInputMode = mode;
  document.getElementById('scope-bulk-panel').style.display = mode === 'bulk' ? 'block' : 'none';
  document.getElementById('scope-single-panel').style.display = mode === 'single' ? 'block' : 'none';
  const bulkBtn = document.getElementById('scope-tab-bulk');
  const singleBtn = document.getElementById('scope-tab-single');
  bulkBtn.classList.toggle('btn-primary', mode === 'bulk');
  bulkBtn.classList.toggle('btn-ghost', mode !== 'bulk');
  singleBtn.classList.toggle('btn-primary', mode === 'single');
  singleBtn.classList.toggle('btn-ghost', mode !== 'single');
  if (mode === 'single') renderScopeList();
}

function parseBulkText(text) {
  return text.split('\n')
    .map(line => line
      .replace(/^\s*[\d๐-๙]+[.)]\s*/, '')   // strip "1." "2)" "๑."
      .replace(/^\s*[-–•○※▪▸]\s*/, '')       // strip bullet chars
      .replace(/^\s*\([\d๐-๙]+\)\s*/, '')    // strip "(1)"
      .trim()
    )
    .filter(line => line.length > 0);
}

function bulkAddScope() {
  const text = document.getElementById('scope-bulk-input').value;
  const items = parseBulkText(text);
  if (!items.length) { alert('ไม่พบรายการ — กรุณาวางข้อความที่มีเนื้อหา'); return; }
  const dupes = items.filter(it => fScope.includes(it));
  const newItems = items.filter(it => !fScope.includes(it));
  fScope.push(...newItems);
  document.getElementById('scope-bulk-input').value = '';
  document.getElementById('scope-bulk-preview').innerHTML = '';
  document.getElementById('scope-bulk-count').textContent = '';
  renderScopeCurrentList();
  if (dupes.length) alert(`เพิ่ม ${newItems.length} รายการ (ข้าม ${dupes.length} รายการซ้ำ)`);
}

// live preview while typing/pasting
function initBulkPreview() {
  const ta = document.getElementById('scope-bulk-input');
  if (!ta) return;
  ta.addEventListener('input', () => {
    const items = parseBulkText(ta.value);
    const countEl = document.getElementById('scope-bulk-count');
    const prevEl = document.getElementById('scope-bulk-preview');
    if (!items.length) { countEl.textContent = ''; prevEl.innerHTML = ''; return; }
    countEl.textContent = `พบ ${items.length} รายการ`;
    prevEl.innerHTML = `<div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">ตัวอย่างรายการที่จะนำเข้า</div>` +
      items.slice(0, 5).map(it => `<div style="font-size:13px;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:6px;margin-bottom:3px">✓ ${it}</div>`).join('') +
      (items.length > 5 ? `<div style="font-size:12px;color:var(--text-3);padding:4px 8px">...และอีก ${items.length - 5} รายการ</div>` : '');
  });
}

function renderScopeForm() {
  scopeMode(scopeInputMode);
  renderScopeCurrentList();
  initBulkPreview();
}

function renderScopeList() {
  const el = document.getElementById('scope-list');
  if (!el) return;
  if (!fScope.length) { el.innerHTML = `<div style="color:var(--text-3);font-size:13px;text-align:center;padding:12px">ยังไม่มีรายการ — เพิ่มด้านล่าง</div>`; return; }
  el.innerHTML = fScope.map((s, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--bg);border:1px solid var(--border);border-radius:7px;margin-bottom:5px">
      <span style="color:var(--green);font-weight:800">✓</span>
      <span style="flex:1;font-size:14px">${s}</span>
      <button onclick="removeScope(${i})" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:17px;padding:0 2px">×</button>
    </div>`).join('');
}

function renderScopeCurrentList() {
  const el = document.getElementById('scope-current');
  if (!el) return;
  if (!fScope.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px">รายการที่เพิ่มแล้ว (${fScope.length} รายการ)</div>
      <button class="btn btn-ghost btn-sm" onclick="if(confirm('ล้างรายการทั้งหมด?')){fScope=[];renderScopeCurrentList();}" style="font-size:11px;color:var(--red);border-color:var(--red)">ล้างทั้งหมด</button>
    </div>` +
    fScope.map((s, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--bg);border:1px solid var(--border);border-radius:7px;margin-bottom:5px">
      <span style="color:var(--text-3);font-size:12px;min-width:20px;font-weight:700">${i+1}.</span>
      <span style="flex:1;font-size:14px">${s}</span>
      <button onclick="removeScope(${i})" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:17px;padding:0 2px" title="ลบ">×</button>
    </div>`).join('');
}

function addScope() {
  const inp = document.getElementById('scope-new');
  const v = inp.value.trim();
  if (!v) return;
  fScope.push(v);
  inp.value = '';
  renderScopeList();
  renderScopeCurrentList();
}

function removeScope(i) {
  fScope.splice(i, 1);
  renderScopeList();
  renderScopeCurrentList();
}

// ── Installments Form ──
function syncInstCount() {
  const n = parseInt(document.getElementById('f-instcount').value) || 0;
  while (fInsts.length < n) fInsts.push({ id: uid(), number: fInsts.length + 1, name: '', startDate: '', endDate: '', percentage: '', deliverables: [], deliverableReportFile: null, deliverableReportFileName: null, vendorDocs: [], myDocs: [] });
  while (fInsts.length > n) fInsts.pop();
}

function renderInstsForm() {
  syncInstCount();
  const el = document.getElementById('insts-form');
  if (!fInsts.length) { el.innerHTML = `<div class="alert alert-warn">⚠️ กรุณาระบุจำนวนงวดในขั้นตอนที่ 1 ก่อน</div>`; return; }
  el.innerHTML = fInsts.map((inst, idx) => `
    <div style="border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div class="num-badge">${idx+1}</div>
        <div style="font-size:14px;font-weight:800;color:var(--navy)">งวดที่ ${idx+1}</div>
      </div>
      <div class="fr" style="margin-bottom:12px">
        <div class="fg" style="margin-bottom:0">
          <label class="fl" style="font-size:11px">ชื่องวด (ถ้ามี)</label>
          <input type="text" class="fc" value="${inst.name||''}" placeholder="เช่น รายงานความก้าวหน้า"
            onchange="fInsts[${idx}].name=this.value">
        </div>
        <div class="fg" style="margin-bottom:0">
          <label class="fl" style="font-size:11px">สัดส่วน (%)</label>
          <input type="number" class="fc" value="${inst.percentage||''}" min="1" max="100" placeholder="%"
            onchange="fInsts[${idx}].percentage=parseFloat(this.value)||''">
        </div>
      </div>
      <div class="fr" style="margin-bottom:14px">
        <div class="fg" style="margin-bottom:0">
          <label class="fl" style="font-size:11px">วันเริ่มต้นงวด <span class="req">*</span></label>
          <input type="date" class="fc" value="${inst.startDate||''}"
            onchange="fInsts[${idx}].startDate=this.value">
        </div>
        <div class="fg" style="margin-bottom:0">
          <label class="fl" style="font-size:11px">วันสิ้นสุดงวด <span class="req">*</span></label>
          <input type="date" class="fc" value="${inst.endDate||''}"
            onchange="fInsts[${idx}].endDate=this.value">
        </div>
      </div>

      ${instCheckSection(idx, 'deliverables', '📦 สิ่งที่ต้องส่งมอบ', 'inst-del', 'เช่น รายงานฉบับสมบูรณ์, ซอฟต์แวร์, คู่มือ...')}
      ${instCheckSection(idx, 'vendorDocs', '📥 เอกสารจากผู้รับจ้าง', 'inst-vdoc', 'เช่น ใบแจ้งหนี้, รายงานความก้าวหน้า, หนังสือขอรับเงิน...')}
      ${instCheckSection(idx, 'myDocs', '📤 เอกสารที่ต้องดำเนินการ', 'inst-mdoc', 'เช่น รายงานการตรวจรับ, บันทึกตรวจรับงาน, ใบสั่งจ่าย...')}
    </div>`).join('');

  fInsts.forEach((inst, idx) => {
    renderInstItems(idx, 'deliverables', 'inst-del-' + idx);
    renderInstItems(idx, 'vendorDocs', 'inst-vdoc-' + idx);
    renderInstItems(idx, 'myDocs', 'inst-mdoc-' + idx);
    const fnEl = document.getElementById('del-fname-' + idx);
    if (fnEl && inst.deliverableReportFileName) fnEl.textContent = '📎 ' + inst.deliverableReportFileName;
  });
}

function instCheckSection(idx, key, title, prefix, placeholder) {
  const lbl = `<div style="font-size:11px;font-weight:700;color:var(--text-3);margin-bottom:7px;text-transform:uppercase;letter-spacing:.5px">${title}</div>`;

  if (key === 'deliverables') {
    return `<div style="margin-bottom:12px">
      ${lbl}
      <div id="${prefix}-${idx}"></div>
      <div class="air" style="margin-bottom:8px">
        <input type="text" class="fc" id="ni-del-${idx}" placeholder="${placeholder}" style="font-size:13px"
          onkeydown="if(event.key==='Enter')addInstItem(${idx},'deliverables','ni-del-${idx}','${prefix}-${idx}')">
        <button class="btn btn-ghost btn-sm" onclick="addInstItem(${idx},'deliverables','ni-del-${idx}','${prefix}-${idx}')">+ เพิ่ม</button>
      </div>
      <div style="padding:8px 12px;background:var(--bg);border:1px dashed var(--border-strong);border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <span style="font-size:12px;font-weight:600;color:var(--text-2)">📄 ไฟล์รายงานผล <span style="font-weight:400;color:var(--text-3)">(รวมทุกรายการ)</span></span>
        <div style="display:flex;align-items:center;gap:8px">
          <span id="del-fname-${idx}" style="font-size:12px;color:var(--blue)"></span>
          <label class="btn btn-ghost btn-sm" style="cursor:pointer;margin:0">
            📎 แนบไฟล์รายงาน
            <input type="file" class="hidden-file" onchange="setDelivReportFile(${idx},this)">
          </label>
        </div>
      </div>
    </div>`;
  }

  if (key === 'vendorDocs') {
    return `<div style="margin-bottom:12px">
      ${lbl}
      <div id="${prefix}-${idx}"></div>
      <div class="mydoc-form">
        <div class="fg" style="margin-bottom:8px">
          <label class="fl" style="font-size:11px">ชื่อเอกสาร <span class="req">*</span></label>
          <input type="text" class="fc" id="ni-vdoc-name-${idx}" placeholder="${placeholder}" style="font-size:13px"
            onkeydown="if(event.key==='Enter')addVendorDocItem(${idx})">
        </div>
        <div class="fr" style="margin-bottom:8px">
          <div class="fg" style="margin-bottom:0">
            <label class="fl" style="font-size:11px">📅 วันที่รับเอกสาร</label>
            <input type="date" class="fc" id="ni-vdoc-date-${idx}" style="font-size:13px">
          </div>
          <div class="fg" style="margin-bottom:0">
            <label class="fl" style="font-size:11px">📝 รายละเอียดย่อ</label>
            <input type="text" class="fc" id="ni-vdoc-detail-${idx}" placeholder="บรรยายสั้น ๆ เกี่ยวกับเอกสาร..." style="font-size:13px">
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="addVendorDocItem(${idx})">+ เพิ่มเอกสาร</button>
      </div>
    </div>`;
  }

  if (key === 'myDocs') {
    return `<div style="margin-bottom:12px">
      ${lbl}
      <div id="${prefix}-${idx}"></div>
      <div class="mydoc-form">
        <div class="fg" style="margin-bottom:8px">
          <label class="fl" style="font-size:11px">ชื่อเอกสาร <span class="req">*</span></label>
          <input type="text" class="fc" id="ni-mdoc-name-${idx}" placeholder="${placeholder}" style="font-size:13px"
            onkeydown="if(event.key==='Enter')addMyDocItem(${idx})">
        </div>
        <div class="fr" style="margin-bottom:8px">
          <div class="fg" style="margin-bottom:0">
            <label class="fl" style="font-size:11px">📅 กำหนดวันที่ดำเนินการ</label>
            <input type="date" class="fc" id="ni-mdoc-date-${idx}" style="font-size:13px">
          </div>
          <div class="fg" style="margin-bottom:0">
            <label class="fl" style="font-size:11px">⚖️ ระเบียบ/กฎหมายที่เกี่ยวข้อง</label>
            <input type="text" class="fc" id="ni-mdoc-reg-${idx}" placeholder="เช่น ระเบียบฯ พ.ศ. 2560 ข้อ 5" style="font-size:13px">
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="addMyDocItem(${idx})">+ เพิ่มเอกสาร</button>
      </div>
    </div>`;
  }
}

function renderInstItems(instIdx, key, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const items = fInsts[instIdx]?.[key] || [];
  if (!items.length) { el.innerHTML = ''; return; }
  el.innerHTML = items.map((item, itemIdx) => {
    let meta = '';
    if (key === 'myDocs') {
      meta = `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">
        ${item.dueDate ? `<span class="tag-due">📅 ${fmtDate(item.dueDate)}</span>` : ''}
        ${item.regulation ? `<span class="tag-reg">⚖️ ${item.regulation}</span>` : ''}
      </div>`;
    } else if (key === 'vendorDocs') {
      meta = `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">
        ${item.date ? `<span class="tag-due">📅 ${fmtDate(item.date)}</span>` : ''}
        ${item.detail ? `<span style="font-size:12px;color:var(--text-2);background:var(--surface-2);padding:2px 8px;border-radius:99px;border:1px solid var(--border)">📝 ${item.detail}</span>` : ''}
      </div>`;
    }
    return `<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:7px;margin-bottom:4px">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500">${item.name}</div>
        ${meta}
      </div>
      <button onclick="removeInstItem(${instIdx},'${key}',${itemIdx},'${containerId}')" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:16px;padding:0 3px;flex-shrink:0">×</button>
    </div>`;
  }).join('');
}

function addInstItem(instIdx, key, inputId, containerId) {
  const inp = document.getElementById(inputId);
  const v = inp?.value.trim();
  if (!v) return;
  if (!fInsts[instIdx][key]) fInsts[instIdx][key] = [];
  fInsts[instIdx][key].push({ id: uid(), name: v, completed: false, completedDate: null, fileData: null, fileName: null });
  inp.value = '';
  renderInstItems(instIdx, key, containerId);
}

function addMyDocItem(instIdx) {
  const nameInp = document.getElementById(`ni-mdoc-name-${instIdx}`);
  const dateInp = document.getElementById(`ni-mdoc-date-${instIdx}`);
  const regInp  = document.getElementById(`ni-mdoc-reg-${instIdx}`);
  const name = nameInp?.value.trim();
  if (!name) { nameInp?.focus(); return; }
  if (!fInsts[instIdx].myDocs) fInsts[instIdx].myDocs = [];
  fInsts[instIdx].myDocs.push({
    id: uid(),
    name,
    dueDate: dateInp?.value || null,
    regulation: regInp?.value.trim() || null,
    completed: false,
    completedDate: null,
    fileData: null,
    fileName: null
  });
  nameInp.value = '';
  dateInp.value = '';
  regInp.value = '';
  renderInstItems(instIdx, 'myDocs', `inst-mdoc-${instIdx}`);
}

function removeInstItem(instIdx, key, itemIdx, containerId) {
  fInsts[instIdx][key].splice(itemIdx, 1);
  renderInstItems(instIdx, key, containerId);
}

function addVendorDocItem(instIdx) {
  const nameInp   = document.getElementById(`ni-vdoc-name-${instIdx}`);
  const dateInp   = document.getElementById(`ni-vdoc-date-${instIdx}`);
  const detailInp = document.getElementById(`ni-vdoc-detail-${instIdx}`);
  const name = nameInp?.value.trim();
  if (!name) { nameInp?.focus(); return; }
  if (!fInsts[instIdx].vendorDocs) fInsts[instIdx].vendorDocs = [];
  fInsts[instIdx].vendorDocs.push({
    id: uid(), name,
    date: dateInp?.value || null,
    detail: detailInp?.value.trim() || null,
    completed: false, completedDate: null, fileData: null, fileName: null
  });
  nameInp.value = ''; dateInp.value = ''; detailInp.value = '';
  renderInstItems(instIdx, 'vendorDocs', `inst-vdoc-${instIdx}`);
}

function setDelivReportFile(instIdx, input) {
  if (!input.files?.[0]) return;
  const file = input.files[0];
  if (file.size > 4 * 1024 * 1024) { alert('ไฟล์ขนาดใหญ่เกินไป (สูงสุด 4MB)'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    fInsts[instIdx].deliverableReportFile = e.target.result;
    fInsts[instIdx].deliverableReportFileName = file.name;
    const fnEl = document.getElementById('del-fname-' + instIdx);
    if (fnEl) fnEl.textContent = '📎 ' + file.name;
  };
  reader.readAsDataURL(file);
}

function saveContract() {
  for (let i = 0; i < fInsts.length; i++) {
    if (!fInsts[i].startDate || !fInsts[i].endDate) return alert(`กรุณาระบุวันที่ของงวดที่ ${i+1}`);
  }

  const existing = editId ? S.contracts.find(x => x.id === editId) : null;
  const data = {
    id: editId || uid(),
    projectName: document.getElementById('f-name').value.trim(),
    contractNumber: document.getElementById('f-cno').value.trim(),
    vendor: document.getElementById('f-vendor').value.trim(),
    contractValue: parseFloat(document.getElementById('f-val').value) || 0,
    startDate: document.getElementById('f-sdate').value,
    endDate: document.getElementById('f-edate').value,
    notes: document.getElementById('f-notes').value.trim(),
    scopeItems: [...fScope],
    installments: fInsts.map((inst, idx) => ({ ...inst, number: idx + 1 })),
    docTimeline: existing?.docTimeline || []
  };

  if (editId) {
    const idx = S.contracts.findIndex(x => x.id === editId);
    if (idx !== -1) S.contracts[idx] = data;
  } else {
    S.contracts.push(data);
  }

  save();
  closeModal('m-contract');
  renderSidebar();

  if (editId) {
    S.currentId = data.id;
    renderDetail();
  } else {
    goHome();
  }
}

// ═══════════════════ DOCUMENT TIMELINE ═══════════════════
const OWNER_STYLE = {
  'ร่วม':      { color:'#0f2044', bg:'#e8edf8', dot:'#0f2044',  label:'🤝 ร่วม' },
  'บริษัทฯ':  { color:'#1d4ed8', bg:'#dbeafe', dot:'#2357c5',  label:'🏢 บริษัทฯ' },
  'ผู้สั่งจ้าง':{ color:'#065f46', bg:'#d1fae5', dot:'#059669', label:'🏛️ ผู้สั่งจ้าง' }
};

const PDF_EVENTS = [
  { date:'2025-01-22', owner:'ร่วม',       event:'เริ่มสัญญา',                                                                                                                                                      regulation:'สัญญา' },
  { date:'2025-02-13', owner:'บริษัทฯ',   event:'ส่งเอกสารแจ้งจะส่งมอบงานงวดที่ 1/3',                                                                                                                             regulation:'' },
  { date:'2025-02-20', owner:'บริษัทฯ',   event:'ส่งมอบงานงวดที่ 1',                                                                                                                                               regulation:'' },
  { date:'2025-02-20', owner:'ร่วม',       event:'ครบกำหนดส่งมอบงานงวดที่ 1',                                                                                                                                      regulation:'สัญญา' },
  { date:'2025-05-08', owner:'ร่วม',       event:'ยืนยันการจัดทำ 40 แบบฟอร์ม',                                                                                                                                     regulation:'สัญญา' },
  { date:'2025-07-20', owner:'ร่วม',       event:'ครบกำหนดส่งมอบงานงวดที่ 2',                                                                                                                                      regulation:'สัญญา' },
  { date:'2025-07-21', owner:'บริษัทฯ',   event:'ขอเลื่อนกำหนดการส่งมอบงานงวดที่ 2 จาก 18 ก.ค. เป็น พร้อมกับงานงวดที่ 3 วันที่ 19 ส.ค. 68',                                                                    regulation:'' },
  { date:'2025-07-22', owner:'ร่วม',       event:'คณะกรรมการเร่งรัดและติดตามงาน และพิจารณาบริษัทฯ ขอเลื่อนส่งมอบงาน',                                                                                             regulation:'กค (กวจ) 0405.2/ว124 ลงวันที่ 1 มี.ค. 66' },
  { date:'2025-08-19', owner:'ร่วม',       event:'ครบกำหนดส่งมอบงานงวดที่ 3',                                                                                                                                      regulation:'สัญญา' },
  { date:'2025-08-19', owner:'บริษัทฯ',   event:'ส่งหนังสือขอขยายระยะเวลาโครงการ (แจ้งเลื่อนส่งมอบเป็น 12 พ.ย. 68 ขยายไป 85 วัน)',                                                                              regulation:'' },
  { date:'2025-08-20', owner:'ผู้สั่งจ้าง',event:'ส่งเมลหนังสือแจ้งสิทธิ์เรียกค่าปรับและเร่งรัดดำเนินการ',                                                                                                       regulation:'' },
  { date:'2025-09-05', owner:'บริษัทฯ',   event:'บริษัทฯ ขอนัด UAT แบบฟอร์มที่เหลือ (23/40)',                                                                                                                     regulation:'' },
  { date:'2025-09-09', owner:'ผู้สั่งจ้าง',event:'ส่งหนังสือขอให้บริษัทฯตอบกลับการดำเนินงานภายใน 12 ก.ย. 68 และตอบกลับไม่ขยายระยะเวลาโครงการ',                                                                  regulation:'' },
  { date:'2025-09-12', owner:'บริษัทฯ',   event:'บริษัทฯ ส่ง ขอยืนยันดำเนินการต่อภายหลังสิ้นสุดสัญญา และส่งแผนการดำเนินงาน 28 พ.ย. 68 (ขยายไป 100 วัน)',                                                       regulation:'กค (กวจ) 0405.2/ว83 ลงวันที่ 22 ก.พ. 62 · กค (กวจ) 0405.2/ว124 ลงวันที่ 1 มี.ค. 66' },
  { date:'2025-09-15', owner:'ร่วม',       event:'คณะกรรมการนัดประชุมการดำเนินการต่อภายหลังสิ้นสุดสัญญา ขออนุมัติจากผู้สั่งจ้าง และแจ้งผลการพิจารณาให้ดำเนินการต่อ',                                             regulation:'กค (กวจ) 0405.2/ว124 ลงวันที่ 1 มี.ค. 66' },
  { date:'2025-09-16', owner:'ผู้สั่งจ้าง',event:'คณะกรรมการขออนุมัติให้บริษัทดำเนินการต่อภายหลังสิ้นสุดระยะเวลาสัญญา',                                                                                          regulation:'บ.ฝกม.321/2560 ลว. 29 ก.ย. 60 · กค (กวจ) 0405.2/ว124 ลงวันที่ 1 มี.ค. 66' },
  { date:'2025-09-25', owner:'ร่วม',       event:'แจ้งบริษัทฯ ว่าผู้สั่งจ้างอนุมัติให้ดำเนินการต่อหลังสิ้นสุดสัญญา หลังได้รับอนุมัติ',                                                                           regulation:'กค (กวจ) 0405.2/ว83 ลงวันที่ 22 ก.พ. 62' },
  { date:'2025-11-18', owner:'ผู้สั่งจ้าง',event:'ส่งหนังสือแจ้งค่าปรับจะเกินกว่าร้อยละ 10 ของวงเงินค่าจ้างตามสัญญา และขอให้บริษัทฯ แจ้งความยินยอมเสียค่าปรับ พร้อมส่งแผนการดำเนินงานและกำหนดส่งมอบงานให้ชัดเจน',regulation:'' },
  { date:'2025-11-18', owner:'บริษัทฯ',   event:'บริษัทฯ แจ้งยินยอมเสียค่าปรับโดยไม่มีเงื่อนไขใดๆ ทั้งสิ้น และแก้ไขแผนเป็น 16 ม.ค. 69 (ขยายไป 150 วัน)',                                                       regulation:'' },
  { date:'2025-11-21', owner:'ร่วม',       event:'คณะกรรมการประชุมพิจารณาผลการดำเนินงานแผนงาน และกำหนดส่งมอบงาน และเสนอผู้สั่งจ้างเพื่ออนุมัติให้บริษัทฯดำเนินงานต่อตามแผน',                                    regulation:'กค (กวจ) 0405.2/ว83 ลงวันที่ 22 ก.พ. 62' },
  { date:'2025-12-11', owner:'ผู้สั่งจ้าง',event:'ทำบันทึกขออนุมัติให้ผู้รับจ้างดำเนินการต่อเมื่อมีค่าปรับเกินกว่าร้อยละ 10 ของวงเงินค่าจ้างตามสัญญา',                                                         regulation:'กค (กวจ) 0405.2/ว83 ลงวันที่ 22 ก.พ. 62' },
  { date:'2026-01-09', owner:'ร่วม',       event:'แจ้งบริษัทฯ ว่าผู้สั่งจ้างอนุมัติให้ดำเนินการต่อหลังค่าปรับถึงร้อยละ 10',                                                                                       regulation:'กค (กวจ) 0405.2/ว83 ลงวันที่ 22 ก.พ. 62' },
  { date:'2026-01-09', owner:'บริษัทฯ',   event:'บริษัทแจ้งจะส่งมอบงานงวดที่ 2-3',                                                                                                                                regulation:'' },
  { date:'2026-01-15', owner:'บริษัทฯ',   event:'บริษัทแจ้งส่งมอบงานงวดที่ 2-3',                                                                                                                                  regulation:'' },
  { date:'2026-01-19', owner:'ผู้สั่งจ้าง',event:'กฟน. ส่งหนังสือแจ้งสงวนสิทธิ์การเรียกค่าปรับตามสัญญา',                                                                                                         regulation:'ระเบียบกระทรวงการคลัง ข้อ 181' },
  { date:'2026-01-19', owner:'บริษัทฯ',   event:'บริษัทฯส่งหนังสือประกอบการพิจารณางดเว้นค่าปรับ',                                                                                                                  regulation:'' },
  { date:'2026-01-21', owner:'ร่วม',       event:'ประชุมบริษัทฯนำเสนอสิ่งส่งมอบ คณะกรรมการมีแก้ไขภาพประกอบให้แล้วเสร็จภายใน 30 ม.ค. 69',                                                                        regulation:'' },
  { date:'2026-01-29', owner:'ร่วม',       event:'ประชุมพิจารณาลดหย่อนค่าปรับ',                                                                                                                                    regulation:'พรบ.60 หมวด 10 ม.102 และระเบียบฯ ข้อ 182' },
  { date:'2026-02-05', owner:'ผู้สั่งจ้าง',event:'ทำบันทึกขออนุมัติลดหย่อนค่าปรับ',                                                                                                                              regulation:'พรบ.60 หมวด 10 ม.102' },
  { date:'2026-02-16', owner:'ผู้สั่งจ้าง',event:'แจ้งผลการอนุมัติลดหย่อน',                                                                                                                                       regulation:'พรบ.60 หมวด 10 ม.102' },
  { date:'2026-02-18', owner:'ผู้สั่งจ้าง',event:'รายงานการประชุมคณะกรรมการตรวจรับพัสดุ',                                                                                                                         regulation:'พรบ.60 หมวด 6 ข้อ 175' },
  { date:'2026-02-28', owner:'ผู้สั่งจ้าง',event:'คณะกรรมการรายงานผู้สั่งจ้าง เรื่องการตรวจรับพัสดุ',                                                                                                             regulation:'' },
  { date:'2026-04-03', owner:'บริษัทฯ',   event:'บริษัทฯ ส่งหนังสือทวงถามการตรวจรับ',                                                                                                                             regulation:'' },
  { date:'2026-04-17', owner:'ผู้สั่งจ้าง',event:'ทำหนังสือตอบกลับบริษัทฯ',                                                                                                                                       regulation:'' }
];

let docTimelineFilter = '';
let editDocEventId = null;

function renderDocTimeline() {
  const c = S.contracts.find(x => x.id === S.currentId);
  const el = document.getElementById('dwtl-list');
  if (!c) return;

  const allEvt = (c.docTimeline || []).slice().sort((a, b) => a.date > b.date ? 1 : a.date < b.date ? -1 : 0);
  const filtered = docTimelineFilter ? allEvt.filter(e => e.owner === docTimelineFilter) : allEvt;
  document.getElementById('dwtl-count').textContent = filtered.length + ' รายการ';

  if (!filtered.length) {
    el.innerHTML = '<div class="empty"><div class="empty-ic">📜</div><div class="empty-t">'
      + (docTimelineFilter ? 'ไม่มีเหตุการณ์ในหมวดนี้' : 'ยังไม่มีเหตุการณ์')
      + '</div><div class="empty-d">กด "+ เพิ่มเหตุการณ์" หรือ "นำเข้าจาก PDF" เพื่อเริ่มต้น</div></div>';
    return;
  }

  // ── Time range ──
  const dDates = filtered.map(e => e.date).filter(Boolean).map(d => new Date(d + 'T12:00:00'));
  let rStart = c.startDate ? new Date(Math.min(new Date(c.startDate + 'T12:00:00'), Math.min(...dDates)))
                           : new Date(Math.min(...dDates));
  let rEnd   = c.endDate   ? new Date(Math.max(new Date(c.endDate   + 'T12:00:00'), Math.max(...dDates)))
                           : new Date(Math.max(...dDates));
  rStart.setDate(1);
  rEnd = new Date(rEnd.getFullYear(), rEnd.getMonth() + 2, 0); // end of next month

  const totalDays = Math.max(1, (rEnd - rStart) / 86400000);
  const months = [];
  { let cur = new Date(rStart.getFullYear(), rStart.getMonth(), 1);
    while (cur <= rEnd) { months.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); } }
  const mw   = Math.max(52, Math.min(110, 560 / months.length));
  const barW = months.length * mw;

  const COL1 = 260, COL2 = 90;

  function dateX(d) {
    if (!d) return null;
    const x = Math.round(((new Date(d + 'T12:00:00') - rStart) / 86400000 / totalDays) * barW);
    return (x >= -8 && x <= barW + 8) ? x : null;
  }
  const gridBg = months.map(() => `<div style="width:${mw}px;border-left:1px solid #f1f5f9;height:100%"></div>`).join('');
  const todayX = dateX(new Date().toISOString().split('T')[0]);
  const todayLineHtml = todayX !== null
    ? `<div style="position:absolute;left:${todayX}px;top:0;bottom:0;width:2px;background:rgba(220,38,38,.4);z-index:4;pointer-events:none">
         <span style="position:absolute;top:3px;left:4px;font-size:9px;color:#dc2626;font-weight:700;white-space:nowrap;font-family:'IBM Plex Mono',monospace">วันนี้</span></div>`
    : '';

  // ── Group events by installment ──
  const insts  = c.installments || [];
  const groups = [];
  const usedIds = new Set();

  insts.forEach((inst, idx) => {
    const evs = filtered.filter(e => {
      if (!e.date || usedIds.has(e.id)) return false;
      return e.date >= (inst.startDate || '') && e.date <= (inst.endDate || '');
    });
    evs.forEach(e => usedIds.add(e.id));
    groups.push({ type: 'inst', inst, idx, events: evs });
  });

  const unassigned = filtered.filter(e => !usedIds.has(e.id));
  if (unassigned.length || !insts.length) {
    groups.push({ type: 'other', events: insts.length ? unassigned : filtered });
  }

  const barColors = {
    completed: 'linear-gradient(90deg,#059669,#10b981)',
    overdue:   'linear-gradient(90deg,#dc2626,#ef4444)',
    active:    'linear-gradient(90deg,#2357c5,#60a5fa)',
    pending:   'linear-gradient(90deg,#94a3b8,#cbd5e1)'
  };

  // ── Legend ──
  const legend = `<div style="display:flex;align-items:center;gap:14px;padding:10px 14px;background:var(--surface-2);border-bottom:1px solid var(--border);font-size:11px;color:var(--text-3);flex-wrap:wrap">
    <span style="font-weight:700;color:var(--text-2)">เจ้าของ:</span>
    ${Object.entries(OWNER_STYLE).map(([,v]) => `<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${v.dot};margin-right:4px;vertical-align:middle"></span>${v.label}</span>`).join('')}
    <span style="margin-left:auto;font-style:italic;color:var(--text-3)">▶ คลิกแถวงวดเพื่อขยาย / ย่อ</span>
  </div>`;

  // ── Build table ──
  let html = `<div style="overflow-x:auto;border-radius:var(--radius);border:1px solid var(--border)">
  <div style="min-width:${COL1+COL2+barW}px">
  ${legend}
  <table style="width:100%;border-collapse:collapse;table-layout:fixed">
  <colgroup>
    <col style="width:${COL1}px">
    <col style="width:${COL2}px">
    <col style="width:${barW}px">
  </colgroup>
  <thead>
    <tr style="background:var(--navy)">
      <th style="padding:10px 12px;font-size:11px;font-weight:700;color:rgba(255,255,255,.85);text-align:left">งวด / เหตุการณ์</th>
      <th style="padding:10px 12px;font-size:11px;font-weight:700;color:rgba(255,255,255,.85);text-align:center">เจ้าของ</th>
      <th style="padding:0">
        <div style="display:flex">
          ${months.map(m => `<div style="width:${mw}px;padding:10px 4px;text-align:center;font-size:10px;border-left:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.75)">${m.toLocaleDateString('th-TH',{month:'short',year:'2-digit'})}</div>`).join('')}
        </div>
      </th>
    </tr>
  </thead>
  <tbody>`;

  groups.forEach((grp, gi) => {
    const gid = 'dg-' + (grp.type === 'inst' ? grp.inst.id : 'other' + gi);
    const evCount = grp.events.length;

    // Overlay dots for the summary row
    const dots = grp.events.map(ev => {
      const x = dateX(ev.date); if (x === null) return '';
      const st = OWNER_STYLE[ev.owner] || OWNER_STYLE['ร่วม'];
      return `<div title="${ev.event}&#10;${ev.owner} · ${fmtDate(ev.date)}"
        style="position:absolute;left:${x-5}px;top:50%;transform:translateY(-50%);
               width:10px;height:10px;border-radius:50%;background:${st.dot};
               border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);z-index:6"></div>`;
    }).join('');

    if (grp.type === 'inst') {
      const inst = grp.inst;
      const ist  = instStatus(inst);
      let instBar = '';
      if (inst.startDate && inst.endDate) {
        const off   = Math.max(0, (new Date(inst.startDate+'T12:00:00') - rStart) / 86400000);
        const dur   = Math.max(1, (new Date(inst.endDate+'T12:00:00') - new Date(inst.startDate+'T12:00:00')) / 86400000);
        const left  = (off / totalDays) * barW;
        const width = Math.max(20, (dur / totalDays) * barW);
        instBar = `<div style="position:absolute;left:${left}px;width:${width}px;height:16px;top:50%;
          transform:translateY(-50%);border-radius:4px;background:${barColors[ist]};
          opacity:.4;pointer-events:none"></div>`;
      }
      html += `
      <tr style="cursor:pointer;background:var(--surface-2)" onclick="toggleDocGroup('${gid}')">
        <td style="padding:10px 12px;font-weight:700;font-size:13px;border-bottom:2px solid var(--border-strong)">
          <div style="display:flex;align-items:center;gap:7px">
            <span id="arr-${gid}" style="font-size:11px;color:var(--blue);transition:transform .2s;flex-shrink:0">▶</span>
            <div>
              งวดที่ ${inst.number || grp.idx+1}${inst.name ? ': '+inst.name : ''}
              <div style="font-size:11px;color:var(--text-3);font-weight:400;margin-top:2px">
                ${evCount} เหตุการณ์${inst.startDate ? ' · '+fmtDateShort(inst.startDate)+' – '+fmtDateShort(inst.endDate) : ''}
              </div>
            </div>
          </div>
        </td>
        <td style="text-align:center;font-size:13px;font-weight:800;color:${inst.percentage?'var(--blue)':'var(--text-3)'};border-bottom:2px solid var(--border-strong)">${inst.percentage ? inst.percentage+'%' : '—'}</td>
        <td style="padding:0;position:relative;height:46px;border-bottom:2px solid var(--border-strong)">
          <div style="position:absolute;inset:0;display:flex">${gridBg}</div>
          ${todayLineHtml}${instBar}${dots}
        </td>
      </tr>`;
    } else {
      html += `
      <tr style="cursor:pointer;background:#fffbeb" onclick="toggleDocGroup('${gid}')">
        <td style="padding:10px 12px;font-weight:700;font-size:13px;border-bottom:2px solid var(--border-strong)">
          <div style="display:flex;align-items:center;gap:7px">
            <span id="arr-${gid}" style="font-size:11px;color:var(--amber);transition:transform .2s;flex-shrink:0">▶</span>
            <div style="color:var(--amber)">
              📋 เหตุการณ์นอกช่วงงวด
              <div style="font-size:11px;color:var(--text-3);font-weight:400;margin-top:2px">${evCount} เหตุการณ์</div>
            </div>
          </div>
        </td>
        <td style="border-bottom:2px solid var(--border-strong)"></td>
        <td style="padding:0;position:relative;height:46px;border-bottom:2px solid var(--border-strong)">
          <div style="position:absolute;inset:0;display:flex">${gridBg}</div>
          ${todayLineHtml}${dots}
        </td>
      </tr>`;
    }

    html += `<tr id="${gid}" style="display:none">
      <td colspan="3" style="padding:0;background:var(--bg)">
        ${buildDocEventRows(grp.events, barW, totalDays, rStart, COL1, COL2, gridBg, todayLineHtml)}
      </td>
    </tr>`;
  });

  html += `</tbody></table></div></div>`;
  el.innerHTML = html;
}

function buildDocEventRows(events, barW, totalDays, rStart, col1W, col2W, gridBg, todayLineHtml) {
  if (!events.length) return '<div style="padding:12px 20px;font-size:13px;color:var(--text-3)">ไม่มีเหตุการณ์ในช่วงนี้</div>';
  var out = '';
  events.forEach(function(ev, i) {
    var st = OWNER_STYLE[ev.owner] || OWNER_STYLE['ร่วม'];
    var x = null;
    if (ev.date) {
      var px = Math.round(((new Date(ev.date + 'T12:00:00') - rStart) / 86400000 / totalDays) * barW);
      if (px >= -8 && px <= barW + 8) x = px;
    }
    var dot = x !== null
      ? '<div style="position:absolute;left:' + x + 'px;top:50%;'
          + 'transform:translate(-50%,-50%);width:13px;height:13px;border-radius:50%;'
          + 'background:' + st.dot + ';border:2.5px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.28);z-index:5"></div>'
        + (x + 12 < barW
          ? '<div style="position:absolute;left:' + (x + 9) + 'px;top:50%;transform:translateY(-50%);'
              + 'font-size:9px;color:var(--text-3);white-space:nowrap;font-family:\'IBM Plex Mono\',monospace">'
              + fmtDateShort(ev.date) + '</div>'
          : '')
      : '';

    out += '<div style="display:flex;align-items:stretch;border-top:1px solid var(--border)">'
      + '<div style="width:' + col1W + 'px;min-width:' + col1W + 'px;padding:10px 12px 10px 28px;background:var(--surface)">'
      +   '<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:3px">'
      +     '<span style="font-size:11px;font-weight:700;color:var(--text-3);flex-shrink:0;font-family:\'IBM Plex Mono\',monospace">#' + (i+1) + '</span>'
      +     '<span style="font-size:13px;font-weight:500;color:var(--text);line-height:1.4">' + (ev.event || '') + '</span>'
      +   '</div>'
      +   (ev.date ? '<div style="font-size:11px;color:var(--text-3);font-family:\'IBM Plex Mono\',monospace;margin-bottom:3px">📅 ' + fmtDate(ev.date) + '</div>' : '')
      +   (ev.regulation ? '<div style="font-size:11px;color:#7c3aed;margin-bottom:5px">⚖️ ' + ev.regulation + '</div>' : '')
      +   '<div style="display:flex;gap:5px;margin-top:5px">'
      +     '<button type="button" style="font-size:10px;padding:2px 9px;border:1px solid var(--border);border-radius:5px;background:var(--surface);cursor:pointer;color:var(--text-2)" onclick="openDocEventModal(\'' + ev.id + '\')">✏️ แก้ไข</button>'
      +     '<button type="button" style="font-size:10px;padding:2px 9px;border:1px solid #fca5a5;border-radius:5px;background:#fff5f5;cursor:pointer;color:#dc2626" onclick="deleteDocEvent(\'' + ev.id + '\')">🗑️ ลบ</button>'
      +   '</div>'
      + '</div>'
      + '<div style="width:' + col2W + 'px;min-width:' + col2W + 'px;padding:10px 6px;background:var(--surface);display:flex;align-items:flex-start;justify-content:center">'
      +   '<span style="font-size:10px;font-weight:700;padding:3px 7px;border-radius:99px;background:' + st.bg + ';color:' + st.color + ';text-align:center;line-height:1.5">' + st.label + '</span>'
      + '</div>'
      + '<div style="flex:1;position:relative;min-height:80px;background:var(--surface)">'
      +   '<div style="position:absolute;inset:0;display:flex">' + gridBg + '</div>'
      +   todayLineHtml
      +   dot
      + '</div>'
      + '</div>';
  });
  return out;
}

function toggleDocGroup(gid) {
  var row = document.getElementById(gid);
  var arr = document.getElementById('arr-' + gid);
  if (!row) return;
  var opening = row.style.display === 'none';
  row.style.display = opening ? 'table-row' : 'none';
  if (arr) arr.style.transform = opening ? 'rotate(90deg)' : '';
}

function filterDocTimeline(btn, owner) {
  docTimelineFilter = owner;
  document.querySelectorAll('.dwtl-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderDocTimeline();
}

function openDocEventModal(eventId) {
  const c = S.contracts.find(x => x.id === S.currentId);
  if (!c) return;
  editDocEventId = eventId;
  document.getElementById('m-docevent-title').textContent = eventId ? 'แก้ไขเหตุการณ์' : 'เพิ่มเหตุการณ์';
  if (eventId) {
    const ev = (c.docTimeline || []).find(e => e.id === eventId);
    if (!ev) return;
    document.getElementById('de-date').value  = ev.date;
    document.getElementById('de-owner').value = ev.owner;
    document.getElementById('de-event').value = ev.event;
    document.getElementById('de-reg').value   = ev.regulation || '';
  } else {
    document.getElementById('de-date').value  = '';
    document.getElementById('de-owner').value = 'ร่วม';
    document.getElementById('de-event').value = '';
    document.getElementById('de-reg').value   = '';
  }
  document.getElementById('m-docevent').classList.add('open');
}

function saveDocEvent() {
  const date  = document.getElementById('de-date').value;
  const owner = document.getElementById('de-owner').value.trim();
  const event = document.getElementById('de-event').value.trim();
  const reg   = document.getElementById('de-reg').value.trim();
  if (!date)  return alert('กรุณาระบุวันที่');
  if (!event) return alert('กรุณาระบุเหตุการณ์');

  const c = S.contracts.find(x => x.id === S.currentId);
  if (!c) return;
  if (!c.docTimeline) c.docTimeline = [];

  if (editDocEventId) {
    const idx = c.docTimeline.findIndex(e => e.id === editDocEventId);
    if (idx !== -1) c.docTimeline[idx] = { ...c.docTimeline[idx], date, owner, event, regulation: reg };
  } else {
    c.docTimeline.push({ id: uid(), date, owner, event, regulation: reg });
  }

  save();
  closeModal('m-docevent');
  renderDocTimeline();
}

function deleteDocEvent(eventId) {
  if (!confirm('ลบเหตุการณ์นี้?')) return;
  const c = S.contracts.find(x => x.id === S.currentId);
  if (!c) return;
  c.docTimeline = (c.docTimeline || []).filter(e => e.id !== eventId);
  save();
  renderDocTimeline();
}

function openSourceImport() {
  document.getElementById('m-source-import').classList.add('open');
  renderSourceList();
}

function getBuiltinSource() {
  return { id: 'builtin', name: 'DWTimeline.pdf (ตัวอย่าง)', builtin: true, events: PDF_EVENTS, regulations: PDF_REGULATIONS };
}

function renderSourceList() {
  const allSrc = [getBuiltinSource(), ...(S.sources || [])];
  const hasContract = !!S.currentId;
  const el = document.getElementById('src-list');
  if (!el) return;

  el.innerHTML = allSrc.map(src => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
                border:1.5px solid var(--border);border-radius:8px;margin-bottom:8px;
                background:var(--surface)">
      <input type="checkbox" id="src-cb-${src.id}" value="${src.id}" checked
             style="width:16px;height:16px;cursor:pointer;flex-shrink:0">
      <label for="src-cb-${src.id}" style="flex:1;cursor:pointer;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${src.name}</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:2px">
          📅 ${src.events.length} เหตุการณ์ &nbsp;·&nbsp; 📚 ${src.regulations.length} ระเบียบ
        </div>
      </label>
      ${src.builtin
        ? '<span style="font-size:10px;color:var(--text-3);white-space:nowrap">ค่าเริ่มต้น</span>'
        : `<button type="button" onclick="removeUserSource('${src.id}')"
             style="font-size:13px;border:none;background:none;color:var(--text-3);cursor:pointer;padding:2px 4px"
             title="ลบแหล่งข้อมูลนี้">✕</button>`}
    </div>`).join('');

  const evNote = document.getElementById('imp-events-note');
  if (evNote) {
    evNote.textContent = hasContract ? '→ สัญญาปัจจุบัน' : '⚠ ต้องเปิดสัญญาก่อน';
    evNote.style.color = hasContract ? 'var(--text-3)' : 'var(--amber)';
  }
}

function removeUserSource(id) {
  if (!confirm('ลบแหล่งข้อมูลนี้ออกจากรายการ?')) return;
  S.sources = (S.sources || []).filter(s => s.id !== id);
  saveSources();
  renderSourceList();
}

function handleSourceFiles(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  let done = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.name && !data.events && !data.regulations)
          return alert('ไฟล์ ' + file.name + ' รูปแบบไม่ถูกต้อง กรุณาใช้แม่แบบที่ดาวน์โหลด');
        S.sources = S.sources || [];
        S.sources.push({
          id: uid(),
          name: data.name || file.name.replace(/\.json$/i, ''),
          events: Array.isArray(data.events) ? data.events : [],
          regulations: Array.isArray(data.regulations) ? data.regulations : []
        });
      } catch (err) {
        alert('อ่านไฟล์ ' + file.name + ' ไม่ได้: ' + err.message);
      }
      if (++done === files.length) { saveSources(); renderSourceList(); }
    };
    reader.readAsText(file, 'UTF-8');
  });
  input.value = '';
}

function importFromSources() {
  const allSrc   = [getBuiltinSource(), ...(S.sources || [])];
  const selected = allSrc.filter(src => document.getElementById('src-cb-' + src.id)?.checked);
  if (!selected.length) return alert('กรุณาเลือกอย่างน้อย 1 แหล่งข้อมูล');

  const doEvents = document.getElementById('imp-events')?.checked;
  const doRegs   = document.getElementById('imp-regs')?.checked;
  if (!doEvents && !doRegs) return alert('กรุณาเลือกประเภทข้อมูลที่ต้องการนำเข้า');

  if (doEvents) {
    const c = S.contracts.find(x => x.id === S.currentId);
    if (!c) {
      alert('กรุณาเปิดสัญญาก่อนนำเข้าเหตุการณ์');
    } else {
      if (!c.docTimeline) c.docTimeline = [];
      selected.forEach(src =>
        src.events.forEach(ev =>
          c.docTimeline.push({ id: uid(), date: ev.date || '', owner: ev.owner || 'ร่วม', event: ev.event || '', regulation: ev.regulation || '' })
        )
      );
      save();
    }
  }

  if (doRegs) {
    selected.forEach(src =>
      src.regulations.forEach(r =>
        S.regulations.push({ id: uid(), code: r.code || '', title: r.title || '', category: r.category || 'อื่นๆ', url: r.url || '', notes: r.notes || '' })
      )
    );
    saveRegs();
  }

  closeModal('m-source-import');
  if (doEvents && S.currentId) renderDocTimeline();
  if (doRegs && document.getElementById('v-regulations')?.classList.contains('active')) renderRegulationsPage();
}

function downloadSourceTemplate() {
  const template = {
    name: 'ชื่อเอกสาร PDF ของคุณ',
    events: [
      { date: '2025-01-22', owner: 'ร่วม',       event: 'คำอธิบายเหตุการณ์', regulation: 'ข้อกฎหมายที่อ้างถึง (ถ้ามี)' },
      { date: '2025-02-13', owner: 'บริษัทฯ',   event: 'ตัวอย่างเหตุการณ์ที่ 2', regulation: '' },
      { date: '2025-03-01', owner: 'ผู้สั่งจ้าง', event: 'ตัวอย่างเหตุการณ์ที่ 3', regulation: 'พรบ.60 หมวด 10 ม.102' }
    ],
    regulations: [
      { code: 'พรบ.60 หมวด 10 ม.102', title: 'คำอธิบายกฎหมาย', category: 'พรบ.', url: 'https://...' },
      { code: 'ระเบียบ ข้อ 181',       title: 'คำอธิบายระเบียบ', category: 'ระเบียบ', url: '' }
    ]
  };
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'source-template.json'; a.click(); URL.revokeObjectURL(a.href);
}

// ═══════════════════ REGULATIONS PAGE ═══════════════════
const CAT_STYLE = {
  'สัญญา':        { bg:'#e8edf8', color:'#0f2044', label:'📄 สัญญา' },
  'หนังสือเวียน': { bg:'#dbeafe', color:'#1d4ed8', label:'✉️ หนังสือเวียน' },
  'พรบ.':          { bg:'#f5f3ff', color:'#5b21b6', label:'📕 พรบ.' },
  'ระเบียบ':       { bg:'#d1fae5', color:'#065f46', label:'📋 ระเบียบ' },
  'อื่นๆ':         { bg:'#f1f5f9', color:'#475569', label:'📎 อื่นๆ' }
};

const PDF_REGULATIONS = [
  { code:'สัญญา',                                     title:'สัญญาจ้างโครงการ',                                                                        category:'สัญญา',        url:'' },
  { code:'กค (กวจ) 0405.2/ว124 ลงวันที่ 1 มี.ค. 66',  title:'หนังสือเวียนกรมบัญชีกลาง ว.124/2566 แนวทางการดำเนินการเมื่อผู้รับจ้างขอขยายเวลา',          category:'หนังสือเวียน', url:'' },
  { code:'กค (กวจ) 0405.2/ว83 ลงวันที่ 22 ก.พ. 62',   title:'หนังสือเวียนกรมบัญชีกลาง ว.83/2562 การดำเนินการกรณีค่าปรับเกินร้อยละ 10 ของวงเงินค่าจ้าง', category:'หนังสือเวียน', url:'' },
  { code:'บ.ฝกม.321/2560 ลว. 29 ก.ย. 60',              title:'ระเบียบภายในองค์กร',                                                                       category:'อื่นๆ',         url:'' },
  { code:'ระเบียบกระทรวงการคลัง ข้อ 181',               title:'ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างฯ พ.ศ. 2560 ข้อ 181 (การสงวนสิทธิ์ค่าปรับ)',  category:'ระเบียบ',       url:'' },
  { code:'พรบ.60 หมวด 10 ม.102',                        title:'พรบ.การจัดซื้อจัดจ้างฯ พ.ศ. 2560 หมวด 10 มาตรา 102 (การลดหย่อนหรืองดค่าปรับ)',             category:'พรบ.',          url:'' },
  { code:'ระเบียบฯ ข้อ 182',                            title:'ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างฯ พ.ศ. 2560 ข้อ 182 (การลดหย่อนค่าปรับ)',    category:'ระเบียบ',       url:'' },
  { code:'พรบ.60 หมวด 6 ข้อ 175',                      title:'พรบ.การจัดซื้อจัดจ้างฯ พ.ศ. 2560 หมวด 6 ข้อ 175 (การตรวจรับพัสดุ)',                       category:'พรบ.',          url:'' }
];

let selectedRegId = null;

function openRegulations() {
  document.getElementById('nav-home').classList.remove('active');
  document.getElementById('nav-regs').classList.add('active');
  S.currentId = null;
  showView('v-regulations');
  renderRegulationsPage();
}

function renderRegulationsPage() {
  const q = (document.getElementById('reg-q')?.value || '').toLowerCase();
  const regs = S.regulations.filter(r =>
    !q || r.code.toLowerCase().includes(q) || (r.title||'').toLowerCase().includes(q)
  );

  document.getElementById('reg-page-body').innerHTML = `
    <div class="reg-layout">
      <div>
        <div class="card">
          <div class="card-hd" style="padding-bottom:10px">
            <div class="card-title">รายการ (${S.regulations.length})</div>
          </div>
          <div class="card-body" style="padding-top:8px">
            <div class="sb-search" style="margin-bottom:12px">
              <span style="color:var(--text-3);font-size:13px">🔍</span>
              <input type="text" id="reg-q" placeholder="ค้นหา..." oninput="renderRegulationsPage()" value="${q.replace(/"/g,'&quot;')}">
            </div>
            <div id="reg-list">
              ${regs.length
                ? regs.map(r => buildRegCard(r)).join('')
                : '<div style="padding:20px;text-align:center;color:var(--text-3);font-size:13px">ไม่พบรายการ</div>'}
            </div>
          </div>
        </div>
      </div>
      <div id="reg-detail">
        ${selectedRegId ? buildRegDetail(S.regulations.find(r => r.id === selectedRegId)) : buildRegEmptyState()}
      </div>
    </div>`;
}

function buildRegCard(r) {
  const cat  = CAT_STYLE[r.category] || CAT_STYLE['อื่นๆ'];
  const refs = countRegRefs(r.code);
  return `<div class="reg-card${r.id === selectedRegId ? ' selected' : ''}" onclick="selectRegulation('${r.id}')">
    <span class="reg-cat-badge" style="background:${cat.bg};color:${cat.color}">${cat.label}</span>
    <div style="font-size:13px;font-weight:600;color:var(--text);line-height:1.35;margin-bottom:3px">${r.code}</div>
    ${r.title ? `<div style="font-size:11px;color:var(--text-3);line-height:1.4;margin-bottom:4px">${r.title}</div>` : ''}
    <div style="display:flex;gap:10px;font-size:11px">
      ${refs > 0 ? `<span style="color:var(--blue)">📎 อ้างถึง ${refs} ครั้ง</span>` : ''}
      ${r.url ? '<span style="color:var(--green)">🔗 มี URL</span>' : ''}
    </div>
  </div>`;
}

function buildRegEmptyState() {
  return `<div class="card" style="min-height:300px;display:flex;align-items:center;justify-content:center">
    <div class="empty">
      <div class="empty-ic">📚</div>
      <div class="empty-t">เลือกกฎหมายจากรายการ</div>
      <div class="empty-d">คลิกรายการทางซ้ายเพื่อดูรายละเอียด URL และเหตุการณ์ที่อ้างถึง</div>
    </div>
  </div>`;
}

function buildRegDetail(r) {
  if (!r) return buildRegEmptyState();
  const cat  = CAT_STYLE[r.category] || CAT_STYLE['อื่นๆ'];
  const refs = findRegRefs(r.code);
  return `<div class="reg-detail-card">
    <div class="card-hd">
      <div>
        <span class="reg-cat-badge" style="background:${cat.bg};color:${cat.color}">${cat.label}</span>
        <div class="card-title" style="margin-top:4px;font-size:15px;line-height:1.4">${r.code}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-ghost btn-sm" onclick="openRegModal('${r.id}')">✏️ แก้ไข</button>
        <button class="btn btn-danger btn-sm" onclick="deleteRegulation('${r.id}')">🗑️</button>
      </div>
    </div>
    <div class="card-body">
      ${r.title ? `<div style="margin-bottom:14px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-3);margin-bottom:4px">คำอธิบาย</div><div style="font-size:14px;color:var(--text);line-height:1.6">${r.title}</div></div>` : ''}
      ${r.notes ? `<div style="margin-bottom:14px;padding:12px 16px;background:var(--surface-2);border-radius:8px;border-left:3px solid var(--blue);font-size:13px;color:var(--text-2);line-height:1.7">${r.notes.replace(/\n/g,'<br>')}</div>` : ''}
      <div style="margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-3);margin-bottom:8px">🔗 ลิงก์เอกสาร</div>
        ${r.url
          ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
               <div style="flex:1;min-width:0;font-size:12px;color:var(--blue);word-break:break-all;padding:8px 12px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe">${r.url}</div>
               <button class="btn btn-primary btn-sm" onclick="openRegUrl('${r.id}')">🌐 เปิดในแท็บใหม่</button>
             </div>
             <div style="margin-top:10px">
               <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                 <span style="font-size:12px;color:var(--text-3)">แสดงหน้าเว็บในแอป</span>
                 <button type="button" class="btn btn-ghost btn-sm" id="iframe-toggle-btn" onclick="toggleRegIframe()">▼ แสดง</button>
               </div>
               <div id="reg-iframe-wrap" style="display:none" class="reg-iframe-wrap">
                 <iframe src="${r.url}" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" title="regulation viewer"></iframe>
               </div>
             </div>`
          : `<div style="display:flex;align-items:center;gap:10px">
               <span style="font-size:13px;color:var(--text-3);font-style:italic">ยังไม่มี URL</span>
               <button class="btn btn-ghost btn-sm" onclick="openRegModal('${r.id}')">+ เพิ่ม URL</button>
             </div>`}
      </div>
      ${refs.length > 0 ? `
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-3);margin-bottom:8px">📎 เหตุการณ์ที่อ้างถึง (${refs.length})</div>
        ${refs.map(ref => `<div class="reg-ref-item">
          <div style="font-weight:600;color:var(--text);margin-bottom:2px">${ref.event}</div>
          <div style="color:var(--text-3)">📅 ${fmtDate(ref.date)} · ${ref.owner}</div>
          <div style="color:var(--blue);font-size:11px;margin-top:1px">📁 ${ref.contractName}</div>
        </div>`).join('')}
      </div>` : `<div style="font-size:13px;color:var(--text-3);font-style:italic;padding-top:4px">ยังไม่มีเหตุการณ์อ้างถึงกฎหมายนี้</div>`}
    </div>
  </div>`;
}

function selectRegulation(id) {
  selectedRegId = id;
  document.querySelectorAll('.reg-card').forEach(el => el.classList.remove('selected'));
  const card = [...document.querySelectorAll('.reg-card')].find(el => el.getAttribute('onclick')?.includes(`'${id}'`));
  if (card) card.classList.add('selected');
  const detail = document.getElementById('reg-detail');
  if (detail) detail.innerHTML = buildRegDetail(S.regulations.find(r => r.id === id));
}

function countRegRefs(code) {
  let n = 0;
  S.contracts.forEach(c => {
    (c.docTimeline || []).forEach(e => { if ((e.regulation||'').includes(code)) n++; });
    (c.installments || []).forEach(inst => {
      (inst.myDocs||[]).forEach(d => { if ((d.regulation||'').includes(code)) n++; });
    });
  });
  return n;
}

function findRegRefs(code) {
  const refs = [];
  S.contracts.forEach(c => {
    (c.docTimeline || []).forEach(e => {
      if ((e.regulation||'').includes(code))
        refs.push({ event: e.event, date: e.date, owner: e.owner, contractName: c.projectName });
    });
    (c.installments || []).forEach(inst => {
      (inst.myDocs||[]).forEach(d => {
        if ((d.regulation||'').includes(code))
          refs.push({ event: d.name, date: d.dueDate, owner: 'เอกสารดำเนินการ', contractName: c.projectName });
      });
    });
  });
  return refs;
}

function openRegModal(id) {
  const r = id ? S.regulations.find(x => x.id === id) : null;
  document.getElementById('m-reg-title').textContent = r ? 'แก้ไขกฎหมาย' : 'เพิ่มกฎหมาย';
  document.getElementById('rm-id').value    = r?.id       || '';
  document.getElementById('rm-code').value  = r?.code     || '';
  document.getElementById('rm-title').value = r?.title    || '';
  document.getElementById('rm-cat').value   = r?.category || 'พรบ.';
  document.getElementById('rm-url').value   = r?.url      || '';
  document.getElementById('rm-notes').value = r?.notes    || '';
  document.getElementById('m-regulation').classList.add('open');
}

function saveRegulation() {
  const id    = document.getElementById('rm-id').value;
  const code  = document.getElementById('rm-code').value.trim();
  const title = document.getElementById('rm-title').value.trim();
  const cat   = document.getElementById('rm-cat').value;
  const url   = document.getElementById('rm-url').value.trim();
  const notes = document.getElementById('rm-notes').value.trim();
  if (!code) return alert('กรุณาระบุรหัส/ชื่อกฎหมาย');

  if (id) {
    const idx = S.regulations.findIndex(r => r.id === id);
    if (idx !== -1) S.regulations[idx] = { id, code, title, category: cat, url, notes };
  } else {
    const newReg = { id: uid(), code, title, category: cat, url, notes };
    S.regulations.push(newReg);
    selectedRegId = newReg.id;
  }
  saveRegs();
  closeModal('m-regulation');
  renderRegulationsPage();
}

function deleteRegulation(id) {
  if (!confirm('ลบกฎหมายนี้?')) return;
  S.regulations = S.regulations.filter(r => r.id !== id);
  if (selectedRegId === id) selectedRegId = null;
  saveRegs();
  renderRegulationsPage();
}

function importPdfRegs() { openSourceImport(); }

function openRegUrl(id) {
  const r = S.regulations.find(x => x.id === id);
  if (r?.url) window.open(r.url, '_blank', 'noopener');
}

function toggleRegIframe() {
  const wrap = document.getElementById('reg-iframe-wrap');
  const btn  = document.getElementById('iframe-toggle-btn');
  if (!wrap) return;
  const showing = wrap.style.display !== 'none';
  wrap.style.display = showing ? 'none' : 'block';
  if (btn) btn.textContent = showing ? '▼ แสดง' : '▲ ซ่อน';
}

// ═══════════════════ INIT ═══════════════════
function init() {
  load();
  loadRegs();
  loadSources();
  document.getElementById('hdr-date').textContent = new Date().toLocaleDateString('th-TH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  renderDashboard();
  renderSidebar();

  // Close modals on backdrop click
  document.querySelectorAll('.modal-bg').forEach(bg => {
    bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); });
  });
}

init();
