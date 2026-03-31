/* ===================================================
   Fund Selection Tool — main.js
   =================================================== */

// ===== SIDEBAR & PAGE NAVIGATION =====
const PAGE_TITLES = {
  'fund-select':    'เลือกกองทุน',
  'thai-return':    'กองทุนไทย Annualized',
  'thai-cal':       'กองทุนไทย Calendar Year',
  'master-cal':     'กอง Master Fund Calendar Year',
  'master-ann':     'กอง Master Fund Annualized Return',
  'fees':           'ค่าธรรมเนียมเหมาะสม',
  'other-factors':  'ปัจจัยประกอบอื่นๆ',
  'top10':          'Top 10 Holding',
  'ftdata':         'ข้อมูลจาก FT.com',
  'robustness':     'Robustness Research',
};

function switchPage(el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');

  const pageId = el.dataset.page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${pageId}`).classList.add('active');

  document.getElementById('page-title').textContent = PAGE_TITLES[pageId] || 'เลือกกองทุน';

  if (pageId === 'thai-return')  populateThaiReturnTable();
  if (pageId === 'thai-cal')     populateThaiCalTable();
  if (pageId === 'master-ann')   populateMasterAnnTable();
  if (pageId === 'master-cal')   populateMasterCalTable();
  if (pageId === 'fees')          populateFeesTable();
  if (pageId === 'other-factors') { buildRiskChart(); buildBarPanel(); }
  if (pageId === 'top10')         { initGasSettings(); populateTop10Page(); }
  if (pageId === 'ftdata')        { initGasSettingsFt(); populateFTDataPage(); }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// ===== STATE =====
let allFunds   = [];
let filtered   = [];
let currentPage = 1;
let rowsPerPage = 25;
let checkedFunds = new Set(); // เก็บ fund codes ที่ถูก check
let highlightMap = {};        // {code: 'yellow'|'orange'|'green'|'blue'|'pink'|''}

// Highlight colors config
const HIGHLIGHT_COLORS = [
  { value: '',       label: '—',    bg: '' },
  { value: 'yellow', label: '🟡 เหลือง', bg: '#fef08a' },
  { value: 'orange', label: '🟠 ส้ม',    bg: '#fed7aa' },
  { value: 'green',  label: '🟢 เขียว',  bg: '#bbf7d0' },
  { value: 'blue',   label: '🔵 ฟ้า',   bg: '#bae6fd' },
  { value: 'pink',   label: '🩷 ชมพู',  bg: '#fecdd3' },
];

// ===== INIT =====
function initApp() {
  allFunds = Array.isArray(FUND_DATA) ? FUND_DATA : (FUND_DATA.funds || []);
  filtered = allFunds;

  updatePeriodBadge();
  normalizeAllFunds();
  buildDropdownOptions();
  applyFilters();

  document.getElementById('search-input').addEventListener('input', applyFilters);
  document.getElementById('avpcat-filter').addEventListener('change', applyFilters);
  document.getElementById('type-filter').addEventListener('change', applyFilters);
  document.getElementById('style-filter').addEventListener('change', applyFilters);
  document.getElementById('dividend-filter').addEventListener('change', applyFilters);
}

function updatePeriodBadge() {
  const period = (typeof DATA_PERIOD !== 'undefined' ? DATA_PERIOD : null) ||
                 (FUND_DATA && FUND_DATA.meta && FUND_DATA.meta.period) || '—';
  document.getElementById('period-badge').textContent = period;
}

// ===== NORMALIZE FIELD VALUES (แก้ typo จากไฟล์ต้นทาง) =====
const TYPE_NORM = { 'general':'General', 'ssf':'SSF', 'ssf':'SSF', 'ssfx':'SSFX', 'tesg':'TESG', 'tesgx':'TESGX', 'rmf':'RMF', 'ltf':'LTF', 'pvd':'PVD' };
const STYLE_NORM = { 'active':'Active', 'passive':'Passive' };
const DIV_NORM   = { 'dividend':'Dividend', 'no dividend':'No Dividend', 'redemption':'Redemption' };

function norm(val, map) {
  if (!val) return val;
  return map[val.toLowerCase()] || val;
}

function normalizeAllFunds() {
  allFunds.forEach(f => {
    f.type     = norm(f.type,     TYPE_NORM);
    f.style    = norm(f.style,    STYLE_NORM);
    f.dividend = norm(f.dividend, DIV_NORM);
  });
}

// ===== BUILD DROPDOWNS FROM DATA =====
function buildDropdownOptions() {
  const avpCats   = new Set();
  const types     = new Set();
  const styles    = new Set();
  const dividends = new Set();

  allFunds.forEach(f => {
    if (f.avp_cat)  avpCats.add(f.avp_cat);
    if (f.type)     types.add(f.type);
    if (f.style)    styles.add(f.style);
    if (f.dividend) dividends.add(f.dividend);
  });

  populateSelect('avpcat-filter',   [...avpCats].sort());
  populateSelect('type-filter',     [...types].sort());
  populateSelect('style-filter',    [...styles].sort());
  populateSelect('dividend-filter', [...dividends].sort());
}

function populateSelect(id, values) {
  const sel = document.getElementById(id);
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

// ===== FILTER =====
function applyFilters() {
  const search  = document.getElementById('search-input').value.toLowerCase();
  const avpCat  = document.getElementById('avpcat-filter').value;
  const typeVal = document.getElementById('type-filter').value;
  const style   = document.getElementById('style-filter').value;
  const div     = document.getElementById('dividend-filter').value;

  filtered = allFunds.filter(f => {
    const matchSearch   = !search  || f.code.toLowerCase().includes(search) || f.name.toLowerCase().includes(search);
    const matchAvpCat   = !avpCat  || f.avp_cat  === avpCat;
    const matchType     = !typeVal || f.type      === typeVal;
    const matchStyle    = !style   || f.style     === style;
    const matchDividend = !div     || f.dividend  === div;
    return matchSearch && matchAvpCat && matchType && matchStyle && matchDividend;
  });

  currentPage = 1;
  updateFundCount();
  renderTable();
  updatePagination();
}

function updateFundCount() {
  document.getElementById('fund-count').textContent =
    `${filtered.length} / ${allFunds.length} กองทุน`;
}

function resetFilters() {
  // รีเซ็ต filter dropdowns
  document.getElementById('search-input').value    = '';
  document.getElementById('avpcat-filter').value   = '';
  document.getElementById('type-filter').value     = '';
  document.getElementById('style-filter').value    = '';
  document.getElementById('dividend-filter').value = '';
  // รีเซ็ต checkboxes และ highlight ทั้งหมด
  checkedFunds.clear();
  highlightMap = {};
  // รีเซ็ต select-all checkbox
  const allCb = document.getElementById('select-all-cb');
  if (allCb) allCb.checked = false;
  applyFilters();
  updateCheckedBadge();
}

function toggleSelectAll(checked) {
  // เลือก/ยกเลิกเฉพาะกองที่โชว์อยู่ในหน้าปัจจุบัน (filtered ทั้งหมด)
  if (checked) {
    filtered.forEach(f => checkedFunds.add(f.code));
  } else {
    filtered.forEach(f => checkedFunds.delete(f.code));
  }
  updateCheckedBadge();
  renderTable();   // re-render เพื่ออัปเดต checkbox state ใน rows
}

// ===== FUND ROW BUILDER (ใช้ร่วมกันทั้ง 2 หน้า) =====
const FUND_TABLE_HEADERS = `<tr>
  <th class="col-check">
    <input type="checkbox" id="select-all-cb" title="เลือก/ยกเลิกทั้งหมด"
      onchange="toggleSelectAll(this.checked)"
      style="cursor:pointer;width:15px;height:15px;">
  </th>
  <th class="col-code">Fund Code</th>
  <th class="col-highlight">Highlight</th>
  <th class="col-type">Type</th>
  <th class="col-div">Dividend</th>
  <th class="col-style">Style</th>
  <th class="col-isin">ISIN / Master ID</th>
  <th class="col-master">Master Fund Name</th>
</tr>`;

function buildHighlightDropdown(code) {
  const cur = highlightMap[code] || '';
  const opts = HIGHLIGHT_COLORS.map(c =>
    `<option value="${c.value}" ${c.value === cur ? 'selected' : ''}>${c.label}</option>`
  ).join('');
  const bg = HIGHLIGHT_COLORS.find(c => c.value === cur)?.bg || '';
  return `<select class="hl-select" data-code="${code}" onchange="setHighlight('${code}',this.value,this)"
    style="background:${bg || '#fff'};border:1px solid #e0e4ea;border-radius:5px;padding:2px 4px;font-size:13px;cursor:pointer;width:100px;">${opts}</select>`;
}

function setHighlight(code, color, selectEl) {
  if (color) {
    highlightMap[code] = color;
  } else {
    delete highlightMap[code];
  }
  const bg = HIGHLIGHT_COLORS.find(c => c.value === color)?.bg || '';
  selectEl.style.background = bg || '#fff';
  // อัปเดต highlight ใน row ปัจจุบัน
  applyHighlightToRow(code);
}

function hlStyle(code) {
  // คืนค่า inline style สำหรับ background บน fund-code cell
  const color = highlightMap[code];
  const bg    = color ? (HIGHLIGHT_COLORS.find(c => c.value === color)?.bg || '') : '';
  return bg ? `style="background:${bg}!important;"` : '';
}

function applyHighlightToRow(code) {
  const bg = (() => {
    const color = highlightMap[code];
    return color ? (HIGHLIGHT_COLORS.find(c => c.value === color)?.bg || '') : '';
  })();

  // fund-table: อัปเดตเฉพาะ td.fund-code
  document.querySelectorAll('#fund-table td.fund-code').forEach(td => {
    if (td.textContent.trim() === code) {
      td.style.background = bg || '';
    }
  });
  // return tables: td.fund-code
  document.querySelectorAll('#thai-return-table td.fund-code, #master-ann-table td.fund-code').forEach(td => {
    if (td.textContent.trim() === code) {
      td.style.background = bg || '';
    }
  });
  // cal tables: td.fund-code-mid
  document.querySelectorAll('#thai-cal-table td.fund-code-mid, #master-cal-table td.fund-code-mid').forEach(td => {
    if (td.textContent.trim() === code) {
      td.style.background = bg || '';
    }
  });
}

function buildFundRow(fund, cbId, isChecked) {
  const isinVal   = (fund.isin && fund.isin !== '-') ? fund.isin : '—';
  const masterVal = fund.master_name || '—';
  return `
    <td class="checkbox-cell">
      <input type="checkbox" id="${cbId}" class="fund-checkbox" data-code="${fund.code}"
        ${isChecked ? 'checked' : ''}>
    </td>
    <td class="fund-code" ${hlStyle(fund.code)}>${fund.code}</td>
    <td class="highlight-cell">${buildHighlightDropdown(fund.code)}</td>
    <td class="fund-type">${fund.type || '—'}</td>
    <td class="fund-div">${fund.dividend || '—'}</td>
    <td class="fund-style">${fund.style || '—'}</td>
    <td class="fund-isin">${isinVal}</td>
    <td class="fund-master" title="${fund.master_name || ''}">${masterVal}</td>
  `;
}

// ===== TABLE RENDER (fixed 7 columns) =====
function renderTable() {
  const head = document.getElementById('table-head');
  const body = document.getElementById('table-body');

  if (head.children.length === 0) {
    head.innerHTML = FUND_TABLE_HEADERS;
  }

  body.innerHTML = '';

  const start    = (currentPage - 1) * rowsPerPage;
  const pageData = filtered.slice(start, start + rowsPerPage);

  if (pageData.length === 0) {
    body.innerHTML = '<tr><td colspan="8" class="loading-cell">ไม่พบข้อมูล</td></tr>';
    // sync select-all state
    const allCb = document.getElementById('select-all-cb');
    if (allCb) allCb.checked = false;
    return;
  }

  // sync select-all: checked if every filtered fund is checked
  const allCb = document.getElementById('select-all-cb');
  if (allCb) {
    allCb.checked = filtered.length > 0 && filtered.every(f => checkedFunds.has(f.code));
    allCb.indeterminate = !allCb.checked && filtered.some(f => checkedFunds.has(f.code));
  }

  pageData.forEach((fund, idx) => {
    const cbId = `cb-${start + idx}`;
    const isChecked = checkedFunds.has(fund.code);
    const row = document.createElement('tr');
    if (isChecked) row.classList.add('row-checked');
    row.innerHTML = buildFundRow(fund, cbId, isChecked);
    body.appendChild(row);

    document.getElementById(cbId).addEventListener('change', (e) => {
      if (e.target.checked) {
        checkedFunds.add(fund.code);
        row.classList.add('row-checked');
      } else {
        checkedFunds.delete(fund.code);
        row.classList.remove('row-checked');
      }
      updateCheckedBadge();
    });
  });
}

function updateCheckedBadge() {
  const count = document.getElementById('fund-count');
  const extra = checkedFunds.size > 0 ? ` (เลือกไว้ ${checkedFunds.size})` : '';
  count.textContent = `${filtered.length} / ${allFunds.length} กองทุน${extra}`;
}

// ===== PAGINATION =====
function changePage(delta) {
  const maxPage = Math.ceil(filtered.length / rowsPerPage);
  currentPage = Math.max(1, Math.min(currentPage + delta, maxPage));
  renderTable();
  updatePagination();
}

function changeRowsPerPage(val) {
  rowsPerPage = parseInt(val);
  currentPage = 1;
  renderTable();
  updatePagination();
}

function updatePagination() {
  const maxPage = Math.ceil(filtered.length / rowsPerPage);
  const start = (currentPage - 1) * rowsPerPage + 1;
  const end   = Math.min(currentPage * rowsPerPage, filtered.length);
  document.getElementById('page-info').textContent = `${start} - ${end} จาก ${filtered.length}`;
  document.getElementById('prev-btn').disabled = currentPage === 1;
  document.getElementById('next-btn').disabled = currentPage === maxPage;
}

// ===== หน้า ผลตอบแทนกองทุนไทย =====
const RETURN_PERIODS = ['1m','3m','6m','ytd','1y','3y','5y'];

// sort state
let returnSortCol = null, returnSortDir = 'desc';
let calSortCol    = null, calSortDir    = 'desc';

function sortReturnTable(col) {
  if (returnSortCol === col) {
    returnSortDir = returnSortDir === 'desc' ? 'asc' : 'desc';
  } else {
    returnSortCol = col;
    returnSortDir = 'desc';
  }
  populateThaiReturnTable();
}

function sortCalTable(col) {
  if (calSortCol === col) {
    calSortDir = calSortDir === 'desc' ? 'asc' : 'desc';
  } else {
    calSortCol = col;
    calSortDir = 'desc';
  }
  populateThaiCalTable();
}

function updateSortIndicators(tableId, activeCol, dir) {
  document.querySelectorAll(`#${tableId} th.sortable`).forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sortCol === activeCol) {
      th.classList.add(dir === 'desc' ? 'sort-desc' : 'sort-asc');
    }
  });
}

function fmtRet(val) {
  if (val === null || val === undefined) return '<span style="color:var(--text-sub)">—</span>';
  const n   = parseFloat(val);
  const cls = n > 0 ? 'ret-pos' : n < 0 ? 'ret-neg' : '';
  const str = n.toFixed(2) + '%';   // ไม่มี + นำหน้า, ลบแสดงตามปกติ
  return cls ? `<span class="${cls}">${str}</span>` : str;
}

// คำนวณอันดับ (rank 1 = ดีที่สุด) สำหรับ array ของกองทุน
function computeRanks(funds, getVal) {
  const withVal = funds
    .map(f => ({ code: f.code, val: getVal(f) }))
    .filter(x => x.val != null && !isNaN(x.val));
  withVal.sort((a, b) => b.val - a.val);
  const rankMap = {};
  withVal.forEach((x, i) => { rankMap[x.code] = i + 1; });
  return { rankMap, total: withVal.length };
}

// สี highlight อันดับ: rank 1 = เขียวเข้ม, อันดับท้าย = เขียวอ่อน
function rankBg(rank, total) {
  if (!rank || !total || total < 2) return '#7ABC81';
  const ratio = (rank - 1) / (total - 1);          // 0=best, 1=worst
  const l = Math.round(38 + ratio * 48);            // 38% → 86% lightness
  const s = Math.round(68 - ratio * 28);            // 68% → 40% saturation
  return `hsl(120,${s}%,${l}%)`;
}

function populateThaiReturnTable() {
  const tbody = document.querySelector('#thai-return-table tbody');
  tbody.innerHTML = '';

  if (checkedFunds.size === 0) {
    tbody.innerHTML = `<tr><td colspan="15" style="text-align:center;color:var(--text-sub);padding:24px;">
      ยังไม่มีกองทุนที่เลือก — กรุณาเลือกกองทุนจากแท็บ "เลือกกองทุน"
    </td></tr>`;
    return;
  }

  let selectedFunds = allFunds.filter(f => checkedFunds.has(f.code));

  // จัดเรียงตาม sort state
  if (returnSortCol) {
    selectedFunds = [...selectedFunds].sort((a, b) => {
      let av, bv;
      if (returnSortCol === 'code') {
        av = a.code || ''; bv = b.code || '';
        return returnSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      av = (a.returns && a.returns[returnSortCol] != null) ? a.returns[returnSortCol] : -Infinity;
      bv = (b.returns && b.returns[returnSortCol] != null) ? b.returns[returnSortCol] : -Infinity;
      return returnSortDir === 'desc' ? bv - av : av - bv;
    });
  }
  updateSortIndicators('thai-return-table', returnSortCol, returnSortDir);

  // คำนวณอันดับทุก period ล่วงหน้า
  const rankData = {};
  RETURN_PERIODS.forEach(p => {
    rankData[p] = computeRanks(selectedFunds, f => (f.returns && f.returns[p] != null) ? f.returns[p] : null);
  });

  selectedFunds.forEach(fund => {
    const r   = fund.returns || {};
    const row = document.createElement('tr');
    const rankCells = RETURN_PERIODS.map((p, i) => {
      const { rankMap, total } = rankData[p];
      const rank = rankMap[fund.code];
      const bg   = rank ? `background:${rankBg(rank, total)};` : '';
      const sep  = i === 0 ? 'border-left:2px solid #c8d6e8;' : '';
      return `<td class="rank-cell" style="${sep}${bg}">${rank != null ? rank : '—'}</td>`;
    }).join('');

    row.innerHTML = `
      <td class="fund-code" ${hlStyle(fund.code)}>${fund.code}</td>
      ${RETURN_PERIODS.map(p => `<td class="ret-cell">${fmtRet(r[p])}</td>`).join('')}
      ${rankCells}
    `;
    tbody.appendChild(row);
  });
}

function resetThaiFilters() {
  populateThaiReturnTable();
}

// ===== หน้า กองทุนไทย Calendar Year =====
const CAL_YEARS = ['2016','2017','2018','2019','2020','2021','2022','2023','2024','2025'];
let visibleCalYears = new Set(CAL_YEARS);

function toggleCalYear(yr, checked) {
  if (checked) visibleCalYears.add(yr);
  else         visibleCalYears.delete(yr);
  populateThaiCalTable();
}

function populateThaiCalTable() {
  const table = document.getElementById('thai-cal-table');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  // ปีที่ต้องแสดง (ตาม checkbox)
  const activeYears = CAL_YEARS.filter(yr => visibleCalYears.has(yr));
  const N = activeYears.length;

  // ── Render thead แบบ dynamic (fund code อยู่ตรงกลาง) ──────────────────────
  thead.innerHTML = `
    <tr>
      <th colspan="${N || 1}" class="group-hdr">ผลตอบแทนรายปี (%)</th>
      <th rowspan="2" class="col-fund-code sortable" data-sort-col="code" onclick="sortCalTable('code')">กองทุนในไทย</th>
      <th colspan="${N || 1}" class="group-hdr rank-group-hdr">Ranking Calendar Year Return</th>
    </tr>
    <tr>
      ${activeYears.map(yr => `<th class="sortable" data-sort-col="${yr}" onclick="sortCalTable('${yr}')">${yr}</th>`).join('')}
      ${activeYears.map((yr, i) => `<th${i === 0 ? ' class="rank-sep"' : ''}>${yr}</th>`).join('')}
    </tr>
  `;

  tbody.innerHTML = '';

  if (checkedFunds.size === 0) {
    const cols = N * 2 + 1;
    tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;color:var(--text-sub);padding:24px;">
      ยังไม่มีกองทุนที่เลือก — กรุณาเลือกกองทุนจากแท็บ "เลือกกองทุน"
    </td></tr>`;
    return;
  }

  let selectedFunds = allFunds.filter(f => checkedFunds.has(f.code));

  // จัดเรียงตาม sort state
  if (calSortCol) {
    selectedFunds = [...selectedFunds].sort((a, b) => {
      let av, bv;
      if (calSortCol === 'code') {
        av = a.code || ''; bv = b.code || '';
        return calSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      av = (a.cal && a.cal[calSortCol] && a.cal[calSortCol].ret != null) ? a.cal[calSortCol].ret : -Infinity;
      bv = (b.cal && b.cal[calSortCol] && b.cal[calSortCol].ret != null) ? b.cal[calSortCol].ret : -Infinity;
      return calSortDir === 'desc' ? bv - av : av - bv;
    });
  }
  updateSortIndicators('thai-cal-table', calSortCol, calSortDir);

  // คำนวณอันดับเฉพาะปีที่แสดง
  const rankData = {};
  activeYears.forEach(yr => {
    rankData[yr] = computeRanks(selectedFunds, f => {
      const c = f.cal && f.cal[yr];
      return (c && c.ret != null) ? c.ret : null;
    });
  });

  selectedFunds.forEach(fund => {
    const cal = fund.cal || {};
    const rankCells = activeYears.map((yr, i) => {
      const { rankMap, total } = rankData[yr];
      const rank = rankMap[fund.code];
      const bg   = rank ? `background:${rankBg(rank, total)};` : '';
      const sep  = i === 0 ? 'border-left:2px solid #c8d6e8;' : '';
      return `<td class="rank-cell" style="${sep}${bg}">${rank != null ? rank : '—'}</td>`;
    }).join('');

    const row = document.createElement('tr');
    row.innerHTML = `
      ${activeYears.map(yr => `<td class="ret-cell">${fmtRet(cal[yr] ? cal[yr].ret : null)}</td>`).join('')}
      <td class="fund-code-mid" ${hlStyle(fund.code)}>${fund.code}</td>
      ${rankCells}
    `;
    tbody.appendChild(row);
  });
}

function copyCalTable() {
  const table = document.getElementById('thai-cal-table');
  const rows  = table.querySelectorAll('tr');
  const lines = [];
  rows.forEach(tr => {
    const vals = [];
    tr.querySelectorAll('th, td').forEach(td => vals.push(td.innerText.replace(/\n/g, ' ').trim()));
    lines.push(vals.join('\t'));
  });
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const toast = document.getElementById('copy-cal-toast');
    toast.style.display = 'inline-block';
    setTimeout(() => { toast.style.display = 'none'; }, 2000);
  });
}

function saveCalAsImage() {
  if (checkedFunds.size === 0) {
    alert('ยังไม่มีกองทุนที่เลือก — กรุณาเลือกกองทุนก่อน');
    return;
  }
  const wrap   = document.getElementById('thai-cal-wrap');
  const period = (FUND_DATA && FUND_DATA.meta && FUND_DATA.meta.period) || 'export';
  html2canvas(wrap, { backgroundColor: '#ffffff', scale: 2, useCORS: true }).then(canvas => {
    const link   = document.createElement('a');
    link.download = `fund-cal-${period}.png`;
    link.href     = canvas.toDataURL('image/png');
    link.click();
  });
}

// ===== คัดลอกตาราง =====
function copyReturnTable() {
  const table = document.getElementById('thai-return-table');
  const rows  = table.querySelectorAll('tr');
  if (!rows.length) return;

  const lines = [];
  rows.forEach(tr => {
    const cells = tr.querySelectorAll('th, td');
    const vals  = [];
    cells.forEach(td => {
      // ดึง text ล้วน ไม่เอา HTML tag
      vals.push(td.innerText.replace(/\n/g, ' ').trim());
    });
    lines.push(vals.join('\t'));
  });

  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const toast = document.getElementById('copy-toast');
    toast.style.display = 'inline-block';
    setTimeout(() => { toast.style.display = 'none'; }, 2000);
  });
}

// ===== บันทึกเป็นรูป PNG =====
function saveReturnAsImage() {
  if (checkedFunds.size === 0) {
    alert('ยังไม่มีกองทุนที่เลือก — กรุณาเลือกกองทุนจากแท็บ "เลือกกองทุน" ก่อน');
    return;
  }

  // สลับไปหน้า thai-return ก่อน (กรณีกดจาก sidebar)
  const page = document.getElementById('page-thai-return');
  if (!page.classList.contains('active')) {
    document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    page.classList.add('active');
    document.getElementById('page-title').textContent = PAGE_TITLES['thai-return'];
    populateThaiReturnTable();
  }

  const wrap = document.getElementById('thai-return-wrap');
  html2canvas(wrap, {
    backgroundColor: '#ffffff',
    scale: 2,           // ความละเอียด 2x
    useCORS: true,
  }).then(canvas => {
    const period = (FUND_DATA && FUND_DATA.meta && FUND_DATA.meta.period) || 'export';
    const link   = document.createElement('a');
    link.download = `fund-return-${period}.png`;
    link.href     = canvas.toDataURL('image/png');
    link.click();
  });
}

// ===== หน้า Master Fund Annualized =====
let masterAnnSortCol = null, masterAnnSortDir = 'desc';

function sortMasterAnnTable(col) {
  if (masterAnnSortCol === col) {
    masterAnnSortDir = masterAnnSortDir === 'desc' ? 'asc' : 'desc';
  } else {
    masterAnnSortCol = col;
    masterAnnSortDir = 'desc';
  }
  populateMasterAnnTable();
}

function populateMasterAnnTable() {
  const tbody = document.querySelector('#master-ann-table tbody');
  tbody.innerHTML = '';

  if (checkedFunds.size === 0) {
    tbody.innerHTML = `<tr><td colspan="17" style="text-align:center;color:var(--text-sub);padding:24px;">
      ยังไม่มีกองทุนที่เลือก — กรุณาเลือกกองทุนจากแท็บ "เลือกกองทุน"
    </td></tr>`;
    return;
  }

  let selectedFunds = allFunds.filter(f => checkedFunds.has(f.code));

  // กรองเฉพาะที่มีข้อมูล master_returns
  const withMaster = selectedFunds.filter(f => f.master_returns && Object.keys(f.master_returns).length > 0);
  const noMaster   = selectedFunds.filter(f => !f.master_returns || Object.keys(f.master_returns).length === 0);

  if (masterAnnSortCol) {
    const sortFunds = (arr) => [...arr].sort((a, b) => {
      let av, bv;
      if (masterAnnSortCol === 'code') {
        av = a.code || ''; bv = b.code || '';
        return masterAnnSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      av = (a.master_returns && a.master_returns[masterAnnSortCol] != null)
           ? (a.master_returns[masterAnnSortCol].ret ?? -Infinity) : -Infinity;
      bv = (b.master_returns && b.master_returns[masterAnnSortCol] != null)
           ? (b.master_returns[masterAnnSortCol].ret ?? -Infinity) : -Infinity;
      return masterAnnSortDir === 'desc' ? bv - av : av - bv;
    });
    selectedFunds = [...sortFunds(withMaster), ...noMaster];
  }
  updateSortIndicators('master-ann-table', masterAnnSortCol, masterAnnSortDir);

  // คำนวณอันดับ
  const rankData = {};
  RETURN_PERIODS.forEach(p => {
    rankData[p] = computeRanks(withMaster, f => {
      const mr = f.master_returns && f.master_returns[p];
      return (mr && mr.ret != null) ? mr.ret : null;
    });
  });

  selectedFunds.forEach(fund => {
    const mr  = fund.master_returns || {};
    const row = document.createElement('tr');
    const rankCells = RETURN_PERIODS.map((p, i) => {
      const { rankMap, total } = rankData[p];
      const rank = rankMap[fund.code];
      const bg   = rank ? `background:${rankBg(rank, total)};` : '';
      const sep  = i === 0 ? 'border-left:2px solid #c8d6e8;' : '';
      return `<td class="rank-cell" style="${sep}${bg}">${rank != null ? rank : '—'}</td>`;
    }).join('');

    const isinVal = (fund.isin && fund.isin !== '-') ? fund.isin : '—';
    const masterNameVal = fund.master_name || '—';
    row.innerHTML = `
      <td class="fund-code" ${hlStyle(fund.code)}>${fund.code}</td>
      <td class="master-name-cell" title="${fund.master_name || ''}">${masterNameVal}</td>
      <td class="isin-cell">${isinVal}</td>
      ${RETURN_PERIODS.map(p => `<td class="ret-cell">${fmtRet(mr[p] ? mr[p].ret : null)}</td>`).join('')}
      ${rankCells}
    `;
    tbody.appendChild(row);
  });
}

function copyMasterAnnTable() {
  const table = document.getElementById('master-ann-table');
  const rows  = table.querySelectorAll('tr');
  const lines = [];
  rows.forEach(tr => {
    const vals = [];
    tr.querySelectorAll('th, td').forEach(td => vals.push(td.innerText.replace(/\n/g, ' ').trim()));
    lines.push(vals.join('\t'));
  });
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const toast = document.getElementById('copy-master-ann-toast');
    toast.style.display = 'inline-block';
    setTimeout(() => { toast.style.display = 'none'; }, 2000);
  });
}

function saveMasterAnnAsImage() {
  if (checkedFunds.size === 0) {
    alert('ยังไม่มีกองทุนที่เลือก — กรุณาเลือกกองทุนก่อน');
    return;
  }
  const wrap   = document.getElementById('master-ann-wrap');
  const period = (FUND_DATA && FUND_DATA.meta && FUND_DATA.meta.period) || 'export';
  html2canvas(wrap, { backgroundColor: '#ffffff', scale: 2, useCORS: true }).then(canvas => {
    const link   = document.createElement('a');
    link.download = `master-ann-${period}.png`;
    link.href     = canvas.toDataURL('image/png');
    link.click();
  });
}

// ===== หน้า Master Fund Calendar Year =====
let masterCalSortCol = null, masterCalSortDir = 'desc';
let visibleMasterCalYears = new Set(CAL_YEARS);

function toggleMasterCalYear(yr, checked) {
  if (checked) visibleMasterCalYears.add(yr);
  else         visibleMasterCalYears.delete(yr);
  populateMasterCalTable();
}

function sortMasterCalTable(col) {
  if (masterCalSortCol === col) {
    masterCalSortDir = masterCalSortDir === 'desc' ? 'asc' : 'desc';
  } else {
    masterCalSortCol = col;
    masterCalSortDir = 'desc';
  }
  populateMasterCalTable();
}

function populateMasterCalTable() {
  const table = document.getElementById('master-cal-table');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  const activeYears = CAL_YEARS.filter(yr => visibleMasterCalYears.has(yr));
  const N = activeYears.length;

  // Render thead แบบ dynamic (fund code อยู่ตรงกลาง)
  thead.innerHTML = `
    <tr>
      <th colspan="${N || 1}" class="group-hdr">ผลตอบแทน Master Fund รายปี (%)</th>
      <th rowspan="2" class="col-fund-code sortable" data-sort-col="code" onclick="sortMasterCalTable('code')">กองทุนในไทย</th>
      <th rowspan="2" class="group-hdr" style="background:#1a3c6e;min-width:160px;text-align:left;border-left:1px solid #2a4a7a;border-right:1px solid #2a4a7a;">Master Fund</th>
      <th rowspan="2" class="group-hdr" style="background:#1a3c6e;min-width:110px;">ISIN</th>
      <th colspan="${N || 1}" class="group-hdr rank-group-hdr">อันดับ (ในกลุ่มที่เลือก)</th>
    </tr>
    <tr>
      ${activeYears.map(yr => `<th class="sortable" data-sort-col="${yr}" onclick="sortMasterCalTable('${yr}')">${yr}</th>`).join('')}
      ${activeYears.map((yr, i) => `<th${i === 0 ? ' class="rank-sep"' : ''}>${yr}</th>`).join('')}
    </tr>
  `;

  tbody.innerHTML = '';

  if (checkedFunds.size === 0) {
    const cols = N * 2 + 3;  // returns + code + master_name + isin + ranks
    tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align:center;color:var(--text-sub);padding:24px;">
      ยังไม่มีกองทุนที่เลือก — กรุณาเลือกกองทุนจากแท็บ "เลือกกองทุน"
    </td></tr>`;
    return;
  }

  let selectedFunds = allFunds.filter(f => checkedFunds.has(f.code));

  if (masterCalSortCol) {
    selectedFunds = [...selectedFunds].sort((a, b) => {
      let av, bv;
      if (masterCalSortCol === 'code') {
        av = a.code || ''; bv = b.code || '';
        return masterCalSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const ayr = a.master_cal && a.master_cal[masterCalSortCol];
      const byr = b.master_cal && b.master_cal[masterCalSortCol];
      av = (ayr && ayr.ret != null) ? ayr.ret : -Infinity;
      bv = (byr && byr.ret != null) ? byr.ret : -Infinity;
      return masterCalSortDir === 'desc' ? bv - av : av - bv;
    });
  }
  updateSortIndicators('master-cal-table', masterCalSortCol, masterCalSortDir);

  // คำนวณอันดับ
  const rankData = {};
  activeYears.forEach(yr => {
    rankData[yr] = computeRanks(selectedFunds, f => {
      const c = f.master_cal && f.master_cal[yr];
      return (c && c.ret != null) ? c.ret : null;
    });
  });

  selectedFunds.forEach(fund => {
    const mc  = fund.master_cal || {};
    const rankCells = activeYears.map((yr, i) => {
      const { rankMap, total } = rankData[yr];
      const rank = rankMap[fund.code];
      const bg   = rank ? `background:${rankBg(rank, total)};` : '';
      const sep  = i === 0 ? 'border-left:2px solid #c8d6e8;' : '';
      return `<td class="rank-cell" style="${sep}${bg}">${rank != null ? rank : '—'}</td>`;
    }).join('');

    const isinVal = (fund.isin && fund.isin !== '-') ? fund.isin : '—';
    const masterNameVal = fund.master_name || '—';
    const row = document.createElement('tr');
    row.innerHTML = `
      ${activeYears.map(yr => `<td class="ret-cell">${fmtRet(mc[yr] ? mc[yr].ret : null)}</td>`).join('')}
      <td class="fund-code-mid" ${hlStyle(fund.code)}>${fund.code}</td>
      <td class="master-name-cell" title="${fund.master_name || ''}">${masterNameVal}</td>
      <td class="isin-cell">${isinVal}</td>
      ${rankCells}
    `;
    tbody.appendChild(row);
  });
}

function copyMasterCalTable() {
  const table = document.getElementById('master-cal-table');
  const rows  = table.querySelectorAll('tr');
  const lines = [];
  rows.forEach(tr => {
    const vals = [];
    tr.querySelectorAll('th, td').forEach(td => vals.push(td.innerText.replace(/\n/g, ' ').trim()));
    lines.push(vals.join('\t'));
  });
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const toast = document.getElementById('copy-master-cal-toast');
    toast.style.display = 'inline-block';
    setTimeout(() => { toast.style.display = 'none'; }, 2000);
  });
}

function saveMasterCalAsImage() {
  if (checkedFunds.size === 0) {
    alert('ยังไม่มีกองทุนที่เลือก — กรุณาเลือกกองทุนก่อน');
    return;
  }
  const wrap   = document.getElementById('master-cal-wrap');
  const period = (FUND_DATA && FUND_DATA.meta && FUND_DATA.meta.period) || 'export';
  html2canvas(wrap, { backgroundColor: '#ffffff', scale: 2, useCORS: true }).then(canvas => {
    const link   = document.createElement('a');
    link.download = `master-cal-${period}.png`;
    link.href     = canvas.toDataURL('image/png');
    link.click();
  });
}

// ===== หน้า ค่าธรรมเนียมเหมาะสม =====
let feesSortCol = 'combined_ter', feesSortDir = 'asc';

function sortFeesTable(col) {
  if (feesSortCol === col) {
    feesSortDir = feesSortDir === 'desc' ? 'asc' : 'desc';
  } else {
    feesSortCol = col;
    feesSortDir = col === 'master' || col === 'code' ? 'asc' : 'asc';
  }
  populateFeesTable();
}

function fmtTer(val) {
  if (val == null) return '<span class="ter-na">—</span>';
  return parseFloat(val).toFixed(3);
}

function fmtLoad(val) {
  if (val == null) return '<span class="na">—</span>';
  const n = parseFloat(val);
  return n === 0 ? '<span style="color:#6b7280;">0.000</span>' : n.toFixed(3);
}

function fmtNav(val) {
  if (val == null) return '<span class="na">—</span>';
  const m = val / 1e6;
  return m >= 1000
    ? (m / 1000).toFixed(1) + ' พัน ล.'
    : m.toFixed(0) + ' ล.';
}

function fmtDate(str) {
  if (!str) return '—';
  // "2025-12-25 00:00:00" → "25/12/68"
  const d = new Date(str);
  if (isNaN(d)) return str.slice(0, 10) || '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear() - 1957);   // พ.ศ.
  return `${dd}/${mm}/${yy}`;
}

function combinedTerGreenStyle(val, minVal, maxVal) {
  if (val == null) return '';
  if (maxVal === minVal) return 'background:hsl(120,55%,72%);';
  const t = (val - minVal) / (maxVal - minVal); // 0=best(low TER), 1=worst(high TER)
  const sat = Math.round(62 - 27 * t);  // 62% → 35%
  const lit = Math.round(68 + 17 * t);  // 68% → 85%
  return `background:hsl(120,${sat}%,${lit}%);`;
}

function populateFeesTable() {
  const tbody = document.querySelector('#fees-table tbody');
  tbody.innerHTML = '';

  if (checkedFunds.size === 0) {
    tbody.innerHTML = `<tr><td colspan="14" style="text-align:center;color:var(--text-sub);padding:24px;">
      ยังไม่มีกองทุนที่เลือก — กรุณาเลือกกองทุนจากแท็บ "เลือกกองทุน"
    </td></tr>`;
    return;
  }

  let selectedFunds = allFunds.filter(f => checkedFunds.has(f.code));

  // คำนวณ combined TER per fund
  selectedFunds = selectedFunds.map(f => {
    const fees      = f.fees || {};
    const masterFee = f.master_fee || {};
    const masterTer = masterFee.ongoing_cost ?? null;
    const thaiTer   = fees.annual_expense ?? null;
    const combined  = (masterTer != null && thaiTer != null)
                      ? masterTer + thaiTer
                      : (thaiTer != null ? thaiTer : null);
    return { ...f, _masterTer: masterTer, _thaiTer: thaiTer, _combined: combined };
  });

  // Compute combined TER range for relative green gradient
  const terVals = selectedFunds.map(f => f._combined).filter(v => v != null);
  const terMin  = terVals.length ? Math.min(...terVals) : 0;
  const terMax  = terVals.length ? Math.max(...terVals) : 0;

  // Sort
  selectedFunds.sort((a, b) => {
    let av, bv;
    switch (feesSortCol) {
      case 'master':        av = a.master_name || '';     bv = b.master_name || '';     break;
      case 'code':          av = a.code || '';             bv = b.code || '';             break;
      case 'fee_date':      av = a.fees?.fee_date || '';  bv = b.fees?.fee_date || '';  break;
      case 'master_ter':    av = a._masterTer;  bv = b._masterTer;  break;
      case 'thai_ter':      av = a._thaiTer;    bv = b._thaiTer;    break;
      case 'combined_ter':  av = a._combined;   bv = b._combined;   break;
      case 'front_load':    av = a.fees?.front_load;    bv = b.fees?.front_load;    break;
      case 'deferred_load': av = a.fees?.deferred_load; bv = b.fees?.deferred_load; break;
      case 'nav':           av = a.fees?.nav;   bv = b.fees?.nav;   break;
      default:              av = a._combined;   bv = b._combined;
    }
    if (typeof av === 'string') {
      const cmp = av.localeCompare(bv);
      return feesSortDir === 'asc' ? cmp : -cmp;
    }
    av = av ?? (feesSortDir === 'asc' ? Infinity : -Infinity);
    bv = bv ?? (feesSortDir === 'asc' ? Infinity : -Infinity);
    return feesSortDir === 'asc' ? av - bv : bv - av;
  });
  updateSortIndicators('fees-table', feesSortCol, feesSortDir);

  selectedFunds.forEach(fund => {
    const fees    = fund.fees || {};
    const mfee    = fund.master_fee || {};
    const mTer    = fund._masterTer;
    const tTer    = fund._thaiTer;
    const combined = fund._combined;

    // Combined TER green gradient (relative among selected funds)
    const terBg   = combinedTerGreenStyle(combined, terMin, terMax);
    const terCell = combined != null
      ? `<td class="fees-combined" style="${terBg}">${combined.toFixed(3)}</td>`
      : `<td class="fees-combined"><span class="ter-na">—</span></td>`;

    // Date: use fee_date from thai_fees
    const dateStr = fmtDate(fees.fee_date || fees.nav_date || mfee.ongoing_cost_dt);
    const navStr  = fmtNav(fees.nav);
    const masterNameVal = fund.master_name || '—';

    // Source link (Morningstar sec_id)
    const srcCell = fund.sec_id
      ? `<a href="https://www.morningstar.co.th/th/funds/snapshot/snapshot.aspx?id=${fund.sec_id}" target="_blank" class="fees-src-link" title="${fund.sec_id}">🔗</a>`
      : '—';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="fees-master" title="${fund.master_name || ''}">${masterNameVal}</td>
      <td class="fees-code" ${hlStyle(fund.code)}>${fund.code}</td>
      <td class="fees-date">${dateStr}</td>
      <td class="fees-ter">${fmtTer(mTer)}</td>
      <td class="fees-ter">${fmtTer(tTer)}</td>
      ${terCell}
      <td class="fees-spacer"></td>
      <td class="fees-load-in">${fmtLoad(fees.front_load)}</td>
      <td class="fees-load-out">${fmtLoad(fees.deferred_load)}</td>
      <td class="fees-nav">${navStr}</td>
      <td class="fees-misc">—</td>
      <td class="fees-misc">—</td>
      <td class="fees-misc">—</td>
      <td class="fees-src">${srcCell}</td>
    `;
    tbody.appendChild(row);
  });
}

function copyFeesTable() {
  const table = document.getElementById('fees-table');
  const rows  = table.querySelectorAll('tr');
  const lines = [];
  rows.forEach(tr => {
    const vals = [];
    tr.querySelectorAll('th, td').forEach(td => vals.push(td.innerText.replace(/\n/g, ' ').trim()));
    lines.push(vals.join('\t'));
  });
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const toast = document.getElementById('copy-fees-toast');
    toast.style.display = 'inline-block';
    setTimeout(() => { toast.style.display = 'none'; }, 2000);
  });
}

function saveFeesAsImage() {
  if (checkedFunds.size === 0) {
    alert('ยังไม่มีกองทุนที่เลือก — กรุณาเลือกกองทุนก่อน');
    return;
  }
  const wrap   = document.getElementById('fees-wrap');
  const period = (FUND_DATA && FUND_DATA.meta && FUND_DATA.meta.period) || 'export';
  html2canvas(wrap, { backgroundColor: '#ffffff', scale: 2, useCORS: true }).then(canvas => {
    const link   = document.createElement('a');
    link.download = `fees-${period}.png`;
    link.href     = canvas.toDataURL('image/png');
    link.click();
  });
}

// ===== หน้า ปัจจัยประกอบอื่นๆ — Risk-Return Scatter =====
let riskPeriod = '3y';
let riskChart  = null;

// สีสำหรับ fund dots — ใช้ highlight ถ้ามี, ไม่งั้นใช้ชุดสีหลัก
const DOT_PALETTE = [
  '#3b82f6','#ef4444','#f59e0b','#10b981','#8b5cf6',
  '#ec4899','#06b6d4','#84cc16','#f97316','#6366f1',
];
const HL_DOT_COLORS = {
  yellow: '#ca8a04', orange: '#ea580c', green: '#16a34a',
  blue:   '#2563eb', pink:   '#db2777',
};

function setRiskPeriod(p) {
  riskPeriod = p;
  document.querySelectorAll('#risk-period-tabs .period-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.period === p);
  });
  buildRiskChart();
  // Also refresh bar panel if showing a risk metric (not cal_ret)
  const metric = document.getElementById('bar-metric')?.value;
  if (metric && metric !== 'cal_ret') buildBarPanel();
}

function buildRiskChart() {
  const noData  = document.getElementById('risk-no-data');
  const chartWrap = document.getElementById('risk-chart-wrap');
  const statsBody = document.getElementById('risk-stats-body');
  const countEl   = document.getElementById('risk-fund-count');

  const xField = document.getElementById('risk-xaxis')?.value || 'std_dev';
  const yField = document.getElementById('risk-yaxis')?.value || 'ret';

  // เก็บ funds ที่เลือก + มีข้อมูล period นี้
  const selectedFunds = allFunds.filter(f => checkedFunds.has(f.code));

  const points = selectedFunds.map(f => {
    const r  = (f.risk && f.risk[riskPeriod]) || {};
    return {
      fund: f,
      x: r[xField] ?? null,
      y: r[yField] ?? null,
      ret: r.ret ?? null,
      std_dev: r.std_dev ?? null,
      sharpe: r.sharpe ?? null,
      max_dd: r.max_dd ?? null,
    };
  }).filter(p => p.x != null && p.y != null);

  if (selectedFunds.length === 0) {
    noData.style.display = 'block'; chartWrap.style.display = 'none';
    statsBody.innerHTML  = '';
    countEl.textContent  = '—';
    return;
  }
  noData.style.display = 'none'; chartWrap.style.display = 'block';
  countEl.textContent  = `${points.length} / ${selectedFunds.length} กองทุน (มีข้อมูล ${riskPeriod.toUpperCase()})`;

  // Axis labels
  const xLabels = { std_dev: 'SD — ความผันผวน (%)', max_dd: 'Max Drawdown (%)', sharpe: 'Sharpe Ratio' };
  const yLabels = { ret: 'ผลตอบแทน (%)', sharpe: 'Sharpe Ratio' };

  // Compute averages for quadrant lines
  const avgX = points.reduce((s,p) => s + p.x, 0) / (points.length || 1);
  const avgY = points.reduce((s,p) => s + p.y, 0) / (points.length || 1);

  // Build datasets — each fund is its own dataset so we can label them
  const datasets = points.map((p, i) => {
    const hlColor = highlightMap[p.fund.code];
    const color   = hlColor ? HL_DOT_COLORS[hlColor] : DOT_PALETTE[i % DOT_PALETTE.length];
    return {
      label: p.fund.code,
      data:  [{ x: p.x, y: p.y, fund: p.fund, pt: p }],
      backgroundColor: color + 'cc',
      borderColor:     color,
      borderWidth: 1.5,
      pointRadius: 7,
      pointHoverRadius: 9,
    };
  });

  // Quadrant average lines as annotation-style datasets
  const allX = points.map(p => p.x);
  const allY = points.map(p => p.y);
  const minX = Math.min(...allX), maxX = Math.max(...allX);
  const minY = Math.min(...allY), maxY = Math.max(...allY);
  const padX = (maxX - minX) * 0.08 || 1;
  const padY = (maxY - minY) * 0.08 || 1;

  // avg vertical line
  datasets.push({
    label: `เฉลี่ย ${xLabels[xField]?.split(' ')[0]}`,
    data:  [{ x: avgX, y: minY - padY }, { x: avgX, y: maxY + padY }],
    type:  'line',
    borderColor: 'rgba(99,102,241,0.4)',
    borderWidth: 1.5,
    borderDash: [5,4],
    pointRadius: 0,
    fill: false,
    tension: 0,
  });
  // avg horizontal line
  datasets.push({
    label: `เฉลี่ย ${yLabels[yField]?.split(' ')[0]}`,
    data:  [{ x: minX - padX, y: avgY }, { x: maxX + padX, y: avgY }],
    type:  'line',
    borderColor: 'rgba(239,68,68,0.4)',
    borderWidth: 1.5,
    borderDash: [5,4],
    pointRadius: 0,
    fill: false,
    tension: 0,
  });

  // Destroy old chart
  if (riskChart) { riskChart.destroy(); riskChart = null; }

  const ctx = document.getElementById('risk-chart').getContext('2d');
  riskChart = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 24, right: 24, bottom: 8, left: 8 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const raw = items[0]?.raw;
              return raw?.fund?.code || items[0]?.dataset?.label || '';
            },
            label: (item) => {
              const pt = item.raw?.pt;
              if (!pt) return '';
              const lines = [
                `  ${xLabels[xField]?.split('—')[0].trim()}: ${pt.x?.toFixed(2)}`,
                `  ${yLabels[yField]}: ${pt.y?.toFixed(2)}`,
              ];
              if (pt.ret    != null && yField !== 'ret')    lines.push(`  Return: ${pt.ret.toFixed(2)}%`);
              if (pt.sharpe != null && yField !== 'sharpe') lines.push(`  Sharpe: ${pt.sharpe.toFixed(2)}`);
              if (pt.max_dd != null && xField !== 'max_dd') lines.push(`  Max DD: ${pt.max_dd.toFixed(2)}%`);
              return lines;
            },
            afterLabel: (item) => {
              const name = item.raw?.fund?.master_name;
              return name ? `  ${name}` : '';
            },
          },
          backgroundColor: 'rgba(15,23,42,0.92)',
          titleColor: '#f8fafc',
          bodyColor:  '#cbd5e1',
          padding: 10,
          cornerRadius: 8,
          bodyFont: { family: 'THSarabunNew', size: 13 },
        },
        // Fund code labels directly on chart
        datalabels: null,
      },
      scales: {
        x: {
          title: { display: true, text: xLabels[xField] || xField, color: '#64748b', font: { size: 12, family: 'THSarabunNew' } },
          grid:  { color: 'rgba(0,0,0,0.05)' },
          ticks: { color: '#94a3b8', font: { size: 11, family: 'THSarabunNew' } },
        },
        y: {
          title: { display: true, text: yLabels[yField] || yField, color: '#64748b', font: { size: 12, family: 'THSarabunNew' } },
          grid:  { color: 'rgba(0,0,0,0.05)' },
          ticks: { color: '#94a3b8', font: { size: 11, family: 'THSarabunNew' } },
        },
      },
      // draw fund code labels as afterDraw plugin
      animation: { onComplete: () => drawFundLabels(riskChart, points, xField, yField) },
    },
    plugins: [{
      id: 'fundLabels',
      afterDatasetsDraw(chart) {
        drawFundLabels(chart, points, xField, yField);
      }
    }]
  });

  // Stats table below
  buildRiskStatsTable(points, statsBody);
}

function drawFundLabels(chart, points, xField, yField) {
  if (!chart || !chart.ctx) return;
  const ctx = chart.ctx;
  ctx.save();
  ctx.font = `bold 11px THSarabunNew, sans-serif`;
  ctx.textAlign = 'center';

  points.forEach((p, i) => {
    const meta = chart.getDatasetMeta(i);
    if (!meta || !meta.data || !meta.data[0]) return;
    const el = meta.data[0];
    const px = el.x, py = el.y;
    const hlColor = highlightMap[p.fund.code];
    const color   = hlColor ? HL_DOT_COLORS[hlColor] : DOT_PALETTE[i % DOT_PALETTE.length];

    // Draw label above dot
    ctx.fillStyle = color;
    ctx.fillText(p.fund.code, px, py - 11);
  });
  ctx.restore();
}

function buildRiskStatsTable(points, tbody) {
  tbody.innerHTML = '';
  // Sort by sharpe desc
  const sorted = [...points].sort((a,b) => (b.sharpe ?? -99) - (a.sharpe ?? -99));
  sorted.forEach(p => {
    const hlColor = highlightMap[p.fund.code];
    const dotColor = hlColor ? HL_DOT_COLORS[hlColor] : '#3b82f6';
    const rowBg   = hlColor ? (DOT_PALETTE[0] + '00') : '';  // transparent
    const hlBg    = hlColor ? ({'yellow':'#fef08a','orange':'#fed7aa','green':'#bbf7d0','blue':'#bae6fd','pink':'#fecdd3'}[hlColor] || '') : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding:5px 10px;border-bottom:1px solid #f0f2f5;white-space:nowrap;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};margin-right:5px;"></span>
        <strong style="${hlBg ? `background:${hlBg};padding:1px 5px;border-radius:3px;` : ''}color:var(--primary);">${p.fund.code}</strong>
      </td>
      <td style="padding:5px 10px;border-bottom:1px solid #f0f2f5;text-align:center;color:${(p.ret??0)>=0?'#15803d':'#dc2626'};font-weight:600;">
        ${p.ret != null ? p.ret.toFixed(2)+'%' : '—'}
      </td>
      <td style="padding:5px 10px;border-bottom:1px solid #f0f2f5;text-align:center;">
        ${p.std_dev != null ? p.std_dev.toFixed(2)+'%' : '—'}
      </td>
      <td style="padding:5px 10px;border-bottom:1px solid #f0f2f5;text-align:center;color:${(p.sharpe??0)>=0?'#15803d':'#dc2626'};">
        ${p.sharpe != null ? p.sharpe.toFixed(2) : '—'}
      </td>
      <td style="padding:5px 10px;border-bottom:1px solid #f0f2f5;text-align:center;color:#dc2626;">
        ${p.max_dd != null ? p.max_dd.toFixed(2)+'%' : '—'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ===== RIGHT PANEL: BAR CHART / TABLE =====
let barChart    = null;
let barViewMode = 'chart';  // 'chart' | 'table'

const BAR_METRIC_LABELS = {
  cal_ret: 'ผลตอบแทนรายปี (%)',
  max_dd:  'Max Drawdown (%)',
  std_dev: 'SD — ความผันผวน (%)',
  sharpe:  'Sharpe Ratio',
};

const BAR_PANEL_TITLES = {
  cal_ret: 'ผลตอบแทนรายปี — เปรียบเทียบแต่ละกอง',
  max_dd:  'Max Drawdown — เปรียบเทียบแต่ละกอง',
  std_dev: 'SD ความผันผวน — เปรียบเทียบแต่ละกอง',
  sharpe:  'Sharpe Ratio — เปรียบเทียบแต่ละกอง',
};

function setBarView(mode) {
  barViewMode = mode;
  document.getElementById('btn-chart-view').classList.toggle('active', mode === 'chart');
  document.getElementById('btn-table-view').classList.toggle('active', mode === 'table');
  document.getElementById('bar-chart-wrap').style.display = mode === 'chart' ? 'block' : 'none';
  document.getElementById('bar-table-wrap').style.display = mode === 'table'  ? 'flex'  : 'none';
  buildBarPanel();
}

function buildBarPanel() {
  const metric   = document.getElementById('bar-metric')?.value || 'cal_ret';
  const titleEl  = document.getElementById('bar-panel-title');
  const noDataEl = document.getElementById('bar-no-data');
  if (titleEl) titleEl.textContent = BAR_PANEL_TITLES[metric] || metric;

  const selectedFunds = allFunds.filter(f => checkedFunds.has(f.code));
  if (selectedFunds.length === 0) {
    noDataEl.style.display = 'block';
    document.getElementById('bar-chart-wrap').style.display = 'none';
    document.getElementById('bar-table-wrap').style.display = 'none';
    if (barChart) { barChart.destroy(); barChart = null; }
    return;
  }
  noDataEl.style.display = 'none';

  if (barViewMode === 'chart') {
    document.getElementById('bar-chart-wrap').style.display = 'block';
    document.getElementById('bar-table-wrap').style.display = 'none';
    buildBarChartInner(selectedFunds, metric);
  } else {
    document.getElementById('bar-chart-wrap').style.display = 'none';
    document.getElementById('bar-table-wrap').style.display = 'flex';
    buildBarTableInner(selectedFunds, metric);
  }
}

function buildBarChartInner(funds, metric) {
  // Determine labels (years or periods) and extract values
  let labels = [];
  let datasets = [];

  if (metric === 'cal_ret') {
    // All years that have at least one non-null value across selected funds
    const allYears = ['2010','2011','2012','2013','2014','2015','2016','2017','2018','2019',
                      '2020','2021','2022','2023','2024','2025'];
    labels = allYears.filter(yr =>
      funds.some(f => f.cal && f.cal[yr] && f.cal[yr].ret != null)
    );
    datasets = funds.map((f, i) => {
      const hlColor = highlightMap[f.code];
      const color   = hlColor ? HL_DOT_COLORS[hlColor] : DOT_PALETTE[i % DOT_PALETTE.length];
      return {
        label: f.code,
        data:  labels.map(yr => (f.cal && f.cal[yr] ? f.cal[yr].ret : null)),
        backgroundColor: color + 'b0',
        borderColor:     color,
        borderWidth: 1,
        borderRadius: 3,
      };
    });
  } else {
    // risk periods
    labels = ['1y', '3y', '5y'];
    datasets = funds.map((f, i) => {
      const hlColor = highlightMap[f.code];
      const color   = hlColor ? HL_DOT_COLORS[hlColor] : DOT_PALETTE[i % DOT_PALETTE.length];
      return {
        label: f.code,
        data:  labels.map(p => (f.risk && f.risk[p] ? f.risk[p][metric] : null)),
        backgroundColor: color + 'b0',
        borderColor:     color,
        borderWidth: 1,
        borderRadius: 3,
      };
    });
  }

  if (barChart) { barChart.destroy(); barChart = null; }
  const ctx = document.getElementById('bar-chart').getContext('2d');
  const isSmall = funds.length > 8;

  barChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 16, right: 8, bottom: 4, left: 4 } },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            boxWidth: 12,
            font: { size: isSmall ? 10 : 11, family: 'THSarabunNew' },
            padding: 8,
          },
        },
        tooltip: {
          callbacks: {
            label: (item) => {
              const v = item.raw;
              return ` ${item.dataset.label}: ${v != null ? v.toFixed(2) : '—'}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { font: { size: 11, family: 'THSarabunNew' } },
          grid: { color: '#f0f0f0' },
        },
        y: {
          ticks: {
            font: { size: 11, family: 'THSarabunNew' },
            callback: v => v.toFixed(1),
          },
          grid: { color: '#f0f0f0' },
          title: {
            display: true,
            text: BAR_METRIC_LABELS[metric] || '',
            font: { size: 11, family: 'THSarabunNew' },
            color: '#6b7280',
          },
        },
      },
    },
  });
}

function buildBarTableInner(funds, metric) {
  const thead = document.getElementById('bar-table-head');
  const tbody = document.getElementById('bar-table-body');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  let cols = [];
  let getValue;

  if (metric === 'cal_ret') {
    const allYears = ['2025','2024','2023','2022','2021','2020','2019','2018','2017','2016','2015','2014','2013','2012','2011','2010'];
    cols = allYears.filter(yr =>
      funds.some(f => f.cal && f.cal[yr] && f.cal[yr].ret != null)
    );
    getValue = (f, col) => f.cal && f.cal[col] ? f.cal[col].ret : null;
  } else {
    cols = ['1y','3y','5y'];
    getValue = (f, col) => f.risk && f.risk[col] ? f.risk[col][metric] : null;
  }

  // Header row
  const trh = document.createElement('tr');
  trh.innerHTML = `<th>กองทุน</th>` + cols.map(c => `<th>${c}</th>`).join('');
  thead.appendChild(trh);

  // Body rows (one per fund)
  funds.forEach((f, fi) => {
    const hlColor = highlightMap[f.code];
    const dotColor = hlColor ? HL_DOT_COLORS[hlColor] : DOT_PALETTE[fi % DOT_PALETTE.length];
    const tr = document.createElement('tr');
    let html = `<td style="color:${dotColor};">` +
               `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};margin-right:5px;"></span>` +
               `${f.code}</td>`;
    cols.forEach(col => {
      const val = getValue(f, col);
      let style = '';
      let display = '—';
      if (val != null) {
        display = val.toFixed(2);
        if (metric === 'cal_ret' || metric === 'sharpe') {
          style = val > 0 ? 'color:#15803d;font-weight:600;' : val < 0 ? 'color:#dc2626;font-weight:600;' : '';
        } else if (metric === 'max_dd') {
          style = 'color:#dc2626;';
        }
      }
      html += `<td style="${style}">${display}</td>`;
    });
    tr.innerHTML = html;
    tbody.appendChild(tr);
  });
}

// ===== TOP 10 HOLDINGS PAGE =====
// เก็บ cache holdings ที่โหลดแล้ว  { isin: { status: 'ok'|'error', rows: [...] } }
const holdingsCache   = {};   // { isin: { status:'ok'|'error', rows:[...] } }
const summaryCache    = {};   // { isin: { status:'ok'|'error', data:{...} } }
const top10Checked    = new Set(); // ISINs ที่ tick checkbox ไว้

const FT_BASE         = 'https://markets.ft.com/data/funds/tearsheet/holdings?s=';
const FT_SUMMARY_BASE = 'https://markets.ft.com/data/funds/tearsheet/summary?s=';

// ===== GAS URL MANAGEMENT =====
let gasWebAppUrl = localStorage.getItem('ft_gas_url') || '';

function initGasSettings() {
  const input = document.getElementById('gas-url-input');
  if (input && gasWebAppUrl) {
    input.value = gasWebAppUrl;
    updateGasBadge(true);
  }
}

function onGasUrlChange(val) {
  // Just live-update; save on button click
}

function saveGasUrl() {
  const input = document.getElementById('gas-url-input');
  const val   = (input ? input.value : '').trim();
  gasWebAppUrl = val;
  if (val) {
    localStorage.setItem('ft_gas_url', val);
    updateGasBadge(true);
  } else {
    localStorage.removeItem('ft_gas_url');
    updateGasBadge(false);
  }
  // Clear cache so next load uses new URL
  Object.keys(holdingsCache).forEach(k => delete holdingsCache[k]);
  Object.keys(summaryCache).forEach(k => delete summaryCache[k]);
  populateTop10Page();
}

function updateGasBadge(ok) {
  const badge = document.getElementById('gas-status-badge');
  if (!badge) return;
  badge.textContent = ok ? '✅ พร้อมใช้งาน' : '⚠️ ยังไม่ได้ตั้งค่า';
  badge.className   = 'gas-badge ' + (ok ? 'gas-badge-ok' : 'gas-badge-warn');
}

function toggleGasHelp(e) {
  e.preventDefault();
  const panel = document.getElementById('gas-help-panel');
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// ---- FT Data page — mirrors the same GAS URL (shared localStorage) ----
function initGasSettingsFt() {
  const input = document.getElementById('gas-url-input-ft');
  const badge = document.getElementById('gas-status-badge-ft');
  if (input) input.value = gasWebAppUrl || '';
  if (badge) {
    badge.textContent = gasWebAppUrl ? '✅ พร้อมใช้งาน' : '⚠️ ยังไม่ได้ตั้งค่า';
    badge.className   = 'gas-badge ' + (gasWebAppUrl ? 'gas-badge-ok' : 'gas-badge-warn');
  }
}
function saveGasUrlFt() {
  const input = document.getElementById('gas-url-input-ft');
  const val   = (input ? input.value : '').trim();
  gasWebAppUrl = val;
  if (val) localStorage.setItem('ft_gas_url', val);
  else     localStorage.removeItem('ft_gas_url');
  // also sync the Top 10 settings bar if visible
  const inp2 = document.getElementById('gas-url-input');
  if (inp2) inp2.value = val;
  updateGasBadge(!!val);
  initGasSettingsFt();
  Object.keys(holdingsCache).forEach(k => delete holdingsCache[k]);
  Object.keys(summaryCache).forEach(k => delete summaryCache[k]);
  populateFTDataPage();
}
function toggleGasHelpFt(e) {
  e.preventDefault();
  const p = document.getElementById('gas-help-panel-ft');
  if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

// ================================================================
// PAGE: ข้อมูลจาก FT.com  (layout เหมือน Top 10 Holding)
// ================================================================
const ftdataChecked = new Set(); // ISINs ที่ tick checkbox ไว้

function populateFTDataPage() {
  const noData  = document.getElementById('ftdata-no-data');
  const table   = document.getElementById('ftdata-summary-table');
  const tbody   = document.getElementById('ftdata-tbody');
  const statusEl= document.getElementById('ftdata-status');
  if (statusEl) statusEl.textContent = '';
  ftdataChecked.clear();
  renderFTDataPanel();

  const selected = allFunds.filter(f => checkedFunds.has(f.code));
  if (selected.length === 0) {
    noData.style.display = 'block';
    table.style.display  = 'none';
    return;
  }

  const groups = buildTop10Groups();
  if (groups.length === 0) {
    noData.style.display = 'block';
    table.style.display  = 'none';
    noData.textContent   = 'กองทุนที่เลือกไม่มีข้อมูล ISIN — ไม่สามารถดึงข้อมูลได้';
    return;
  }
  noData.style.display = 'none';
  table.style.display  = 'table';

  tbody.innerHTML = '';
  groups.forEach(g => {
    tbody.appendChild(buildFTDataRow(g));
    // Restore from cache if already loaded
    if (holdingsCache[g.isin]) updateFTDataRowStatus(g.isin, holdingsCache[g.isin]);
  });
  syncFTDataSelectAll();
}

// ---- Build one summary table row (mirrors buildSummaryRow) ----
function buildFTDataRow(group) {
  const tr = document.createElement('tr');
  tr.id = `ftdrow-${group.isin}`;

  const hlColor  = group.thaiCodes.map(c => highlightMap[c]).find(c => c) || null;
  const accentBg = hlColor ? (HIGHLIGHT_COLORS.find(h => h.value === hlColor)?.bg || '') : '';

  tr.innerHTML = `
    <td class="t10-isin" style="${accentBg ? 'border-left:3px solid '+accentBg+';' : ''}">
      <span class="t10-isin-txt">${group.isin}</span>
    </td>
    <td class="t10-master">${group.masterName}</td>
    <td class="t10-thai">
      ${group.thaiCodes.map(c => `<span class="top10-code-tag">${c}</span>`).join('')}
    </td>
    <td class="t10-load-cell">
      <button class="top10-load-btn" id="ftdbtn-${group.isin}" onclick="loadFTDataCard('${group.isin}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
        โหลด
      </button>
    </td>
    <td class="t10-status-cell" id="ftdstatus-${group.isin}">
      <span class="t10-status-pending">— ยังไม่ได้โหลด</span>
    </td>
    <td class="t10-cb-cell">
      <input type="checkbox" class="ftdata-row-cb" data-isin="${group.isin}"
             onchange="ftdataToggleRow(this)" style="accent-color:var(--primary);" disabled>
    </td>`;
  return tr;
}

// ---- Update status cell after load (mirrors updateRowStatus) ----
function updateFTDataRowStatus(isin, result) {
  const cell = document.getElementById(`ftdstatus-${isin}`);
  const cb   = document.querySelector(`.ftdata-row-cb[data-isin="${isin}"]`);
  if (!cell) return;

  if (result.status === 'ok' && result.rows.length > 0) {
    cell.innerHTML = `<span class="t10-status-ok">✅ ข้อมูลพร้อมใช้งาน <span style="color:#9ca3af;font-size:10px;">(${result.rows.length} holdings)</span></span>`;
    if (cb) { cb.disabled = false; }
  } else if (result.noGas) {
    cell.innerHTML = `<span class="t10-status-err">⚙️ กรุณาตั้งค่า GAS URL ด้านบน</span>`;
    if (cb) { cb.disabled = true; cb.checked = false; ftdataChecked.delete(isin); }
  } else {
    cell.innerHTML = `
      <span class="t10-status-err">
        ⚠️ ไม่สามารถดึงข้อมูลได้
        <a href="https://markets.ft.com/data/funds/tearsheet/summary?s=${isin}" target="_blank" class="top10-open-ft">เปิดหน้า FT →</a>
      </span>`;
    if (cb) { cb.disabled = true; cb.checked = false; ftdataChecked.delete(isin); }
  }
  syncFTDataSelectAll();
  renderFTDataPanel();
}

// ---- Fetch data for one row ----
async function loadFTDataCard(isin) {
  const btn = document.getElementById(`ftdbtn-${isin}`);
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="top10-spinner"></span>`; }
  const statusCell = document.getElementById(`ftdstatus-${isin}`);
  if (statusCell) statusCell.innerHTML = `<span class="t10-status-pending">⏳ กำลังโหลด…</span>`;

  await loadFTHoldings(isin);  // fills holdingsCache + summaryCache
  updateFTDataRowStatus(isin, holdingsCache[isin] || { status: 'error', rows: [] });

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg> รีโหลด`;
  }
}

// ---- Checkbox logic (mirrors top10) ----
function ftdataToggleRow(cb) {
  const isin = cb.dataset.isin;
  if (cb.checked) ftdataChecked.add(isin); else ftdataChecked.delete(isin);
  syncFTDataSelectAll();
  renderFTDataPanel();
}

function ftdataToggleAll(checked) {
  document.querySelectorAll('.ftdata-row-cb:not(:disabled)').forEach(cb => {
    cb.checked = checked;
    const isin = cb.dataset.isin;
    if (checked) ftdataChecked.add(isin); else ftdataChecked.delete(isin);
  });
  renderFTDataPanel();
}

function syncFTDataSelectAll() {
  const all  = document.querySelectorAll('.ftdata-row-cb:not(:disabled)');
  const allCb= document.getElementById('ftdata-select-all-cb');
  if (!allCb || all.length === 0) return;
  const n = [...all].filter(cb => cb.checked).length;
  allCb.indeterminate = n > 0 && n < all.length;
  allCb.checked = n === all.length;
}

// ---- Render detail panel (full FT card per checked ISIN) ----
function renderFTDataPanel() {
  const panel   = document.getElementById('ftdata-detail-panel');
  const content = document.getElementById('ftdata-detail-content');
  if (!panel || !content) return;

  if (ftdataChecked.size === 0) {
    panel.style.display = 'none';
    content.innerHTML   = '';
    return;
  }
  panel.style.display = 'block';

  const groups = buildTop10Groups().filter(g => ftdataChecked.has(g.isin));
  content.innerHTML = '';

  groups.forEach(group => {
    const hold = holdingsCache[group.isin];
    const sum  = summaryCache[group.isin];
    if (!hold) return;

    const block = document.createElement('div');
    block.className = 'ftcard';

    const hlColor  = group.thaiCodes.map(c => highlightMap[c]).find(c => c) || null;
    const accentBg = hlColor ? (HIGHLIGHT_COLORS.find(h => h.value === hlColor)?.bg || '') : '';
    const accentStyle = accentBg ? `border-left:4px solid ${accentBg};` : '';

    // Fund name: prefer summary name
    const displayName = (sum && sum.status === 'ok' && sum.data.fundName)
      ? sum.data.fundName : group.masterName;

    let html = `
      <div class="ftcard-header" style="${accentStyle}">
        <div class="ftcard-header-left">
          <span class="ftcard-isin">${group.isin}</span>
          <span class="ftcard-master">${displayName}</span>
        </div>
        <div class="ftcard-header-right">
          <span class="ftcard-thai">${group.thaiCodes.map(c => `<span class="top10-code-tag">${c}</span>`).join('')}</span>
        </div>
      </div>`;

    // Error state
    if (hold.noGas || (hold.status !== 'ok' && (!sum || sum.status !== 'ok'))) {
      html += `<div class="ftcard-placeholder" style="color:#9ca3af;">
        ${hold.noGas ? '⚙️ กรุณาตั้งค่า GAS URL ด้านบนก่อน'
          : '⚠️ ไม่มีข้อมูล — <a href="https://markets.ft.com/data/funds/tearsheet/summary?s='+group.isin+'" target="_blank" style="color:var(--primary);">เปิดหน้า FT โดยตรง →</a>'}
      </div>`;
      block.innerHTML = html;
      content.appendChild(block);
      return;
    }

    // ---- Key facts grid ----
    if (sum && sum.status === 'ok' && sum.data) {
      const d = sum.data;
      const facts = [
        { label: 'Ongoing Charge (TER)', value: d.ter,            icon: '💰' },
        { label: 'Fund Size',            value: d.fundSize,       icon: '📊' },
        { label: 'Fund Manager',         value: d.manager,        icon: '👤' },
        { label: 'Benchmark',            value: d.benchmark,      icon: '📌' },
        { label: 'Domicile',             value: d.domicile,       icon: '🏳️' },
        { label: 'Launch Date',          value: d.inceptionDate,  icon: '📅' },
        { label: 'Currency',             value: d.currency,       icon: '💱' },
        { label: 'Fund Type',            value: d.fundType,       icon: '🏷️' },
        { label: 'Morningstar Rating',   value: d.morningstar,    icon: '⭐' },
      ].filter(f => f.value);

      if (facts.length > 0) {
        html += `<div class="ftcard-section-title">ข้อมูลกองทุน</div><div class="ftcard-facts">`;
        facts.forEach(f => {
          html += `<div class="ftcard-fact-item">
            <span class="ftcard-fact-label">${f.icon} ${f.label}</span>
            <span class="ftcard-fact-value">${f.value}</span>
          </div>`;
        });
        html += `</div>`;
      }

      // ---- Performance strip ----
      if (d.performance && Object.keys(d.performance).length > 0) {
        html += `<div class="ftcard-section-title">ผลการดำเนินงาน (%)</div><div class="ftcard-perf-row">`;
        Object.entries(d.performance).forEach(([period, ret]) => {
          const num = parseFloat(ret.replace(/[^0-9.\-+]/g, ''));
          const cls = isNaN(num) ? '' : num < 0 ? 'neg' : num > 0 ? 'pos' : '';
          html += `<div class="ftcard-perf-item">
            <span class="ft-perf-period">${period}</span>
            <span class="ft-perf-val ${cls}">${ret}</span>
          </div>`;
        });
        html += `</div>`;
      }
    }

    // ---- Top Holdings ----
    if (hold.status === 'ok' && hold.rows.length > 0) {
      const maxW  = Math.max(...hold.rows.map(r => r.weight));
      const total = hold.rows.reduce((s, r) => s + r.weight, 0);
      html += `<div class="ftcard-section-title">Top ${hold.rows.length} Holdings</div>
      <table class="ftcard-holdings-table">
        <thead><tr>
          <th style="width:26px;">#</th>
          <th style="text-align:left;">บริษัท / หุ้น</th>
          <th style="width:68px;">น้ำหนัก</th>
          <th style="min-width:120px;">สัดส่วน</th>
        </tr></thead>
        <tbody>`;
      hold.rows.forEach((r, i) => {
        const barW = Math.round((r.weight / maxW) * 100);
        html += `<tr>
          <td class="top10-rank">${i + 1}</td>
          <td class="top10-name">${r.name}</td>
          <td class="top10-weight">${r.weight.toFixed(2)}%</td>
          <td class="top10-bar-cell"><div class="top10-bar" style="width:${barW}%"></div></td>
        </tr>`;
      });
      html += `</tbody>
        <tfoot><tr>
          <td colspan="2" style="text-align:right;font-size:11px;color:var(--text-sub);padding:5px 8px;">รวม Top ${hold.rows.length}</td>
          <td class="top10-weight" style="font-weight:700;color:var(--primary);">${total.toFixed(2)}%</td>
          <td></td>
        </tr></tfoot>
      </table>`;
    }

    block.innerHTML = html;
    content.appendChild(block);
  });
}

// ---- Load all in sequence ----
async function loadAllFTData() {
  const btn      = document.getElementById('btn-load-all-ft');
  const statusEl = document.getElementById('ftdata-status');
  if (btn) btn.disabled = true;

  const groups = buildTop10Groups();
  let done = 0;
  for (const g of groups) {
    if (!holdingsCache[g.isin] || holdingsCache[g.isin].status === 'error') {
      if (statusEl) statusEl.textContent = `กำลังโหลด… (${done + 1}/${groups.length})`;
      await loadFTDataCard(g.isin);
      await new Promise(r => setTimeout(r, 800));
    }
    done++;
  }
  if (statusEl) statusEl.textContent = `โหลดครบ ${done} ISIN`;
  if (btn) btn.disabled = false;
}

// แปลง master_fee.currency → FT currency code
const CURRENCY_MAP = {
  'us dollar': 'USD', 'euro': 'EUR', 'yen': 'JPY', 'japanese yen': 'JPY',
  'british pound': 'GBP', 'pound sterling': 'GBP', 'hong kong dollar': 'HKD',
  'singapore dollar': 'SGD', 'swiss franc': 'CHF', 'australian dollar': 'AUD',
  'canadian dollar': 'CAD', 'chinese yuan': 'CNY', 'yuan renminbi': 'CNH',
  'korean won': 'KRW', 'indian rupee': 'INR', 'taiwanese dollar': 'TWD',
};
function toCurrencyCode(fullName) {
  if (!fullName) return 'USD';
  return CURRENCY_MAP[fullName.toLowerCase()] || 'USD';
}

// ---- build group list from selected funds ----
function buildTop10Groups() {
  const selected = allFunds.filter(f => checkedFunds.has(f.code) && f.isin);
  const byIsin = {};
  selected.forEach(f => {
    if (!byIsin[f.isin]) {
      const currFull = f.master_fee?.currency || 'US Dollar';
      byIsin[f.isin] = {
        isin: f.isin,
        masterName: f.master_name || '—',
        currency: toCurrencyCode(currFull),
        thaiCodes: [],
      };
    }
    byIsin[f.isin].thaiCodes.push(f.code);
  });
  return Object.values(byIsin);
}

// ---- main populate ----
function populateTop10Page() {
  const noData  = document.getElementById('top10-no-data');
  const table   = document.getElementById('top10-summary-table');
  const tbody   = document.getElementById('top10-tbody');
  const statusEl = document.getElementById('top10-status');
  if (statusEl) statusEl.textContent = '';
  top10Checked.clear();
  renderDetailPanel();

  const selected = allFunds.filter(f => checkedFunds.has(f.code));
  if (selected.length === 0) {
    noData.style.display = 'block';
    table.style.display  = 'none';
    return;
  }

  const groups = buildTop10Groups();
  if (groups.length === 0) {
    noData.style.display = 'block';
    table.style.display  = 'none';
    noData.textContent   = 'กองทุนที่เลือกไม่มีข้อมูล ISIN — ไม่สามารถดึง Holdings ได้';
    return;
  }
  noData.style.display = 'none';
  table.style.display  = 'table';

  tbody.innerHTML = '';
  groups.forEach(g => {
    const tr = buildSummaryRow(g);
    tbody.appendChild(tr);
    // restore from cache
    if (holdingsCache[g.isin]) updateRowStatus(g.isin, holdingsCache[g.isin]);
  });
  syncTop10SelectAll();
}

// ---- build one table row ----
function buildSummaryRow(group) {
  const tr = document.createElement('tr');
  tr.id    = `t10row-${group.isin}`;

  // highlight accent from any of the thai codes
  const hlColor  = group.thaiCodes.map(c => highlightMap[c]).find(c => c) || null;
  const accentBg = hlColor ? (HIGHLIGHT_COLORS.find(h => h.value === hlColor)?.bg || '') : '';

  tr.innerHTML = `
    <td class="t10-isin" style="${accentBg ? 'border-left:3px solid '+accentBg+';' : ''}">
      <span class="t10-isin-txt">${group.isin}</span>
    </td>
    <td class="t10-master">${group.masterName}</td>
    <td class="t10-thai">
      ${group.thaiCodes.map(c => `<span class="top10-code-tag">${c}</span>`).join('')}
    </td>
    <td class="t10-load-cell">
      <button class="top10-load-btn" id="btn-${group.isin}" onclick="loadFTHoldings('${group.isin}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
        โหลด
      </button>
    </td>
    <td class="t10-status-cell" id="status-${group.isin}">
      <span class="t10-status-pending">— ยังไม่ได้โหลด</span>
    </td>
    <td class="t10-cb-cell">
      <input type="checkbox" class="top10-row-cb" data-isin="${group.isin}"
             onchange="top10ToggleRow(this)" style="accent-color:var(--primary);" disabled>
    </td>
  `;
  return tr;
}

// ---- update status cell after load ----
function updateRowStatus(isin, result) {
  const cell = document.getElementById(`status-${isin}`);
  const cb   = document.querySelector(`.top10-row-cb[data-isin="${isin}"]`);
  if (!cell) return;

  if (result.status === 'ok' && result.rows.length > 0) {
    cell.innerHTML = `<span class="t10-status-ok">✅ ข้อมูลพร้อมใช้งาน <span style="color:#9ca3af;font-size:10px;">(${result.rows.length} รายการ)</span></span>`;
    if (cb) { cb.disabled = false; }
  } else if (result.noGas) {
    cell.innerHTML = `<span class="t10-status-err">⚙️ กรุณาตั้งค่า Google Apps Script URL ด้านบนก่อน</span>`;
    if (cb) { cb.disabled = true; cb.checked = false; top10Checked.delete(isin); }
  } else {
    cell.innerHTML = `
      <span class="t10-status-err">
        ⚠️ ไม่สามารถดึงข้อมูลได้
        <a href="${FT_BASE}${isin}" target="_blank" class="top10-open-ft">เปิดหน้า FT โดยตรง →</a>
      </span>`;
    if (cb) { cb.disabled = true; cb.checked = false; top10Checked.delete(isin); }
  }
  syncTop10SelectAll();
  renderDetailPanel();
}

// ---- fetch from FT via Google Apps Script Web App ----
// หมายเหตุ: ฟังก์ชันนี้ถูกเรียกทั้งจากหน้า Top 10 และหน้า FT Data
// btn / statusCell อาจไม่มีใน DOM ถ้าเรียกจากหน้าอื่น → ไม่ return ออก
async function loadFTHoldings(isin) {
  const btn        = document.getElementById(`btn-${isin}`);
  const statusCell = document.getElementById(`status-${isin}`);

  if (btn) btn.disabled = true;
  if (btn) btn.innerHTML = `<span class="top10-spinner"></span>`;
  if (statusCell) statusCell.innerHTML = `<span class="t10-status-pending">⏳ กำลังโหลด…</span>`;

  // Check GAS URL is configured
  if (!gasWebAppUrl) {
    holdingsCache[isin] = { status: 'error', rows: [], noGas: true };
    summaryCache[isin]  = { status: 'error', data: {} };
    updateRowStatus(isin, holdingsCache[isin]);
    btn.disabled = false;
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg> โหลด`;
    return;
  }

  // Look up currency for this ISIN
  const grp      = buildTop10Groups().find(g => g.isin === isin);
  const currency = grp ? grp.currency : 'USD';

  // Build GAS request URL (type=both → gets holdings + summary in one call)
  const gasUrl = gasWebAppUrl
    + '?isin=' + encodeURIComponent(isin)
    + '&currency=' + encodeURIComponent(currency)
    + '&type=both';

  let json = null;
  try {
    const resp = await fetch(gasUrl, { signal: AbortSignal.timeout(30000) });
    if (resp.ok) json = await resp.json();
  } catch (_) {}

  if (json && json.holdings) {
    holdingsCache[isin] = json.holdings;
    // GAS v3: summaryHtml + nextData + jsonLd
    // GAS v2: summaryHtml only
    // GAS v1: summary (pre-parsed)
    if (json.summaryHtml !== undefined || json.nextData !== undefined) {
      summaryCache[isin] = parseFTSummary(
        json.summaryHtml || '',
        json.nextData    || '',
        json.jsonLd      || ''
      );
    } else {
      summaryCache[isin] = json.summary || { status: 'error', data: {} };
    }
  } else {
    holdingsCache[isin] = { status: 'error', rows: [] };
    summaryCache[isin]  = { status: 'error', data: {} };
  }

  updateRowStatus(isin, holdingsCache[isin]);

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg> รีโหลด`;
  }
}

// ---- parse FT summary page (browser-side) — v3: __NEXT_DATA__ priority ----
function parseFTSummary(html, nextDataStr, jsonLdStr) {
  const data = {};

  // ── Priority 1: __NEXT_DATA__ JSON (Next.js SSR — most reliable) ──────────
  if (nextDataStr) {
    try { _extractFromNextData(JSON.parse(nextDataStr), data); } catch (_) {}
  }

  // ── Priority 2: JSON-LD ────────────────────────────────────────────────────
  if (jsonLdStr && !_ftHasKeyFacts(data)) {
    try {
      const ld = JSON.parse(jsonLdStr);
      if (ld.name && !data.fundName) data.fundName = ld.name;
    } catch (_) {}
  }

  // ── Fund name from <title> (clean up) ─────────────────────────────────────
  const titleM = html.match(/<title[^>]*>([^<|]+)/i);
  if (titleM && !data.fundName) {
    const t = titleM[1]
      .replace(/\s*[-|:]\s*(USD|EUR|GBP|SGD|HKD|JPY|CNY|THB|AUD|CAD|CHF)\b.*$/i, '')
      .replace(/\s*[-|]\s*FT\.com.*$/i, '')
      .replace(/\s+summary\s*$/i, '').trim();
    if (t) data.fundName = t;
  }

  // ── HTML fallback (only if __NEXT_DATA__ didn't give key facts) ───────────
  if (!_ftHasKeyFacts(data)) {
    const pairs = [];

    // Pattern A: <dt>…</dt> … <dd>…</dd>
    const dlRe = /<dt[^>]*>([\s\S]*?)<\/dt>[\s\S]{0,300}?<dd[^>]*>([\s\S]*?)<\/dd>/gi;
    let m;
    while ((m = dlRe.exec(html)) !== null) {
      const k = _ftStrip(m[1]), v = _ftStrip(m[2]);
      if (k && v) pairs.push([k, v]);
    }

    // Pattern B: 2-cell <tr><td>Label</td><td>Value</td></tr>
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    while ((m = trRe.exec(html)) !== null) {
      const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
        .map(c => _ftStrip(c[1])).filter(Boolean);
      if (cells.length === 2) pairs.push([cells[0], cells[1]]);
    }

    // Pattern C: label/value span pairs
    const spanRe = /<span[^>]*class="[^"]*(?:label|key|title)[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]{0,200}?<span[^>]*class="[^"]*(?:value|data|content)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
    while ((m = spanRe.exec(html)) !== null) {
      const k = _ftStrip(m[1]), v = _ftStrip(m[2]);
      if (k && v) pairs.push([k, v]);
    }

    pairs.forEach(([k, v]) => _ftMapPair(k, v, data));
  }

  // ── Performance table ─────────────────────────────────────────────────────
  if (!data.performance) {
    const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    let tM;
    while ((tM = tableRe.exec(html)) !== null) {
      const tbl = tM[0];
      if (!/1\s*(?:month|mth|mo)|ytd|1\s*(?:yr|year)/i.test(tbl)) continue;
      // Skip holdings-style tables (has "Portfolio weight" or "Company" header)
      if (/portfolio\s*weight/i.test(tbl)) continue;
      const headers = [...tbl.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
        .map(h => _ftStrip(h[1])).filter(Boolean);
      // Performance tables never have "COMPANY" as a header — skip if they do
      if (headers.some(h => /^company$/i.test(h.trim()))) continue;
      if (!headers.length) continue;
      const rows = [...tbl.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      for (const row of rows) {
        const cells = [...row[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
          .map(c => _ftStrip(c[1]));
        if (cells.length < 2) continue;
        if (/benchmark/i.test(cells[0])) continue;
        if (!cells.slice(1).some(c => /[-\d]/.test(c))) continue;
        const perf = {};
        headers.forEach((h, i) => {
          const norm = _normPeriod(h);
          if (norm && cells[i + 1] != null && cells[i + 1] !== '') perf[norm] = cells[i + 1];
        });
        if (Object.keys(perf).length > 0) { data.performance = perf; break; }
      }
      if (data.performance) break;
    }
  }

  const hasData = data.manager || data.ter || data.fundSize || data.benchmark
               || data.performance || data.fundName || data.domicile;
  return hasData ? { status: 'ok', data } : { status: 'error', data: {} };
}

// Extract key facts from __NEXT_DATA__ (Next.js SSR JSON) — recursive search
function _extractFromNextData(nd, data) {
  function search(obj, depth) {
    if (!obj || typeof obj !== 'object' || depth > 8) return;
    if (Array.isArray(obj)) { obj.forEach(x => search(x, depth + 1)); return; }
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (!val || typeof val === 'object') { search(val, depth + 1); continue; }
      const vs = String(val).trim();
      if (!vs || vs === 'null' || vs === 'undefined') continue;
      if (/^(ongoingcharge|ter|totalexpense|annualcharge)$/i.test(key) && !data.ter) data.ter = vs;
      else if (/^(manager|fundmanager|investmentmanager|managedby)$/i.test(key) && !data.manager) data.manager = vs;
      else if (/^(fundsize|netassets|totalnetassets|aum)$/i.test(key) && !data.fundSize) data.fundSize = vs;
      else if (/^(benchmark|benchmarkname)$/i.test(key) && !data.benchmark) data.benchmark = vs;
      else if (/^(inceptiondate|launchdate)$/i.test(key) && !data.inceptionDate) data.inceptionDate = vs;
      else if (/^(currency)$/i.test(key) && !data.currency) data.currency = vs;
      else if (/^(domicile)$/i.test(key) && !data.domicile) data.domicile = vs;
      else if (/^(morningstarrating|starrating)$/i.test(key) && !data.morningstar) data.morningstar = vs;
      else if (/^(fundtype|structure|legalstructure)$/i.test(key) && !data.fundType) data.fundType = vs;
      else if (/^(name|fundname|title)$/i.test(key) && !data.fundName && vs.length > 3 && !/^\d/.test(vs)) data.fundName = vs;
    }
  }
  search(nd, 0);
}

// Normalize performance period label to short form
function _normPeriod(h) {
  if (!h) return h;
  const s = h.toLowerCase().trim();
  if (/^ytd$/i.test(s)) return 'YTD';
  if (/1\s*(mo|mth|month)/i.test(s)) return '1M';
  if (/3\s*(mo|mth|month)/i.test(s)) return '3M';
  if (/6\s*(mo|mth|month)/i.test(s)) return '6M';
  if (/1\s*(yr|year)/i.test(s)) return '1Y';
  if (/3\s*(yr|year)/i.test(s)) return '3Y';
  if (/5\s*(yr|year)/i.test(s)) return '5Y';
  if (/10\s*(yr|year)/i.test(s)) return '10Y';
  return h;
}

// Does data already have the key facts we care about?
function _ftHasKeyFacts(data) {
  return !!(data.manager || data.ter || data.fundSize || data.benchmark);
}

// strip HTML + collapse whitespace, treat "—"/"-"/"n/a" as empty
function _ftStrip(s) {
  return (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    .replace(/^[-—n\/aNA\s]*$/i, '') || '';
}

// map one key/value pair to data fields (first-write-wins)
function _ftMapPair(k, v, data) {
  if (!k || !v) return;
  const kl = k.toLowerCase();
  if      (/manager|investment manager|fund manager|managed by/i.test(kl) && !data.manager)
    data.manager      = v;
  else if (/ongoing charge|annual charge|\bter\b|total expense/i.test(kl) && !data.ter)
    data.ter          = v;
  else if (/net asset|fund size|total net assets|\baum\b/i.test(kl) && !data.fundSize)
    data.fundSize     = v;
  else if (/^benchmark$/i.test(kl.trim()) && !data.benchmark)
    data.benchmark    = v;
  else if (/inception|launch date/i.test(kl) && !data.inceptionDate)
    data.inceptionDate= v;
  else if (/^currency$/i.test(kl.trim()) && !data.currency)
    data.currency     = v;
  else if (/domicile/i.test(kl) && !data.domicile)
    data.domicile     = v;
  else if (/morningstar/i.test(kl) && !data.morningstar)
    data.morningstar  = v;
  else if (/fund type|structure/i.test(kl) && !data.fundType)
    data.fundType     = v;
}

// ---- helper: one summary stat cell ----
function ftStatItem(label, value) {
  return `<div class="ft-stat-item"><span class="ft-stat-label">${label}</span><span class="ft-stat-value">${value}</span></div>`;
}

// ---- parse FT HTML (same logic as Apps Script) ----
function parseFTHoldings(html) {
  const tableMatches = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)];
  let targetTable = '';
  for (const m of tableMatches) {
    if (m[0].toLowerCase().includes('company') && m[0].includes('Portfolio weight')) {
      targetTable = m[0]; break;
    }
  }
  if (!targetTable) return { status: 'error', rows: [] };

  const rows = [];
  for (const tr of targetTable.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const tds = [...tr[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (tds.length >= 3) {
      const name   = tds[0][0].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      const weight = tds[2][0].replace(/<[^>]*>/g, '').trim();
      if (name && weight && /\d/.test(weight)) {
        const w = parseFloat(weight.replace(/%/g, '').replace(/,/g, ''));
        if (!isNaN(w)) rows.push({ name, weight: w });
      }
    }
    if (rows.length >= 10) break;
  }
  return rows.length > 0 ? { status: 'ok', rows } : { status: 'error', rows: [] };
}

// ---- checkbox logic ----
function top10ToggleRow(cb) {
  const isin = cb.dataset.isin;
  if (cb.checked) top10Checked.add(isin); else top10Checked.delete(isin);
  syncTop10SelectAll();
  renderDetailPanel();
}

function top10ToggleAll(checked) {
  document.querySelectorAll('.top10-row-cb:not(:disabled)').forEach(cb => {
    cb.checked = checked;
    const isin = cb.dataset.isin;
    if (checked) top10Checked.add(isin); else top10Checked.delete(isin);
  });
  renderDetailPanel();
}

function syncTop10SelectAll() {
  const all  = document.querySelectorAll('.top10-row-cb:not(:disabled)');
  const allCb = document.getElementById('top10-select-all-cb');
  if (!allCb || all.length === 0) return;
  const checkedCount = [...all].filter(cb => cb.checked).length;
  allCb.indeterminate = checkedCount > 0 && checkedCount < all.length;
  allCb.checked = checkedCount === all.length;
}

// ---- render detail panel for checked ISINs ----
function renderDetailPanel() {
  const panel   = document.getElementById('top10-detail-panel');
  const content = document.getElementById('top10-detail-content');
  if (!panel || !content) return;

  if (top10Checked.size === 0) {
    panel.style.display = 'none';
    content.innerHTML   = '';
    return;
  }
  panel.style.display = 'block';

  const groups = buildTop10Groups().filter(g => top10Checked.has(g.isin));
  content.innerHTML = '';

  groups.forEach(group => {
    const holdResult = holdingsCache[group.isin];
    const sumResult  = summaryCache[group.isin];
    if (!holdResult || holdResult.status !== 'ok') return;

    const block = document.createElement('div');
    block.className = 'top10-detail-block';

    // ---- Title ----
    let html = `
      <div class="top10-detail-block-title">
        <strong>${group.isin}</strong>
        <span style="color:var(--text-sub);font-size:11px;font-weight:400;">${group.masterName}</span>
      </div>`;

    // ---- FT Summary stats (if available) ----
    if (sumResult && sumResult.status === 'ok') {
      const d = sumResult.data;
      const statsHtml = [
        d.ter          && ftStatItem('Ongoing Charge', d.ter),
        d.fundSize     && ftStatItem('Fund Size', d.fundSize),
        d.manager      && ftStatItem('Manager', d.manager),
        d.benchmark    && ftStatItem('Benchmark', d.benchmark),
        d.inceptionDate&& ftStatItem('Launch Date', d.inceptionDate),
        d.domicile     && ftStatItem('Domicile', d.domicile),
        d.currency     && ftStatItem('Currency', d.currency),
        d.morningstar  && ftStatItem('Morningstar', d.morningstar),
        d.fundType     && ftStatItem('Fund Type', d.fundType),
      ].filter(Boolean).join('');

      if (statsHtml) {
        html += `<div class="ft-summary-grid">${statsHtml}</div>`;
      }

      // Performance strip
      if (d.performance && Object.keys(d.performance).length > 0) {
        const perfCells = Object.entries(d.performance).map(([period, ret]) => {
          const num = parseFloat(ret.replace(/[^0-9.\-+]/g, ''));
          const cls = isNaN(num) ? '' : num < 0 ? 'neg' : num > 0 ? 'pos' : '';
          return `<div class="ft-perf-item"><span class="ft-perf-period">${period}</span><span class="ft-perf-val ${cls}">${ret}</span></div>`;
        }).join('');
        html += `<div class="ft-perf-section"><span class="ft-section-label">ผลการดำเนินงาน (%)</span><div class="ft-perf-row">${perfCells}</div></div>`;
      }
    }

    // ---- Holdings table ----
    const totalWeight = holdResult.rows.reduce((s, r) => s + r.weight, 0);
    const maxW = Math.max(...holdResult.rows.map(r => r.weight));

    html += `
      <div class="ft-section-label" style="padding:6px 12px 2px;">Top Holdings</div>
      <table class="top10-holdings-table">
        <thead>
          <tr>
            <th style="width:24px;">#</th>
            <th style="text-align:left;">บริษัท / หุ้น</th>
            <th style="width:70px;">น้ำหนัก (%)</th>
            <th style="width:100px;">สัดส่วน</th>
          </tr>
        </thead>
        <tbody>`;

    holdResult.rows.forEach((r, i) => {
      const barW = Math.round((r.weight / maxW) * 100);
      html += `
        <tr>
          <td class="top10-rank">${i + 1}</td>
          <td class="top10-name">${r.name}</td>
          <td class="top10-weight">${r.weight.toFixed(2)}%</td>
          <td class="top10-bar-cell"><div class="top10-bar" style="width:${barW}%"></div></td>
        </tr>`;
    });

    html += `
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="text-align:right;font-size:11px;color:var(--text-sub);padding:5px 8px;">รวม Top ${holdResult.rows.length}</td>
            <td class="top10-weight" style="font-weight:700;color:var(--primary);">${totalWeight.toFixed(2)}%</td>
            <td></td>
          </tr>
        </tfoot>
      </table>`;

    block.innerHTML = html;
    content.appendChild(block);
  });
}

// ---- load all in sequence ----
async function loadAllHoldings() {
  const btn = document.getElementById('btn-load-all');
  const statusEl = document.getElementById('top10-status');
  if (btn) btn.disabled = true;

  const groups = buildTop10Groups();
  let done = 0;
  for (const g of groups) {
    if (!holdingsCache[g.isin] || holdingsCache[g.isin].status === 'error') {
      if (statusEl) statusEl.textContent = `กำลังโหลด… (${done + 1}/${groups.length})`;
      await loadFTHoldings(g.isin);
      await new Promise(r => setTimeout(r, 800));
    }
    done++;
  }
  if (statusEl) statusEl.textContent = `โหลดครบ ${done} ISIN`;
  if (btn) btn.disabled = false;
}

// ===== ETF BAR =====
function toggleEtfBar() {
  const bar = document.getElementById('etf-bar');
  bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
}

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', initApp);
