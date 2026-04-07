// app.js - Zapier data + Xano edit-key for login (full replacement)
// Configure via window.APP_CONFIG or sessionStorage:
// ZAPIER_TABLE_GET_URL, ZAPIER_TABLE_PATCH_URL, ZAPIER_CATCH_HOOK_URL (optional),
// ZAPIER_CONFIG_GET_URL (optional), and XANO_BASE_URL/XANO_CONFIG_PATH if needed.

// -------------------------
// Config helpers (Zapier + misc)
// -------------------------
function _getCfg(key) {
  try {
    if (typeof window !== "undefined" && window.APP_CONFIG && window.APP_CONFIG[key]) {
      const v = String(window.APP_CONFIG[key] || "").trim();
      if (v) return v;
    }
  } catch (e) {}
  try {
    const s = sessionStorage.getItem(key);
    if (s && String(s).trim()) return String(s).trim();
  } catch (e) {}
  return null;
}
function getZapierTableGetUrl() { return _getCfg("ZAPIER_TABLE_GET_URL"); }
function setZapierTableGetUrlForSession(url) { try { if (!url) sessionStorage.removeItem("ZAPIER_TABLE_GET_URL"); else sessionStorage.setItem("ZAPIER_TABLE_GET_URL", String(url).trim()); } catch (e) {} }
function getZapierTablePatchUrl() { return _getCfg("ZAPIER_TABLE_PATCH_URL"); }
function setZapierTablePatchUrlForSession(url) { try { if (!url) sessionStorage.removeItem("ZAPIER_TABLE_PATCH_URL"); else sessionStorage.setItem("ZAPIER_TABLE_PATCH_URL", String(url).trim()); } catch (e) {} }
function getZapierHook() { return _getCfg("ZAPIER_CATCH_HOOK_URL"); }
function setZapierHookForSession(url) { try { if (!url) sessionStorage.removeItem("ZAPIER_CATCH_HOOK_URL"); else sessionStorage.setItem("ZAPIER_CATCH_HOOK_URL", String(url).trim()); } catch (e) {} }
function getZapierConfigGetUrl() { return _getCfg("ZAPIER_CONFIG_GET_URL"); }
function setZapierConfigGetUrlForSession(url) { try { if (!url) sessionStorage.removeItem("ZAPIER_CONFIG_GET_URL"); else sessionStorage.setItem("ZAPIER_CONFIG_GET_URL", String(url).trim()); } catch (e) {} }

// -------------------------
// Xano config (for edit-key only)
// -------------------------
const XANO_BASE_URL = "https://x8ki-letl-twmt.n7.xano.io/api:ZvixoXZ8";
const XANO_CONFIG_PATH = "/app_config";
const SESSION_KEY = "cmd.editKey.v1";

// Minimal Xano fetch helper (only used for config)
async function xanoFetch(pathOrUrl, { method = "GET", body = null } = {}) {
  const url = String(pathOrUrl || "");
  const full = url.match(/^https?:\/\//) ? url : `${XANO_BASE_URL}${pathOrUrl}`;
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== null && body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(full, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Xano error ${res.status}: ${text || res.statusText}`);
  }
  return await res.json();
}

// -------------------------
// Metrics config + fields
// -------------------------
const METRIC_FIELDS = [
  { key: "domain_authority", label: "Authority Score", format: "int" },
  { key: "number_of_referring_domains", label: "Referring Domains", format: "int" },
  { key: "number_of_organic_keywords", label: "Organic Keywords", format: "int" },
  { key: "organic_traffic", label: "Organic Traffic (est.)", format: "int" },
  { key: "instagram_followers", label: "Instagram Followers", format: "int" },
  { key: "posts_images", label: "Posts / month — Images", format: "int" },
  { key: "posts_reels", label: "Posts / month — Reels", format: "int" },
  { key: "posts_total", label: "Posts / month — Total", format: "int", readOnly: true },
  { key: "engagement_total", label: "Engagements / month — Total", format: "int" },
  { key: "engagement_rate_percentage", label: "Engagement rate %", format: "float" },
  { key: "agency_fee_one_child_weekly", label: "Agency Fee (1 child) / week", format: "int" },
  { key: "agency_fee_one_child_yearly", label: "Agency Fee (1 child) / year", format: "int" },
  { key: "meta_ads_running", label: "Meta Ads Running", format: "int" },
  { key: "monthly_press_coverage", label: "Monthly Press Coverage", format: "richtext", editable: true }
];
const NOTES_FIELD_KEY = "notes";

const CHART_METRICS = [
  { key: "domain_authority", label: "Authority Score" },
  { key: "number_of_referring_domains", label: "Referring Domains" },
  { key: "number_of_organic_keywords", label: "Organic Keywords" },
  { key: "organic_traffic", label: "Organic Traffic (est.)" },
  { key: "instagram_followers", label: "Instagram Followers" },
  { key: "agency_fee_one_child_weekly", label: "Agency Fee / week" },
  { key: "agency_fee_one_child_yearly", label: "Agency Fee / year" },
  { key: "meta_ads_running", label: "Meta Ads Running" },
  { key: "number_of_monthly_instagram_posts", label: "Posts / month (Total)" },
  { key: "monthly_instagram_engagement", label: "Engagements / month (Total)" }
];

// -------------------------
// Month helpers
// -------------------------
const MONTHS = { january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07", august: "08", september: "09", october: "10", november: "11", december: "12" };
const MONTH_LABELS = [
  { name: "January", value: "01" }, { name: "February", value: "02" }, { name: "March", value: "03" },
  { name: "April", value: "04" }, { name: "May", value: "05" }, { name: "June", value: "06" },
  { name: "July", value: "07" }, { name: "August", value: "08" }, { name: "September", value: "09" },
  { name: "October", value: "10" }, { name: "November", value: "11" }, { name: "December", value: "12" }
];

function monthKeyFromYearMonthName(year, monthName) {
  const mm = MONTHS[String(monthName || "").toLowerCase()];
  if (!mm) return null;
  return `${year}-${mm}`;
}
function monthKeyFromYYYYMMParts(year, mm) { return `${String(year).trim()}-${String(mm).padStart(2, "0")}`; }
function parseMonthKey(mk) { if (!mk || typeof mk !== "string" || mk.length < 7) return null; const [y, m] = mk.split("-"); return { year: Number(y), month: String(m).padStart(2, "0") }; }
function compareMonthKey(a, b) { return String(a).localeCompare(String(b)); }
function listMonthKeysBetween(startKey, endKey) {
  const s = parseMonthKey(startKey); const e = parseMonthKey(endKey); if (!s || !e) return [];
  const start = new Date(Date.UTC(s.year, Number(s.month) - 1, 1)); const end = new Date(Date.UTC(e.year, Number(e.month) - 1, 1));
  if (start > end) return [];
  const out = []; const cur = new Date(start);
  while (cur <= end) { out.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth()+1).padStart(2,"0")}`); cur.setUTCMonth(cur.getUTCMonth()+1); }
  return out;
}
function currentMonthKeyUTC() { const now = new Date(); return `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,"0")}`; }
function previousMonthKeyUTC(monthKey) { const p = parseMonthKey(monthKey); if (!p) return null; const dt = new Date(Date.UTC(p.year, Number(p.month)-1, 1)); dt.setUTCMonth(dt.getUTCMonth()-1); return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,"0")}`; }
function lastMonthKeyUtcYYYYMM() { return previousMonthKeyUTC(currentMonthKeyUTC()); }

// -------------------------
// Short DOM helpers + formatting
// -------------------------
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, val] of Object.entries(attrs)) {
    if (k === "className") node.className = val;
    else if (k === "text") node.textContent = val;
    else if (k === "html") node.innerHTML = val;
    else node.setAttribute(k, val);
  }
  for (const c of children) node.appendChild(c);
  return node;
}
function toNumberOrNull(v) { if (v === null || v === undefined || v === "") return null; const n = Number(v); return Number.isNaN(n) ? null : n; }
function normalizeText(v) { if (v === null || v === undefined) return null; const s = String(v).trim(); return s.length ? s : null; }
function escapeHtml(s) { return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function linkifyTextToHtml(text) { if (text === null || text === undefined) return ""; const safe = escapeHtml(String(text)); const urlRegex = /(https?:\/\/[^\s]+)/g; return safe.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`).replaceAll("\n","<br>"); }

// -------------------------
// API fetch helper
// -------------------------
async function apiFetch(url, { method = "GET", body = null, headers = {}, expectJson = true } = {}) {
  const opts = { method, headers: { ...(headers || {}) } };
  if (body !== null && body !== undefined) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
    if (!opts.headers["Content-Type"]) opts.headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  if (!expectJson) return res;
  return await res.json();
}

// -------------------------
// Zapier adapters (data)
// -------------------------
async function fetchRowsFromZapier() {
  const zapGet = getZapierTableGetUrl();
  if (!zapGet) throw new Error("Missing ZAPIER_TABLE_GET_URL. Set window.APP_CONFIG.ZAPIER_TABLE_GET_URL or sessionStorage key.");
  const rows = await apiFetch(zapGet, { method: "GET" });
  if (Array.isArray(rows)) return rows;
  if (rows && Array.isArray(rows.items)) return rows.items;
  if (rows && Array.isArray(rows.data)) return rows.data;
  if (rows && typeof rows === "object") {
    for (const k of Object.keys(rows)) if (Array.isArray(rows[k])) return rows[k];
  }
  return [];
}
async function patchRowToZapier(rowId, fields) {
  const zapPatch = getZapierTablePatchUrl();
  if (!zapPatch) throw new Error("Missing ZAPIER_TABLE_PATCH_URL. Set window.APP_CONFIG.ZAPIER_TABLE_PATCH_URL or sessionStorage key.");
  const payload = { id: rowId, fields };
  const updated = await apiFetch(zapPatch, { method: "POST", body: payload });
  return updated;
}

// -------------------------
// Fetch edit key: try Zapier config first, fallback to Xano config table
// -------------------------
async function fetchEditKeyFromXano() {
  // Try Zapier config endpoint first
  try {
    const cfgUrl = getZapierConfigGetUrl();
    if (cfgUrl) {
      const cfg = await apiFetch(cfgUrl, { method: "GET" });
      const rows = Array.isArray(cfg) ? cfg : (cfg?.items || cfg?.data || []);
      if (Array.isArray(rows)) {
        const row = rows.find(r => String(r.key || "").trim() === "EDIT_KEY");
        const value = row?.value;
        if (value !== undefined && value !== null) return String(value).trim() || null;
      }
      if (cfg && typeof cfg === "object" && cfg.EDIT_KEY !== undefined) {
        return String(cfg.EDIT_KEY || "").trim() || null;
      }
    }
  } catch (e) {
    console.warn("fetchEditKeyFromZapier failed:", e);
  }

  // Fallback to Xano config table
  try {
    const res = await xanoFetch(XANO_CONFIG_PATH, { method: "GET" });
    const rows = Array.isArray(res) ? res : (res?.items || res?.data || []);
    if (Array.isArray(rows)) {
      const row = rows.find(r => String(r.key || "").trim() === "EDIT_KEY");
      const value = row?.value;
      if (value !== undefined && value !== null) return String(value).trim() || null;
    }
    if (res && typeof res === "object" && res.EDIT_KEY !== undefined) {
      return String(res.EDIT_KEY || "").trim() || null;
    }
  } catch (e) {
    console.warn("fetchEditKeyFromXano fallback failed:", e);
  }

  return null;
}

// verify password by fetching remote edit key
async function verifyPassword(pw) {
  const actual = await fetchEditKeyFromXano();
  if (!actual) return false;
  const entered = String(pw || "").trim();
  if (!entered) return false;
  return entered === actual;
}

// -------------------------
// State and normalization
// -------------------------
const state = { visibleMonths: [], rangeStartKey: null, rangeEndKey: null, minMonthKey: null, maxMonthKey: null, selectedCompanies: new Set(), rows: [], latestMonthKey: null, lastLoadedAtUtc: null };

function getObj(root) { return root && typeof root === "object" ? root : {}; }
function readPostsImages(row) { return toNumberOrNull(getObj(row?.number_of_monthly_instagram_posts).image_graphic); }
function readPostsReels(row) { return toNumberOrNull(getObj(row?.number_of_monthly_instagram_posts).reels_video); }
function readEngagementTotal(row) { return toNumberOrNull(getObj(row?.monthly_instagram_engagement).total_engagement); }
function readEngagementRate(row) { return toNumberOrNull(getObj(row?.monthly_instagram_engagement).engagement_rate_percentage); }

function normalizeRow(row) {
  const r = { ...row };
  const feeObj = r.agency_fee_one_child;
  if (feeObj && typeof feeObj === "object") {
    r.agency_fee_one_child_weekly = toNumberOrNull(feeObj.Weekly ?? feeObj.weekly);
    r.agency_fee_one_child_yearly = toNumberOrNull(feeObj.Yearly ?? feeObj.yearly);
  }
  r.posts_images = readPostsImages(r) ?? 0;
  r.posts_reels = readPostsReels(r) ?? 0;
  r.posts_total = (toNumberOrNull(r.posts_images) || 0) + (toNumberOrNull(r.posts_reels) || 0);
  r.engagement_total = readEngagementTotal(r);
  r.engagement_rate_percentage = readEngagementRate(r);
  r.monthly_press_coverage = normalizeText(r.monthly_press_coverage);
  return r;
}
function getRowId(row) { const id = row?.id ?? row?.competitor_metrics_dashboard_id; return (id === null || id === undefined || id === "") ? null : id; }

// -------------------------
// Patch body builder
// -------------------------
function buildPatchBodyForMetric(row, fieldKey, rawNum) {
  const num = Number(rawNum);
  if (fieldKey === "agency_fee_one_child_weekly" || fieldKey === "agency_fee_one_child_yearly") {
    const rootKey = "agency_fee_one_child";
    const childKey = fieldKey === "agency_fee_one_child_weekly" ? "Weekly" : "Yearly";
    const current = (row && typeof row[rootKey] === "object" && row[rootKey]) ? row[rootKey] : {};
    return { [rootKey]: { ...current, [childKey]: Math.round(num) } };
  }
  if (fieldKey === "posts_images" || fieldKey === "posts_reels") {
    const rootKey = "number_of_monthly_instagram_posts";
    const current = (row && typeof row[rootKey] === "object" && row[rootKey]) ? row[rootKey] : {};
    const next = { ...current };
    if (fieldKey === "posts_images") next.image_graphic = Math.round(num);
    if (fieldKey === "posts_reels") next.reels_video = Math.round(num);
    const images = toNumberOrNull(next.image_graphic) ?? 0;
    const reels = toNumberOrNull(next.reels_video) ?? 0;
    next.number_of_monthly_instagram_posts_total = images + reels;
    return { [rootKey]: next };
  }
  if (fieldKey === "posts_total") return null;
  if (fieldKey === "engagement_total" || fieldKey === "engagement_rate_percentage") {
    const rootKey = "monthly_instagram_engagement";
    const current = (row && typeof row[rootKey] === "object" && row[rootKey]) ? row[rootKey] : {};
    const next = { ...current };
    if (fieldKey === "engagement_total") next.total_engagement = Math.round(num);
    if (fieldKey === "engagement_rate_percentage") next.engagement_rate_percentage = num;
    return { [rootKey]: next };
  }
  return { [fieldKey]: Math.round(num) };
}

// -------------------------
// Chart helpers + render
// -------------------------
let metricChart = null;
function ensureChartMetricOptions(force = false) {
  const sel = document.getElementById("chartMetricSelect"); if (!sel) return;
  if (force || sel.options.length === 0) {
    const prev = sel.value; sel.innerHTML = "";
    for (const m of CHART_METRICS) { const opt = document.createElement("option"); opt.value = m.key; opt.textContent = m.label; sel.appendChild(opt); }
    const want = prev && CHART_METRICS.some(x => x.key === prev) ? prev : (CHART_METRICS[0]?.key || "");
    if (want) sel.value = want;
  }
}
function destroyChart() { if (metricChart) { metricChart.destroy(); metricChart = null; } }
function getNumericMetricValue(row, metricKey) {
  if (!row) return null;
  if (metricKey === "number_of_monthly_instagram_posts") return extractPostsTotal(row.number_of_monthly_instagram_posts);
  if (metricKey === "monthly_instagram_engagement") return extractEngagementTotal(row.monthly_instagram_engagement);
  return toNumberOrNull(row[metricKey]);
}
function extractPostsTotal(obj) { if (!obj || typeof obj !== "object") return toNumberOrNull(obj); return toNumberOrNull(obj.number_of_monthly_instagram_posts_total ?? obj.Total ?? obj.total ?? obj.total_posts); }
function extractEngagementTotal(obj) { if (!obj || typeof obj !== "object") return toNumberOrNull(obj); return toNumberOrNull(obj.total_engagement ?? obj.Total ?? obj.total ?? obj.totalEngagement); }

function renderChart() {
  const canvas = document.getElementById("metricChart"); const sel = document.getElementById("chartMetricSelect"); const modeLabel = document.getElementById("chartModeLabel");
  if (!canvas || !sel || typeof Chart === "undefined") return;
  if (sel.options.length === 0) ensureChartMetricOptions(true);
  const metricKey = sel.value; if (!metricKey) return;
  const metricLabel = CHART_METRICS.find(m => m.key === metricKey)?.label || metricKey;
  const visibleMonths = state.visibleMonths.length ? state.visibleMonths : (state.latestMonthKey ? [state.latestMonthKey] : []);
  if (!visibleMonths.length) return;
  const singleMonth = visibleMonths.length === 1;
  const companies = uniqueCompanies(state.rows).filter(c => state.selectedCompanies.has(c));
  if (modeLabel) modeLabel.textContent = singleMonth ? `(Bar • ${visibleMonths[0]})` : `(Line • ${visibleMonths[0]} → ${visibleMonths[visibleMonths.length-1]})`;
  destroyChart();
  if (singleMonth) {
    const mk = visibleMonths[0];
    const values = companies.map(c => getNumericMetricValue(findRowByCompanyAndMonth(c, mk), metricKey) ?? 0);
    const colors = companies.map((c,i)=>`hsl(${(i*47)%360},70%,45%)`);
    metricChart = new Chart(canvas, { type: "bar", data: { labels: companies, datasets: [{ label: metricLabel, data: values, backgroundColor: colors }] }, options: { responsive:true, plugins:{legend:{display:true}}, scales:{ y:{ beginAtZero:true } } } });
  } else {
    const datasets = companies.map((c,i)=>({ label:c, data: visibleMonths.map(mk=>getNumericMetricValue(findRowByCompanyAndMonth(c,mk), metricKey) ?? 0), tension:0.25, borderColor:`hsl(${(i*47)%360},70%,45%)`, backgroundColor:`hsl(${(i*47)%360},70%,45%)` }));
    metricChart = new Chart(canvas, { type:"line", data:{ labels: visibleMonths, datasets }, options:{ responsive:true, plugins:{legend:{display:true}}, scales:{ y:{ beginAtZero:true } } } });
  }
}

// -------------------------
// Table rendering + UI
// -------------------------
function uniqueCompanies(rows) { const set = new Set(rows.map(r => normalizeCompanyName(r.company)).filter(Boolean)); return Array.from(set).sort(companySort); }
function normalizeCompanyName(name) { return String(name || "").trim(); }
function companySort(a,b){ const aa=normalizeCompanyName(a), bb=normalizeCompanyName(b); const aIsSwiis = aa.toLowerCase()==="swiis"; const bIsSwiis = bb.toLowerCase()==="swiis"; if (aIsSwiis && !bIsSwiis) return -1; if (!aIsSwiis && bIsSwiis) return 1; return aa.localeCompare(bb); }
function companyColor(company){ const key = normalizeCompanyName(company).toLowerCase(); const preset = { swiis:"#ef5d2f", capstone:"#0d66a2", compass:"#1897d3", fca:"#f27a30", nfa:"#f9ae42", "orange grove":"#51277d", orangegrove:"#51277d", tact:"#b22288" }; if (preset[key]) return preset[key]; let hash=0; for (let i=0;i<key.length;i++) hash=(hash*31+key.charCodeAt(i))>>>0; return `hsl(${hash%360},70%,45%)`; }

function buildMetricsTable(visibleMonths, companies) {
  const table = el("table"); const thead = el("thead"); const trh = el("tr");
  trh.appendChild(el("th",{text:"Company"})); trh.appendChild(el("th",{text:"Month(s)"}));
  for (const f of METRIC_FIELDS) trh.appendChild(el("th",{text:f.label})); trh.appendChild(el("th",{text:"Notes"}));
  thead.appendChild(trh); table.appendChild(thead);
  const tbody = el("tbody"); const singleMonth = visibleMonths.length===1;
  for (const companyName of companies) {
    const tr = el("tr"); tr.appendChild(el("td",{text:companyName})); tr.appendChild(el("td",{text: singleMonth?visibleMonths[0]:`${visibleMonths.length} months`}));
    for (const f of METRIC_FIELDS) {
      let displayValue=null, editTargetRow=null, editMonthKey=null;
      if (singleMonth) { editMonthKey = visibleMonths[0]; editTargetRow = findRowByCompanyAndMonth(companyName, editMonthKey); displayValue = editTargetRow ? editTargetRow[f.key] : null; }
      else { displayValue = (f.format==="int"||f.format==="float") ? averageNumericForCompanyAcrossMonths(companyName, visibleMonths, f.key) : null; }
      const td = el("td");
      if (f.format==="richtext") {
        const html = displayValue ? linkifyTextToHtml(displayValue) : "—";
        const div = el("div",{ className:`clickable-metric metrics-rich${(!displayValue?" muted-cell":"")}`, html, title: singleMonth ? "Click to edit" : "Shown only in single-month view" });
        if (singleMonth && editTargetRow && f.editable) div.addEventListener("click",(e)=>{ if (e.target && e.target.closest && e.target.closest("a")) return; openEditTextModal({ row: editTargetRow, fieldKey: f.key, fieldLabel: f.label, currentValue: editTargetRow[f.key], monthKey: editMonthKey }); });
        td.appendChild(div); tr.appendChild(td); continue;
      }
      const isEmpty = displayValue===null || displayValue===undefined || displayValue==="";
      const span = el("span",{ className:`clickable-metric metrics-num${isEmpty?" muted-cell":""}`, text: formatValue(displayValue,f.format), title: singleMonth ? (f.readOnly ? "Derived (edit Images/Reels)" : "Click to edit") : "Averaged across selected months" });
      if (singleMonth && editTargetRow && !f.readOnly) span.addEventListener("click",()=>openEditMetricModal({ row: editTargetRow, fieldKey: f.key, fieldLabel: f.label, currentValue: editTargetRow[f.key], monthKey: editMonthKey }));
      td.appendChild(span); tr.appendChild(td);
    }
    const notesTd = el("td"); let notesRow=null, mk=null; if (singleMonth) { mk=visibleMonths[0]; notesRow=findRowByCompanyAndMonth(companyName,mk); }
    const notesText = singleMonth ? (notesRow?.[NOTES_FIELD_KEY] ?? "") : ""; const notesPreview = normalizeText(notesText) ? linkifyTextToHtml(notesText) : "—";
    const notesDiv = el("div",{ className:`clickable-metric metrics-rich${(normalizeText(notesText)?"":" muted-cell")}`, html: notesPreview, title: singleMonth ? "Click to edit notes" : "Switch to a single month to edit notes" });
    if (singleMonth && notesRow) notesDiv.addEventListener("click",(e)=>{ if (e.target && e.target.closest && e.target.closest("a")) return; openEditNotesModal({ row: notesRow, monthKey: mk }); });
    notesTd.appendChild(notesDiv); tr.appendChild(notesTd); tbody.appendChild(tr);
  }
  table.appendChild(tbody); return table;
}

function formatValue(v, format) {
  if (v === null || v === undefined || v === "") return "—";
  if (format === "int") { const n = Number(v); if (!Number.isFinite(n)) return "—"; return Math.round(n).toLocaleString(); }
  if (format === "float") { const n = Number(v); if (!Number.isFinite(n)) return "—"; const fixed = n.toFixed(2); return fixed.replace(/\.00$/,"").replace(/(\.\d)0$/,"$1"); }
  return String(v);
}

// -------------------------
// Modals & editing wiring
// -------------------------
let editModalState=null, editTextModalState=null, editNotesModalState=null;
function openEditMetricModal({ row, fieldKey, fieldLabel, currentValue, monthKey }) {
  editModalState = { row, fieldKey, monthKey }; const backdrop = document.getElementById("editMetricModalBackdrop"); if (!backdrop) return;
  document.getElementById("editMetricSubtitle").textContent = `${row.company} • ${monthKey} • ${fieldLabel}`; document.getElementById("editMetricHint").textContent = "This updates the value in Zapier Table.";
  const input = document.getElementById("editMetricNewValue"); if (input) input.value = (currentValue===null||currentValue===undefined) ? "" : String(currentValue);
  backdrop.style.display="flex"; backdrop.setAttribute("aria-hidden","false"); setTimeout(()=>input&&input.focus(),0);
}
function closeEditMetricModal(){ const b=document.getElementById("editMetricModalBackdrop"); if(!b) return; b.style.display="none"; b.setAttribute("aria-hidden","true"); editModalState=null; }
function openEditTextModal({ row, fieldKey, fieldLabel, currentValue, monthKey }) { editTextModalState={row,fieldKey,monthKey}; const backdrop=document.getElementById("editTextModalBackdrop"); if(!backdrop) return; document.getElementById("editTextSubtitle").textContent=`${row.company} • ${monthKey} • ${fieldLabel}`; document.getElementById("editTextHint").textContent="Multiple lines supported. Ctrl+Enter saves."; const ta=document.getElementById("editTextNewValue"); if(ta) ta.value=(currentValue===null||currentValue===undefined)?"":String(currentValue); document.getElementById("editTextUpdate").dataset.mode="press"; backdrop.style.display="flex"; backdrop.setAttribute("aria-hidden","false"); setTimeout(()=>ta&&ta.focus(),0); }
function openEditNotesModal({ row, monthKey }) { editNotesModalState={row,monthKey}; const backdrop=document.getElementById("editTextModalBackdrop"); if(!backdrop) return; document.getElementById("editTextSubtitle").textContent=`${row.company} • ${monthKey} • Notes`; document.getElementById("editTextHint").textContent="Edit notes (multi-line). Ctrl+Enter saves."; const ta=document.getElementById("editTextNewValue"); if(ta) ta.value=row?.[NOTES_FIELD_KEY]??""; document.getElementById("editTextUpdate").dataset.mode="notes"; backdrop.style.display="flex"; backdrop.setAttribute("aria-hidden","false"); setTimeout(()=>ta&&ta.focus(),0); }
function closeEditTextModal(){ const b=document.getElementById("editTextModalBackdrop"); if(!b) return; b.style.display="none"; b.setAttribute("aria-hidden","true"); editTextModalState=null; editNotesModalState=null; document.getElementById("editTextUpdate").dataset.mode=""; }

function wireEditModals() {
  const closeM=document.getElementById("editMetricClose"); if(closeM) closeM.addEventListener("click",closeEditMetricModal);
  const backM=document.getElementById("editMetricModalBackdrop"); if(backM) backM.addEventListener("click",(e)=>{ if(e.target.id==="editMetricModalBackdrop") closeEditMetricModal(); });
  const closeT=document.getElementById("editTextClose"); if(closeT) closeT.addEventListener("click",closeEditTextModal);
  const backT=document.getElementById("editTextModalBackdrop"); if(backT) backT.addEventListener("click",(e)=>{ if(e.target.id==="editTextModalBackdrop") closeEditTextModal(); });

  const metricInput=document.getElementById("editMetricNewValue"); if(metricInput) metricInput.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); document.getElementById("editMetricUpdate").click(); }});
  const textInput=document.getElementById("editTextNewValue"); if(textInput) textInput.addEventListener("keydown",(e)=>{ if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); document.getElementById("editTextUpdate").click(); }});

  const metricUpdate=document.getElementById("editMetricUpdate"); if(metricUpdate) metricUpdate.addEventListener("click", async ()=>{
    if(!editModalState) return; const btn=metricUpdate; const raw=(document.getElementById("editMetricNewValue")||{}).value;
    if(raw===""||raw===null||raw===undefined) return alert("Enter a value."); const num=Number(raw); if(!Number.isFinite(num)) return alert("Please enter a valid number.");
    const { row, fieldKey } = editModalState; const rowId=getRowId(row); if(!rowId) return alert("Missing record id.");
    try { btn.disabled=true; btn.textContent="Saving..."; const body = buildPatchBodyForMetric(row, fieldKey, num); if(!body){ alert("Total is derived. Edit Images or Reels."); return; } await patchRowToZapier(rowId, body); closeEditMetricModal(); await reloadFromZapierAndRefresh(); } catch(err){ alert("Save failed: "+String(err?.message||err)); } finally { btn.disabled=false; btn.textContent="Update"; }
  });

  const textUpdate=document.getElementById("editTextUpdate"); if(textUpdate) textUpdate.addEventListener("click", async ()=>{
    const mode=textUpdate.dataset.mode||""; const btn=textUpdate; const val=(document.getElementById("editTextNewValue")||{}).value; const payloadVal=(val===""?null:val);
    try { btn.disabled=true; btn.textContent="Saving..."; if(mode==="press"){ const row=editTextModalState?.row; const rowId=getRowId(row); if(!rowId) return alert("Missing record id."); await patchRowToZapier(rowId, { monthly_press_coverage: payloadVal }); closeEditTextModal(); await reloadFromZapierAndRefresh(); return; } if(mode==="notes"){ const row=editNotesModalState?.row; const rowId=getRowId(row); if(!rowId) return alert("Missing record id."); await patchRowToZapier(rowId, { [NOTES_FIELD_KEY]: payloadVal }); closeEditTextModal(); await reloadFromZapierAndRefresh(); return; } } catch(err){ alert("Save failed: "+String(err?.message||err)); } finally { btn.disabled=false; btn.textContent="Update"; }
  });

  window.addEventListener("keydown",(e)=>{ if(e.key!=="Escape") return; if(editModalState) closeEditMetricModal(); if(editTextModalState||editNotesModalState) closeEditTextModal(); });
}

// -------------------------
// Averaging util
// -------------------------
function averageNumericForCompanyAcrossMonths(companyName, monthKeys, fieldKey) {
  const vals = monthKeys.map(mk => findRowByCompanyAndMonth(companyName, mk)).map(r => {
    if (!r) return null;
    if (fieldKey === "number_of_monthly_instagram_posts") return extractPostsTotal(r.number_of_monthly_instagram_posts);
    if (fieldKey === "monthly_instagram_engagement") return extractEngagementTotal(r.monthly_instagram_engagement);
    return toNumberOrNull(r[fieldKey]);
  }).filter(v => v !== null);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
}

// -------------------------
// Last updated + download UI
// -------------------------
function formatUtcTimestamp(dt) { const yyyy=dt.getUTCFullYear(), mm=String(dt.getUTCMonth()+1).padStart(2,"0"), dd=String(dt.getUTCDate()).padStart(2,"0"); const hh=String(dt.getUTCHours()).padStart(2,"0"), mi=String(dt.getUTCMinutes()).padStart(2,"0"), ss=String(dt.getUTCSeconds()).padStart(2,"0"); return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} UTC`; }
function setLastUpdatedAtText(){ const el=document.getElementById("lastUpdatedAt"); if(!el) return; el.textContent = state.lastLoadedAtUtc ? `Last updated: ${formatUtcTimestamp(state.lastLoadedAtUtc)}` : ""; }
function downloadDataUrl(filename,dataUrl){ const a=document.createElement("a"); a.href=dataUrl; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); }
function downloadChartAs(type){ const canvas=document.getElementById("metricChart"); if(!canvas) return alert("Chart not found."); const ext = type==="image/jpeg"?"jpg":"png"; const dataUrl = canvas.toDataURL(type,0.92); downloadDataUrl(`chart.${ext}`, dataUrl); }
function downloadChartPdfViaPrint(){ const canvas=document.getElementById("metricChart"); if(!canvas) return alert("Chart not found."); const img = canvas.toDataURL("image/png"); const w = window.open("","_blank"); if(!w) return alert("Popup blocked"); w.document.open(); w.document.write(`<!doctype html><html><head><title>Chart</title><style>body{margin:0;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto;}img{max-width:100%;height:auto}.hint{margin-top:12px;opacity:0.7;font-size:12px;}</style></head><body><img src="${img}" /><div class="hint">Use Print (Ctrl+P) and Save as PDF.</div></body></html>`); w.document.close(); w.focus(); }
function wireChartDownloadButtons(){ const pngBtn=document.getElementById("downloadChartPng"), jpgBtn=document.getElementById("downloadChartJpg"), pdfBtn=document.getElementById("downloadChartPdf"); if(pngBtn) pngBtn.addEventListener("click",()=>downloadChartAs("image/png")); if(jpgBtn) jpgBtn.addEventListener("click",()=>downloadChartAs("image/jpeg")); if(pdfBtn) pdfBtn.addEventListener("click", downloadChartPdfViaPrint); }

// -------------------------
// Refresh / reload
// -------------------------
function refresh() {
  const mount=document.getElementById("metricsDisplay"); if(!mount) return; mount.innerHTML="";
  if (!state.latestMonthKey) { mount.appendChild(el("p",{className:"muted", text:"No data found in Zapier Table."})); destroyChart(); return; }
  const visibleMonths = state.visibleMonths.length ? state.visibleMonths : [state.latestMonthKey];
  const selected = uniqueCompanies(state.rows).filter(c => state.selectedCompanies.has(c));
  const lastEl = document.getElementById("lastUpdated"); if(lastEl) lastEl.textContent = `Loaded from Zapier Table. Latest month: ${state.latestMonthKey}. Viewing: ${visibleMonths.join(", ")}.`; setLastUpdatedAtText();
  if (!selected.length) { mount.appendChild(el("p",{className:"muted", text:"No companies selected."})); destroyChart(); return; }
  mount.appendChild(buildMetricsTable(visibleMonths, selected)); ensureChartMetricOptions(false); renderChart(); applyMetricsTableStyling();
}
async function reloadFromZapierAndRefresh() {
  const rawRows = await fetchRowsFromZapier();
  const raw = Array.isArray(rawRows) ? rawRows : (rawRows?.items || rawRows?.data || []);
  state.rows = raw.map(normalizeRow);
  state.latestMonthKey = computeLatestMonthKey(state.rows);
  const { min, max } = computeMinMaxMonthKey(state.rows); state.minMonthKey = min; state.maxMonthKey = max; state.lastLoadedAtUtc = new Date();
  const companies = uniqueCompanies(state.rows); if (state.selectedCompanies.size === 0) companies.forEach(c=>state.selectedCompanies.add(c)); else for (const c of Array.from(state.selectedCompanies)) if (!companies.includes(c)) state.selectedCompanies.delete(c);
  renderCompanyToggles(companies);
  if (!state.visibleMonths.length) { const defaultKey = state.latestMonthKey; state.visibleMonths=[defaultKey]; state.rangeStartKey=defaultKey; state.rangeEndKey=defaultKey; }
  ensureChartMetricOptions(true); refresh();
}
function computeLatestMonthKey(rows){ const keys = rows.map(r=>monthKeyFromYearMonthName(r.year,r.month)).filter(Boolean).sort(); return keys[keys.length-1]||null; }
function computeMinMaxMonthKey(rows){ const keys = rows.map(r=>monthKeyFromYearMonthName(r.year,r.month)).filter(Boolean).sort(); return { min: keys[0]||null, max: keys[keys.length-1]||null }; }

// -------------------------
// UI helpers
// -------------------------
function renderCompanyToggles(companies){ const mount=document.getElementById("companyToggle"); if(!mount) return; mount.innerHTML=""; for(const name of companies){ const id = `cmp_${name.replace(/\s+/g,"_")}`; const checkbox=el("input",{ type:"checkbox", id }); checkbox.checked = state.selectedCompanies.has(name); checkbox.addEventListener("change", ()=>{ checkbox.checked ? state.selectedCompanies.add(name) : state.selectedCompanies.delete(name); refresh(); }); mount.appendChild(el("div",{ className:"toggle" }, [ checkbox, el("label",{ for:id, text:name }) ])); } }

// -------------------------
// small styling helper
// -------------------------
function applyMetricsTableStyling(){ const root=document.getElementById("metricsDisplay"); const table=root?.querySelector("table"); if(!table) return; root.querySelectorAll(".clickable-metric").forEach(n=>n.style.textDecoration="none"); table.querySelectorAll("td").forEach(td=>{ td.style.textAlign="center"; td.style.verticalAlign="middle"; }); table.querySelectorAll("tr").forEach(tr=>{ const tds=tr.querySelectorAll("td"); if(tds[0]) tds[0].style.textAlign="left"; if(tds[1]) tds[1].style.textAlign="left"; }); table.querySelectorAll("td").forEach(td=>{ if(td.querySelector(".metrics-rich")) td.style.textAlign="left"; }); }

// -------------------------
// Collect trigger (Zapier catch hook)
// -------------------------
async function triggerCollectViaZapier({ test = false } = {}) {
  const hook = getZapierHook();
  if (!hook) throw new Error("Missing ZAPIER_CATCH_HOOK_URL. Configure window.APP_CONFIG.ZAPIER_CATCH_HOOK_URL or sessionStorage key.");
  const mk = lastMonthKeyUtcYYYYMM() || currentMonthKeyUTC();
  const payload = { action: "collect_last_month", month_key: mk, test: !!test };
  const res = await fetch(hook, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
  if (!res.ok) { const t = await res.text().catch(()=> ""); throw new Error(`Zapier hook failed (${res.status}): ${t || res.statusText}`); }
  return await res.json().catch(()=>({}));
}
async function sendTestPayloadToZapier(){ const btn=document.getElementById("testZapBtn"); const prev=btn?btn.textContent:null; try{ if(btn){ btn.disabled=true; btn.textContent="Sending test..."; } await triggerCollectViaZapier({ test:true }); alert("Test dispatched to Zapier. Refresh after a few seconds."); }catch(err){ alert("Test failed: "+String(err?.message||err)); } finally{ if(btn){ btn.disabled=false; btn.textContent=prev; } } }

// -------------------------
// Range selectors (must exist before init)
// -------------------------
function applyCustomRangeFromSelectors() {
  const startKey = monthKeyFromYYYYMMParts((document.getElementById("startYear")||{}).value,(document.getElementById("startMonth")||{}).value);
  const endKey = monthKeyFromYYYYMMParts((document.getElementById("endYear")||{}).value,(document.getElementById("endMonth")||{}).value);
  if (!startKey || !endKey) return alert("Please select start and end month/year.");
  if (compareMonthKey(startKey, endKey) > 0) return alert("Start month must be before (or the same as) End month.");
  const quickThis=document.getElementById("quickThisMonth"); const quickLast=document.getElementById("quickLastMonth"); if(quickThis) quickThis.checked=false; if(quickLast) quickLast.checked=false;
  state.rangeStartKey=startKey; state.rangeEndKey=endKey; state.visibleMonths=listMonthKeysBetween(startKey,endKey);
  refresh();
}
function applyCustomRangeFromSelectors_v2(){ return applyCustomRangeFromSelectors(); }
window.applyCustomRangeFromSelectors = applyCustomRangeFromSelectors;

// -------------------------
// Range selector helpers used by init
// -------------------------
function fillMonthSelect(selectEl){ if(!selectEl) return; selectEl.innerHTML = ""; for(const m of MONTH_LABELS){ const opt=document.createElement("option"); opt.value=m.value; opt.textContent=m.name; selectEl.appendChild(opt); } }
function fillYearSelect(selectEl,minY,maxY){ if(!selectEl) return; selectEl.innerHTML=""; for(let y=minY;y<=maxY;y++){ const opt=document.createElement("option"); opt.value=String(y); opt.textContent=String(y); selectEl.appendChild(opt); } }
function setRangeSelectorsFromKeys(startKey,endKey){ const s=parseMonthKey(startKey); const e=parseMonthKey(endKey); if(!s||!e) return; const sy=document.getElementById("startYear"), sm=document.getElementById("startMonth"), ey=document.getElementById("endYear"), em=document.getElementById("endMonth"); if(sy) sy.value=String(s.year); if(sm) sm.value=s.month; if(ey) ey.value=String(e.year); if(em) em.value=e.month; }

// -------------------------
// Init wiring
// -------------------------
function setLockedUI(locked) {
  const lockScreen=document.getElementById("lockScreen"); const appRoot=document.getElementById("appRoot"); const lockBtn=document.getElementById("lockBtn");
  if(locked){ lockScreen && lockScreen.classList.remove("hidden"); appRoot && appRoot.classList.add("hidden"); lockBtn && lockBtn.classList.add("hidden"); } else { lockScreen && lockScreen.classList.add("hidden"); appRoot && appRoot.classList.remove("hidden"); lockBtn && lockBtn.classList.remove("hidden"); }
}
async function attemptUnlock(password) { setEditKey(password); const ok = await verifyPassword(password); if (!ok) return false; await reloadFromZapierAndRefresh(); return true; }

async function init() {
  try {
    wireEditModals(); ensureChartMetricOptions(true); wireChartDownloadButtons();
    const chartSelect=document.getElementById("chartMetricSelect"); if(chartSelect) chartSelect.addEventListener("change", renderChart);
    const collectBtn=document.getElementById("collectDataBtn"); if(collectBtn) collectBtn.addEventListener("click", async ()=>{
      const prev=collectBtn.textContent;
      try { collectBtn.disabled=true; collectBtn.textContent="Triggering..."; await triggerCollectViaZapier(); setTimeout(async ()=>{ try{ await reloadFromZapierAndRefresh(); alert("Collect triggered and Zapier Table reloaded (if Zap completed)."); }catch(e){ console.warn("Reload after collect failed:", e); alert("Collect triggered. Refresh later to see updates."); } }, 8000); } catch(err){ alert(String(err?.message||err)); } finally{ collectBtn.disabled=false; collectBtn.textContent=prev; }
    });
    const testBtn=document.getElementById("testZapBtn"); if(testBtn) testBtn.addEventListener("click", sendTestPayloadToZapier);
    const pwInput=document.getElementById("pagePassword"); if(pwInput) pwInput.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); const unlockBtn=document.getElementById("unlockBtn"); if(unlockBtn) unlockBtn.click(); }});
    const applyRangeBtn=document.getElementById("applyRange"); if(applyRangeBtn) applyRangeBtn.addEventListener("click", applyCustomRangeFromSelectors);
    const quickThis=document.getElementById("quickThisMonth"); if(quickThis) quickThis.addEventListener("change",(e)=>{ if(e.target.checked){ document.getElementById("quickLastMonth") && (document.getElementById("quickLastMonth").checked=false); const key=currentMonthKeyUTC(); state.rangeStartKey=key; state.rangeEndKey=key; state.visibleMonths=[key]; setRangeSelectorsFromKeys(key,key); refresh(); }});
    const quickLast=document.getElementById("quickLastMonth"); if(quickLast) quickLast.addEventListener("change",(e)=>{ if(e.target.checked){ document.getElementById("quickThisMonth") && (document.getElementById("quickThisMonth").checked=false); const last = lastMonthKeyUtcYYYYMM(); state.rangeStartKey=last; state.rangeEndKey=last; state.visibleMonths=[last]; setRangeSelectorsFromKeys(last,last); refresh(); }});
    const lockBtn = document.getElementById("lockBtn"); if(lockBtn) lockBtn.addEventListener("click", ()=>{ clearEditKey(); setLockedUI(true); });
    const unlockBtn = document.getElementById("unlockBtn"); if(unlockBtn) unlockBtn.addEventListener("click", async ()=>{
      const pw=(document.getElementById("pagePassword")||{}).value; const errMount=document.getElementById("lockError"); if(errMount) errMount.textContent="";
      try { const ok = await attemptUnlock(pw); if(!ok) throw new Error("Incorrect password."); setLockedUI(false); if (state.minMonthKey && state.maxMonthKey) { const minY=Number(state.minMonthKey.split("-")[0]); const maxY=Number(state.maxMonthKey.split("-")[0]); fillYearSelect(document.getElementById("startYear"), minY, maxY); fillYearSelect(document.getElementById("endYear"), minY, maxY); fillMonthSelect(document.getElementById("startMonth")); fillMonthSelect(document.getElementById("endMonth")); setRangeSelectorsFromKeys(state.rangeStartKey, state.rangeEndKey); } } catch(err) { clearEditKey(); if(errMount) errMount.textContent = `Unlock failed: ${String(err?.message||err)}`; }
    });
    setLockedUI(true);
  } catch (e) {
    console.error("init failed:", e);
    const lockErr = document.getElementById("lockError"); if(lockErr) lockErr.textContent = String(e?.stack || e);
    throw e;
  }
}

// expose helpers for console testing
window.reloadFromZapierAndRefresh = reloadFromZapierAndRefresh;
window.fetchRowsFromZapier = fetchRowsFromZapier;
window.patchRowToZapier = patchRowToZapier;
window.setZapierTableGetUrlForSession = setZapierTableGetUrlForSession;
window.setZapierTablePatchUrlForSession = setZapierTablePatchUrlForSession;
window.setZapierHookForSession = setZapierHookForSession;
window.setZapierConfigGetUrlForSession = setZapierConfigGetUrlForSession;

// start
window.addEventListener("DOMContentLoaded", () => {
  init().catch(err => {
    console.error("App init error:", err);
    const lockErr = document.getElementById("lockError");
    if (lockErr) lockErr.textContent = String(err?.stack || err);
  });
});
