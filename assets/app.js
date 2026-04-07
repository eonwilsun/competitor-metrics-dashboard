// app.js - Zapier-only backend (GET + PATCH webhooks)
// Configure via window.APP_CONFIG or sessionStorage keys:
// ZAPIER_TABLE_GET_URL, ZAPIER_TABLE_PATCH_URL, ZAPIER_CATCH_HOOK_URL, optional ZAPIER_CONFIG_GET_URL

// ---------- Config helpers ----------
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
function getZapierTablePatchUrl() { return _getCfg("ZAPIER_TABLE_PATCH_URL"); }
function getZapierHook() { return _getCfg("ZAPIER_CATCH_HOOK_URL"); }
function getZapierConfigGetUrl() { return _getCfg("ZAPIER_CONFIG_GET_URL"); }

// ---------- Basic constants ----------
const SESSION_KEY = "cmd.editKey.v1";
const NOTES_FIELD_KEY = "notes";

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

const CHART_METRICS = [
  { key: "domain_authority", label: "Authority Score" },
  { key: "number_of_referring_domains", label: "Referring Domains" },
  { key: "number_of_organic_keywords", label: "Organic Keywords" },
  { key: "organic_traffic", label: "Organic Traffic (est.)" },
  { key: "instagram_followers", label: "Instagram Followers" },
  { key: "agency_fee_one_child_weekly", label: "Agency Fee / week" },
  { key: "agency_fee_one_child_yearly", label: "Agency Fee / year" }
];

const MONTHS = { january:"01", february:"02", march:"03", april:"04", may:"05", june:"06", july:"07", august:"08", september:"09", october:"10", november:"11", december:"12" };
const MONTH_LABELS = Object.keys(MONTHS).map(k => ({ name: k[0].toUpperCase() + k.slice(1), value: MONTHS[k] }));

// ---------- DOM helper ----------
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "className") node.className = v;
    else node.setAttribute(k, v);
  });
  children.forEach(c => node.appendChild(c));
  return node;
}

// ---------- formatting ----------
function toNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function normalizeText(v) { if (v === null || v === undefined) return null; const s = String(v).trim(); return s.length ? s : null; }
function escapeHtml(s) { return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function linkifyTextToHtml(text) {
  if (text === null || text === undefined) return "";
  const safe = escapeHtml(String(text));
  return safe.replace(/(https?:\/\/[^\s]+)/g, url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`).replaceAll("\n","<br>");
}

// ---------- month helpers ----------
function monthKeyFromYearMonthName(year, monthName) {
  const mm = MONTHS[String(monthName || "").toLowerCase()];
  if (!mm) return null;
  return `${year}-${mm}`;
}
function monthKeyFromYYYYMMParts(year, mm) { return `${String(year).trim()}-${String(mm).padStart(2,"0")}`; }
function parseMonthKey(mk) { if (!mk || typeof mk !== "string" || mk.length < 7) return null; const [y,m] = mk.split("-"); return { year: Number(y), month: String(m).padStart(2,"0") }; }
function compareMonthKey(a,b) { return String(a).localeCompare(String(b)); }
function listMonthKeysBetween(startKey,endKey) {
  const s = parseMonthKey(startKey); const e = parseMonthKey(endKey); if (!s||!e) return [];
  const out = []; const cur = new Date(Date.UTC(s.year, Number(s.month)-1,1)); const end = new Date(Date.UTC(e.year, Number(e.month)-1,1));
  while (cur <= end) { out.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth()+1).padStart(2,"0")}`); cur.setUTCMonth(cur.getUTCMonth()+1); }
  return out;
}
function currentMonthKeyUTC(){ const now = new Date(); return `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,"0")}`; }
function previousMonthKeyUTC(monthKey) { const p = parseMonthKey(monthKey); if(!p) return null; const dt = new Date(Date.UTC(p.year, Number(p.month)-1,1)); dt.setUTCMonth(dt.getUTCMonth()-1); return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,"0")}`; }
function lastMonthKeyUtcYYYYMM() { return previousMonthKeyUTC(currentMonthKeyUTC()); }

// ---------- ensure range helper (must exist before init) ----------
function applyCustomRangeFromSelectors() {
  const startKey = monthKeyFromYYYYMMParts((document.getElementById("startYear")||{}).value,(document.getElementById("startMonth")||{}).value);
  const endKey = monthKeyFromYYYYMMParts((document.getElementById("endYear")||{}).value,(document.getElementById("endMonth")||{}).value);
  if (!startKey || !endKey) return alert("Please select start and end month/year.");
  if (compareMonthKey(startKey,endKey) > 0) return alert("Start month must be before (or the same as) End month.");
  const quickThis = document.getElementById("quickThisMonth"); const quickLast = document.getElementById("quickLastMonth");
  if (quickThis) quickThis.checked=false; if (quickLast) quickLast.checked=false;
  state.rangeStartKey = startKey; state.rangeEndKey = endKey; state.visibleMonths = listMonthKeysBetween(startKey,endKey);
  refresh();
}
window.applyCustomRangeFromSelectors = applyCustomRangeFromSelectors;

// ---------- session / edit key ----------
function getEditKey(){ return sessionStorage.getItem(SESSION_KEY) || ""; }
function setEditKey(k){ sessionStorage.setItem(SESSION_KEY,k); }
function clearEditKey(){ sessionStorage.removeItem(SESSION_KEY); }

// ---------- API fetch ----------
async function apiFetch(url, { method="GET", body=null, headers={}, expectJson=true } = {}) {
  const opts = { method, headers: { ...(headers||{}) } };
  if (body !== null && body !== undefined) { opts.body = typeof body === "string" ? body : JSON.stringify(body); if (!opts.headers["Content-Type"]) opts.headers["Content-Type"] = "application/json"; }
  const res = await fetch(url, opts);
  if (!res.ok) { const t = await res.text().catch(()=>""); throw new Error(`API ${res.status}: ${t||res.statusText}`); }
  if (!expectJson) return res;
  return await res.json();
}

// ---------- Zapier adapters ----------
async function fetchRowsFromZapier() {
  const url = getZapierTableGetUrl();
  if (!url) throw new Error("ZAPIER_TABLE_GET_URL not configured.");
  const rows = await apiFetch(url, { method: "GET" });
  if (Array.isArray(rows)) return rows;
  if (rows?.items) return rows.items;
  if (rows?.data) return rows.data;
  for (const k of Object.keys(rows||{})) if (Array.isArray(rows[k])) return rows[k];
  return [];
}
async function patchRowToZapier(rowId, fields) {
  const url = getZapierTablePatchUrl();
  if (!url) throw new Error("ZAPIER_TABLE_PATCH_URL not configured.");
  return await apiFetch(url, { method: "POST", body: { id: rowId, fields } });
}
async function fetchEditKeyFromZapier() {
  const url = getZapierConfigGetUrl(); if (!url) return null;
  try {
    const cfg = await apiFetch(url, { method: "GET" });
    const rows = Array.isArray(cfg) ? cfg : (cfg?.items || cfg?.data || []);
    if (Array.isArray(rows)) {
      const row = rows.find(r => String(r.key||"") === "EDIT_KEY"); if (row?.value) return String(row.value).trim() || null;
    }
    if (cfg && typeof cfg === "object" && cfg.EDIT_KEY !== undefined) return String(cfg.EDIT_KEY||"").trim() || null;
  } catch (e) { console.warn("fetchEditKeyFromZapier failed:", e); }
  return null;
}
async function verifyPassword(pw) {
  const actual = await fetchEditKeyFromZapier();
  if (!actual) return false; return String(pw||"").trim() === actual;
}

// ---------- state ----------
const state = { visibleMonths: [], rangeStartKey:null, rangeEndKey:null, minMonthKey:null, maxMonthKey:null, selectedCompanies: new Set(), rows: [], latestMonthKey:null, lastLoadedAtUtc:null };

// ---------- row normalization ----------
function getObj(o){ return o && typeof o === "object" ? o : {}; }
function readPostsImages(row){ return toNumberOrNull(getObj(row?.number_of_monthly_instagram_posts).image_graphic); }
function readPostsReels(row){ return toNumberOrNull(getObj(row?.number_of_monthly_instagram_posts).reels_video); }
function readEngagementTotal(row){ return toNumberOrNull(getObj(row?.monthly_instagram_engagement).total_engagement); }
function readEngagementRate(row){ return toNumberOrNull(getObj(row?.monthly_instagram_engagement).engagement_rate_percentage); }

function normalizeRow(row) {
  const r = { ...row };
  const feeObj = r.agency_fee_one_child;
  if (feeObj && typeof feeObj === "object") {
    r.agency_fee_one_child_weekly = toNumberOrNull(feeObj.Weekly ?? feeObj.weekly);
    r.agency_fee_one_child_yearly = toNumberOrNull(feeObj.Yearly ?? feeObj.yearly);
  }
  r.posts_images = readPostsImages(r) ?? 0;
  r.posts_reels = readPostsReels(r) ?? 0;
  r.posts_total = (toNumberOrNull(r.posts_images)||0) + (toNumberOrNull(r.posts_reels)||0);
  r.engagement_total = readEngagementTotal(r);
  r.engagement_rate_percentage = readEngagementRate(r);
  r.monthly_press_coverage = normalizeText(r.monthly_press_coverage);
  return r;
}
function getRowId(row){ const id = row?.id ?? row?.competitor_metrics_dashboard_id; return (id===null||id===undefined||id==="")?null:id; }

// ---------- patch body builder ----------
function buildPatchBodyForMetric(row, fieldKey, rawNum) {
  const num = Number(rawNum);
  if (fieldKey === "agency_fee_one_child_weekly" || fieldKey === "agency_fee_one_child_yearly") {
    const rootKey = "agency_fee_one_child", childKey = fieldKey === "agency_fee_one_child_weekly" ? "Weekly" : "Yearly";
    const current = (row && typeof row[rootKey] === "object" && row[rootKey]) ? row[rootKey] : {};
    return { [rootKey]: { ...current, [childKey]: Math.round(num) } };
  }
  if (fieldKey === "posts_images" || fieldKey === "posts_reels") {
    const rootKey = "number_of_monthly_instagram_posts"; const current = (row && typeof row[rootKey] === "object" && row[rootKey]) ? row[rootKey] : {}; const next = { ...current };
    if (fieldKey === "posts_images") next.image_graphic = Math.round(num); if (fieldKey === "posts_reels") next.reels_video = Math.round(num);
    next.number_of_monthly_instagram_posts_total = (toNumberOrNull(next.image_graphic)||0) + (toNumberOrNull(next.reels_video)||0);
    return { [rootKey]: next };
  }
  if (fieldKey === "posts_total") return null;
  if (fieldKey === "engagement_total" || fieldKey === "engagement_rate_percentage") {
    const rootKey = "monthly_instagram_engagement"; const current = (row && typeof row[rootKey] === "object" && row[rootKey]) ? row[rootKey] : {}; const next = { ...current };
    if (fieldKey === "engagement_total") next.total_engagement = Math.round(num); if (fieldKey === "engagement_rate_percentage") next.engagement_rate_percentage = num;
    return { [rootKey]: next };
  }
  return { [fieldKey]: Math.round(num) };
}

// ---------- small utilities ----------
function formatUtcTimestamp(dt) {
  const yyyy = dt.getUTCFullYear(), mm = String(dt.getUTCMonth()+1).padStart(2,"0"), dd = String(dt.getUTCDate()).padStart(2,"0");
  const hh = String(dt.getUTCHours()).padStart(2,"0"), mi = String(dt.getUTCMinutes()).padStart(2,"0"), ss = String(dt.getUTCSeconds()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} UTC`;
}
function setLastUpdatedAtText(){ const el = document.getElementById("lastUpdatedAt"); if (!el) return; el.textContent = state.lastLoadedAtUtc ? `Last updated: ${formatUtcTimestamp(state.lastLoadedAtUtc)}` : ""; }

// ---------- table/person utilities ----------
function normalizeCompanyName(name){ return String(name||"").trim(); }
function companySort(a,b){ const aa=normalizeCompanyName(a), bb=normalizeCompanyName(b); const aIsSwiis = aa.toLowerCase()==="swiis"; const bIsSwiis = bb.toLowerCase()==="swiis"; if (aIsSwiis && !bIsSwiis) return -1; if (!aIsSwiis && bIsSwiis) return 1; return aa.localeCompare(bb); }
function uniqueCompanies(rows){ const s=new Set(rows.map(r=>normalizeCompanyName(r.company)).filter(Boolean)); return Array.from(s).sort(companySort); }
function findRowByCompanyAndMonth(company, monthKey){ return state.rows.find(r => String(r.company)===String(company) && monthKeyFromYearMonthName(r.year,r.month)===monthKey); }
function extractPostsTotal(obj){ if (!obj||typeof obj!=="object") return toNumberOrNull(obj); return toNumberOrNull(obj.number_of_monthly_instagram_posts_total ?? obj.Total ?? obj.total ?? obj.total_posts); }
function extractEngagementTotal(obj){ if (!obj||typeof obj!=="object") return toNumberOrNull(obj); return toNumberOrNull(obj.total_engagement ?? obj.Total ?? obj.total ?? obj.totalEngagement); }
function getNumericMetricValue(row, metricKey){ if (!row) return null; if (metricKey==="number_of_monthly_instagram_posts") return extractPostsTotal(row.number_of_monthly_instagram_posts); if (metricKey==="monthly_instagram_engagement") return extractEngagementTotal(row.monthly_instagram_engagement); return toNumberOrNull(row[metricKey]); }

// ---------- chart wiring ----------
let metricChart = null;
function ensureChartMetricOptions(force=false) {
  const sel = document.getElementById("chartMetricSelect"); if (!sel) return;
  if (force || sel.options.length===0) { const prev = sel.value; sel.innerHTML=""; CHART_METRICS.forEach(m=>{ const opt=document.createElement("option"); opt.value=m.key; opt.textContent=m.label; sel.appendChild(opt); }); const want = prev && CHART_METRICS.some(x=>x.key===prev) ? prev : (CHART_METRICS[0]?.key||""); if (want) sel.value = want; }
}
function destroyChart(){ if (metricChart){ metricChart.destroy(); metricChart=null; } }
function renderChart() {
  const canvas = document.getElementById("metricChart"); const sel = document.getElementById("chartMetricSelect"); const modeLabel = document.getElementById("chartModeLabel");
  if (!canvas || !sel || typeof Chart === "undefined") return;
  if (sel.options.length===0) ensureChartMetricOptions(true);
  const metricKey = sel.value; if (!metricKey) return;
  const metricLabel = CHART_METRICS.find(m=>m.key===metricKey)?.label || metricKey;
  const visibleMonths = state.visibleMonths.length ? state.visibleMonths : (state.latestMonthKey ? [state.latestMonthKey] : []);
  if (!visibleMonths.length) return;
  const singleMonth = visibleMonths.length===1;
  const companies = uniqueCompanies(state.rows).filter(c=>state.selectedCompanies.has(c));
  if (modeLabel) modeLabel.textContent = singleMonth ? `(Bar • ${visibleMonths[0]})` : `(Line • ${visibleMonths[0]} → ${visibleMonths[visibleMonths.length-1]})`;
  destroyChart();
  if (singleMonth) {
    const mk = visibleMonths[0];
    const values = companies.map(c => getNumericMetricValue(findRowByCompanyAndMonth(c,mk), metricKey) ?? 0);
    const colors = companies.map((c,i)=>`hsl(${(i*47)%360},70%,45%)`);
    metricChart = new Chart(canvas, { type:"bar", data:{ labels: companies, datasets:[{ label: metricLabel, data: values, backgroundColor: colors }] }, options:{ responsive:true, plugins:{ legend:{ display:true } }, scales:{ y:{ beginAtZero:true } } } });
  } else {
    const datasets = companies.map((c,i)=>({ label:c, data: visibleMonths.map(mk => getNumericMetricValue(findRowByCompanyAndMonth(c,mk), metricKey) ?? 0), tension:0.25, borderColor:`hsl(${(i*47)%360},70%,45%)`, backgroundColor:`hsl(${(i*47)%360},70%,45%)` }));
    metricChart = new Chart(canvas, { type:"line", data:{ labels: visibleMonths, datasets }, options:{ responsive:true, plugins:{ legend:{ display:true } }, scales:{ y:{ beginAtZero:true } } } });
  }
}

// ---------- apply styling small helper ----------
function applyMetricsTableStyling() {
  const root = document.getElementById("metricsDisplay"); const table = root?.querySelector("table"); if (!table) return;
  root.querySelectorAll(".clickable-metric").forEach(n=>n.style.textDecoration="none");
  table.querySelectorAll("td").forEach(td=>{ td.style.textAlign="center"; td.style.verticalAlign="middle"; });
  table.querySelectorAll("tr").forEach(tr=>{ const tds = tr.querySelectorAll("td"); if (tds[0]) tds[0].style.textAlign="left"; if (tds[1]) tds[1].style.textAlign="left"; });
  table.querySelectorAll("td").forEach(td=>{ if (td.querySelector(".metrics-rich")) td.style.textAlign="left"; });
}

// ---------- UI: table building ----------
function buildMetricsTable(visibleMonths, companies) {
  const table = el("table"), thead = el("thead"), trh = el("tr");
  trh.appendChild(el("th",{text:"Company"})); trh.appendChild(el("th",{text:"Month(s)"}));
  METRIC_FIELDS.forEach(f => trh.appendChild(el("th",{text:f.label}))); trh.appendChild(el("th",{text:"Notes"}));
  thead.appendChild(trh); table.appendChild(thead);
  const tbody = el("tbody"); const singleMonth = visibleMonths.length===1;
  for (const companyName of companies) {
    const tr = el("tr"); tr.appendChild(el("td",{text:companyName})); tr.appendChild(el("td",{text: singleMonth?visibleMonths[0]:`${visibleMonths.length} months`}));
    for (const f of METRIC_FIELDS) {
      let displayValue=null, editTargetRow=null, editMonthKey=null;
      if (singleMonth) { editMonthKey=visibleMonths[0]; editTargetRow=findRowByCompanyAndMonth(companyName,editMonthKey); displayValue = editTargetRow?editTargetRow[f.key]:null; }
      else { displayValue = (f.format==="int"||f.format==="float") ? averageNumericForCompanyAcrossMonths(companyName,visibleMonths,f.key) : null; }
      const td = el("td");
      if (f.format==="richtext") {
        const html = displayValue ? linkifyTextToHtml(displayValue) : "—";
        const div = el("div",{ className:`clickable-metric metrics-rich${(!displayValue?" muted-cell":"")}`, html, title: singleMonth ? "Click to edit" : "Shown only in single-month view" });
        if (singleMonth && editTargetRow && f.editable) div.addEventListener("click", (e)=>{ if (e.target && e.target.closest && e.target.closest("a")) return; openEditTextModal({ row: editTargetRow, fieldKey: f.key, fieldLabel: f.label, currentValue: editTargetRow[f.key], monthKey: editMonthKey }); });
        td.appendChild(div); tr.appendChild(td); continue;
      }
      const isEmpty = displayValue === null || displayValue === undefined || displayValue === "";
      const span = el("span",{ className:`clickable-metric metrics-num${isEmpty?" muted-cell":""}`, text: formatValue(displayValue,f.format), title: singleMonth ? (f.readOnly ? "Derived (edit Images/Reels)" : "Click to edit") : "Averaged across selected months" });
      if (singleMonth && editTargetRow && !f.readOnly) span.addEventListener("click", ()=>openEditMetricModal({ row: editTargetRow, fieldKey: f.key, fieldLabel: f.label, currentValue: editTargetRow[f.key], monthKey: editMonthKey }));
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

// ---------- Modals & editing ----------
let editModalState=null, editTextModalState=null, editNotesModalState=null;
function openEditMetricModal({ row, fieldKey, fieldLabel, currentValue, monthKey }) {
  editModalState = { row, fieldKey, monthKey };
  const backdrop = document.getElementById("editMetricModalBackdrop"); if (!backdrop) return;
  document.getElementById("editMetricSubtitle").textContent = `${row.company} • ${monthKey} • ${fieldLabel}`;
  document.getElementById("editMetricHint").textContent = "This updates the value in Zapier Table.";
  const input = document.getElementById("editMetricNewValue"); if (input) input.value = (currentValue===null||currentValue===undefined) ? "" : String(currentValue);
  backdrop.style.display="flex"; backdrop.setAttribute("aria-hidden","false"); setTimeout(()=>input&&input.focus(),0);
}
function closeEditMetricModal(){ const b=document.getElementById("editMetricModalBackdrop"); if (!b) return; b.style.display="none"; b.setAttribute("aria-hidden","true"); editModalState=null; }
function openEditTextModal({ row, fieldKey, fieldLabel, currentValue, monthKey }) {
  editTextModalState = { row, fieldKey, monthKey };
  const backdrop = document.getElementById("editTextModalBackdrop"); if (!backdrop) return;
  document.getElementById("editTextSubtitle").textContent = `${row.company} • ${monthKey} • ${fieldLabel}`;
  document.getElementById("editTextHint").textContent = "Multiple lines supported. Ctrl+Enter saves.";
  const textarea = document.getElementById("editTextNewValue"); if (textarea) textarea.value = (currentValue===null||currentValue===undefined) ? "" : String(currentValue);
  document.getElementById("editTextUpdate").dataset.mode = "press"; backdrop.style.display="flex"; backdrop.setAttribute("aria-hidden","false"); setTimeout(()=>textarea&&textarea.focus(),0);
}
function openEditNotesModal({ row, monthKey }) { editNotesModalState={row,monthKey}; const backdrop=document.getElementById("editTextModalBackdrop"); if(!backdrop) return; document.getElementById("editTextSubtitle").textContent = `${row.company} • ${monthKey} • Notes`; document.getElementById("editTextHint").textContent = "Edit notes (multi-line). Ctrl+Enter saves."; const t=document.getElementById("editTextNewValue"); if(t) t.value = row?.[NOTES_FIELD_KEY] ?? ""; document.getElementById("editTextUpdate").dataset.mode = "notes"; backdrop.style.display="flex"; backdrop.setAttribute("aria-hidden","false"); setTimeout(()=>t&&t.focus(),0); }
function closeEditTextModal(){ const b=document.getElementById("editTextModalBackdrop"); if(!b) return; b.style.display="none"; b.setAttribute("aria-hidden","true"); editTextModalState=null; editNotesModalState=null; document.getElementById("editTextUpdate").dataset.mode=""; }

function wireEditModals() {
  const cClose = document.getElementById("editMetricClose"); if (cClose) cClose.addEventListener("click", closeEditMetricModal);
  const cBack = document.getElementById("editMetricModalBackdrop"); if (cBack) cBack.addEventListener("click",(e)=>{ if (e.target.id==="editMetricModalBackdrop") closeEditMetricModal(); });
  const tClose = document.getElementById("editTextClose"); if (tClose) tClose.addEventListener("click", closeEditTextModal);
  const tBack = document.getElementById("editTextModalBackdrop"); if (tBack) tBack.addEventListener("click",(e)=>{ if (e.target.id==="editTextModalBackdrop") closeEditTextModal(); });

  const metricInput = document.getElementById("editMetricNewValue"); if (metricInput) metricInput.addEventListener("keydown", (e)=> { if (e.key==="Enter"){ e.preventDefault(); document.getElementById("editMetricUpdate").click(); }});
  const textInput = document.getElementById("editTextNewValue"); if (textInput) textInput.addEventListener("keydown", (e)=>{ if (e.key==="Enter"&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); document.getElementById("editTextUpdate").click(); }});

  const metricUpdate = document.getElementById("editMetricUpdate"); if (metricUpdate) metricUpdate.addEventListener("click", async ()=>{
    if (!editModalState) return; const btn = metricUpdate; const raw = (document.getElementById("editMetricNewValue")||{}).value;
    if (raw===""||raw===null||raw===undefined) return alert("Enter a value."); const num = Number(raw); if (!Number.isFinite(num)) return alert("Please enter a valid number.");
    const { row, fieldKey } = editModalState; const rowId = getRowId(row); if (!rowId) return alert("Missing record id.");
    try { btn.disabled=true; btn.textContent="Saving..."; const body = buildPatchBodyForMetric(row, fieldKey, num); if (!body) { alert("Total is derived. Edit Images or Reels."); return; } await patchRowToZapier(rowId, body); closeEditMetricModal(); await reloadFromZapierAndRefresh(); } catch (err) { alert("Save failed: "+String(err?.message||err)); } finally { btn.disabled=false; btn.textContent="Update"; }
  });

  const textUpdate = document.getElementById("editTextUpdate"); if (textUpdate) textUpdate.addEventListener("click", async ()=>{
    const mode = textUpdate.dataset.mode||""; const btn = textUpdate; const val = (document.getElementById("editTextNewValue")||{}).value; const payloadVal = (val===""?null:val);
    try { btn.disabled=true; btn.textContent="Saving..."; if (mode==="press") { const row = editTextModalState?.row; const rowId = getRowId(row); if(!rowId) return alert("Missing record id."); await patchRowToZapier(rowId, { monthly_press_coverage: payloadVal }); closeEditTextModal(); await reloadFromZapierAndRefresh(); return; } if (mode==="notes") { const row = editNotesModalState?.row; const rowId = getRowId(row); if(!rowId) return alert("Missing record id."); await patchRowToZapier(rowId, { [NOTES_FIELD_KEY]: payloadVal }); closeEditTextModal(); await reloadFromZapierAndRefresh(); return; } } catch(err) { alert("Save failed: "+String(err?.message||err)); } finally { btn.disabled=false; btn.textContent="Update"; }
  });

  window.addEventListener("keydown",(e)=>{ if (e.key!=="Escape") return; if (editModalState) closeEditMetricModal(); if (editTextModalState||editNotesModalState) closeEditTextModal(); });
}

// ---------- averaging ----------
function averageNumericForCompanyAcrossMonths(companyName, monthKeys, fieldKey) {
  const vals = monthKeys.map(mk=>findRowByCompanyAndMonth(companyName,mk)).map(r=>{
    if(!r) return null;
    if (fieldKey==="number_of_monthly_instagram_posts") return extractPostsTotal(r.number_of_monthly_instagram_posts);
    if (fieldKey==="monthly_instagram_engagement") return extractEngagementTotal(r.monthly_instagram_engagement);
    return toNumberOrNull(r[fieldKey]);
  }).filter(v=>v!==null);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
}

// ---------- apply small helpers for chart downloads ----------
function downloadDataUrl(filename, dataUrl){ const a=document.createElement("a"); a.href=dataUrl; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); }
function downloadChartAs(type){ const canvas=document.getElementById("metricChart"); if(!canvas) return alert("Chart not found."); const ext = type==="image/jpeg"?"jpg":"png"; const dataUrl = canvas.toDataURL(type,0.92); downloadDataUrl(`chart.${ext}`,dataUrl); }
function downloadChartPdfViaPrint(){ const canvas=document.getElementById("metricChart"); if(!canvas) return alert("Chart not found."); const img = canvas.toDataURL("image/png"); const w=window.open("","_blank"); if(!w) return alert("Popup blocked. Allow popups."); w.document.open(); w.document.write(`<!doctype html><html><head><title>Chart</title><style>body{margin:0;padding:24px;font-family:system-ui, -apple-system,Segoe UI,Roboto;}img{max-width:100%;height:auto}.hint{margin-top:12px;opacity:0.7;font-size:12px;}</style></head><body><img src="${img}" /><div class="hint">Use Print (Ctrl+P) and Save as PDF.</div></body></html>`); w.document.close(); w.focus(); }

// ---------- refresh / reload ----------
function refresh() {
  const mount = document.getElementById("metricsDisplay"); if(!mount) return;
  mount.innerHTML = "";
  if (!state.latestMonthKey) { mount.appendChild(el("p",{className:"muted", text:"No data found in Zapier Table."})); destroyChart(); return; }
  const visibleMonths = state.visibleMonths.length ? state.visibleMonths : [state.latestMonthKey];
  const selected = uniqueCompanies(state.rows).filter(c=>state.selectedCompanies.has(c));
  const lastEl = document.getElementById("lastUpdated");
  if (lastEl) lastEl.textContent = `Loaded from Zapier Table. Latest month: ${state.latestMonthKey}. Viewing: ${visibleMonths.join(", ")}.`;
  setLastUpdatedAtText();
  if (!selected.length) { mount.appendChild(el("p",{className:"muted", text:"No companies selected."})); destroyChart(); return; }
  mount.appendChild(buildMetricsTable(visibleMonths, selected));
  ensureChartMetricOptions(false); renderChart(); applyMetricsTableStyling();
}

async function reloadFromZapierAndRefresh() {
  const rawRows = await fetchRowsFromZapier();
  const raw = Array.isArray(rawRows) ? rawRows : (rawRows?.items || rawRows?.data || []);
  state.rows = raw.map(normalizeRow);
  state.latestMonthKey = computeLatestMonthKey(state.rows);
  const { min, max } = computeMinMaxMonthKey(state.rows);
  state.minMonthKey = min; state.maxMonthKey = max; state.lastLoadedAtUtc = new Date();
  const companies = uniqueCompanies(state.rows);
  if (state.selectedCompanies.size === 0) companies.forEach(c=>state.selectedCompanies.add(c));
  else for (const c of Array.from(state.selectedCompanies)) if (!companies.includes(c)) state.selectedCompanies.delete(c);
  renderCompanyToggles(companies);
  if (!state.visibleMonths.length) { const defaultKey = state.latestMonthKey; state.visibleMonths=[defaultKey]; state.rangeStartKey=defaultKey; state.rangeEndKey=defaultKey; }
  ensureChartMetricOptions(true); refresh();
}
function computeLatestMonthKey(rows){ const keys = rows.map(r=>monthKeyFromYearMonthName(r.year,r.month)).filter(Boolean).sort(); return keys[keys.length-1]||null; }
function computeMinMaxMonthKey(rows){ const keys = rows.map(r=>monthKeyFromYearMonthName(r.year,r.month)).filter(Boolean).sort(); return { min: keys[0]||null, max: keys[keys.length-1]||null }; }

// ---------- render toggles ----------
function renderCompanyToggles(companies) {
  const mount = document.getElementById("companyToggle"); if(!mount) return; mount.innerHTML="";
  for (const name of companies) {
    const id = `cmp_${name.replace(/\s+/g,"_")}`; const checkbox = el("input",{ type:"checkbox", id }); checkbox.checked = state.selectedCompanies.has(name);
    checkbox.addEventListener("change", ()=>{ checkbox.checked ? state.selectedCompanies.add(name) : state.selectedCompanies.delete(name); refresh(); });
    mount.appendChild(el("div",{ className:"toggle" }, [ checkbox, el("label",{ for:id, text:name }) ]));
  }
}

// ---------- collect trigger ----------
async function triggerCollectViaZapier({ test=false }={}) {
  const hook = getZapierHook(); if (!hook) throw new Error("Missing ZAPIER_CATCH_HOOK_URL.");
  const mk = lastMonthKeyUtcYYYYMM() || currentMonthKeyUTC();
  const payload = { action:"collect_last_month", month_key: mk, test: !!test };
  const res = await fetch(hook, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) { const t = await res.text().catch(()=>""); throw new Error(`Zapier hook failed (${res.status}): ${t||res.statusText}`); }
  return await res.json().catch(()=>({}));
}
async function sendTestPayloadToZapier() {
  const btn = document.getElementById("testZapBtn"); const prevText = btn?btn.textContent:null;
  try { if (btn){ btn.disabled=true; btn.textContent="Sending test..."; } await triggerCollectViaZapier({ test:true }); alert("Test dispatched to Zapier. Refresh after a few seconds."); } catch(err){ alert("Test failed: "+String(err?.message||err)); } finally { if (btn){ btn.disabled=false; btn.textContent=prevText; } }
}

// ---------- init wiring ----------
function setLockedUI(locked) { const lockScreen=document.getElementById("lockScreen"); const appRoot=document.getElementById("appRoot"); const lockBtn=document.getElementById("lockBtn"); if (locked){ lockScreen && lockScreen.classList.remove("hidden"); appRoot && appRoot.classList.add("hidden"); lockBtn && lockBtn.classList.add("hidden"); } else { lockScreen && lockScreen.classList.add("hidden"); appRoot && appRoot.classList.remove("hidden"); lockBtn && lockBtn.classList.remove("hidden"); } }
async function attemptUnlock(password) { setEditKey(password); const ok = await verifyPassword(password); if (!ok) return false; await reloadFromZapierAndRefresh(); return true; }

async function init() {
  try {
    wireEditModals(); ensureChartMetricOptions(true); wireChartDownloadButtons();
    const chartSelect = document.getElementById("chartMetricSelect"); if (chartSelect) chartSelect.addEventListener("change", renderChart);
    const collectBtn = document.getElementById("collectDataBtn"); if (collectBtn) collectBtn.addEventListener("click", async ()=>{
      const prevText = collectBtn.textContent; try { collectBtn.disabled=true; collectBtn.textContent="Triggering..."; await triggerCollectViaZapier(); setTimeout(async ()=>{ try{ await reloadFromZapierAndRefresh(); alert("Collect triggered and Zapier Table reloaded (if Zap completed)."); } catch(e){ console.warn("Reload after collect failed:",e); alert("Collect triggered. Refresh later to see updates."); } }, 8000); } catch(err){ alert(String(err?.message||err)); } finally { collectBtn.disabled=false; collectBtn.textContent=prevText; }
    });
    const testBtn = document.getElementById("testZapBtn"); if (testBtn) testBtn.addEventListener("click", sendTestPayloadToZapier);
    const pwInput = document.getElementById("pagePassword"); if (pwInput) pwInput.addEventListener("keydown", (e)=>{ if (e.key==="Enter"){ e.preventDefault(); const unlockBtn = document.getElementById("unlockBtn"); if (unlockBtn) unlockBtn.click(); }});
    const applyRangeBtn = document.getElementById("applyRange"); if (applyRangeBtn) applyRangeBtn.addEventListener("click", applyCustomRangeFromSelectors);
    const quickThis = document.getElementById("quickThisMonth"); if (quickThis) quickThis.addEventListener("change", (e)=>{ if (e.target.checked) { document.getElementById("quickLastMonth") && (document.getElementById("quickLastMonth").checked=false); const key = currentMonthKeyUTC(); state.rangeStartKey=key; state.rangeEndKey=key; state.visibleMonths=[key]; setRangeSelectorsFromKeys(key,key); refresh(); }});
    const quickLast = document.getElementById("quickLastMonth"); if (quickLast) quickLast.addEventListener("change",(e)=>{ if (e.target.checked) { document.getElementById("quickThisMonth") && (document.getElementById("quickThisMonth").checked=false); const last = lastMonthKeyUtcYYYYMM(); state.rangeStartKey=last; state.rangeEndKey=last; state.visibleMonths=[last]; setRangeSelectorsFromKeys(last,last); refresh(); }});
    const lockBtn = document.getElementById("lockBtn"); if (lockBtn) lockBtn.addEventListener("click", ()=>{ clearEditKey(); setLockedUI(true); });
    const unlockBtn = document.getElementById("unlockBtn"); if (unlockBtn) unlockBtn.addEventListener("click", async ()=>{
      const pw = (document.getElementById("pagePassword")||{}).value; const errMount = document.getElementById("lockError"); if (errMount) errMount.textContent="";
      try { const ok = await attemptUnlock(pw); if (!ok) throw new Error("Incorrect password."); setLockedUI(false); if (state.minMonthKey && state.maxMonthKey) { const minY = Number(state.minMonthKey.split("-")[0]); const maxY = Number(state.maxMonthKey.split("-")[0]); fillYearSelect(document.getElementById("startYear"), minY, maxY); fillYearSelect(document.getElementById("endYear"), minY, maxY); fillMonthSelect(document.getElementById("startMonth")); fillMonthSelect(document.getElementById("endMonth")); setRangeSelectorsFromKeys(state.rangeStartKey, state.rangeEndKey); } } catch(err) { clearEditKey(); if (errMount) errMount.textContent = `Unlock failed: ${String(err?.message||err)}`; }
    });
    setLockedUI(true);
  } catch (e) {
    console.error("init failed:", e);
    throw e;
  }
}

// small helpers used in init
function fillMonthSelect(selectEl){ if(!selectEl) return; selectEl.innerHTML=""; MONTH_LABELS.forEach(m=>{ const opt=document.createElement("option"); opt.value=m.value; opt.textContent=m.name; selectEl.appendChild(opt); }); }
function fillYearSelect(selectEl,minY,maxY){ if(!selectEl) return; selectEl.innerHTML=""; for(let y=minY;y<=maxY;y++){ const opt=document.createElement("option"); opt.value=String(y); opt.textContent=String(y); selectEl.appendChild(opt); } }
function setRangeSelectorsFromKeys(startKey,endKey){ const s=parseMonthKey(startKey); const e=parseMonthKey(endKey); if(!s||!e) return; document.getElementById("startYear").value=String(s.year); document.getElementById("startMonth").value=s.month; document.getElementById("endYear").value=String(e.year); document.getElementById("endMonth").value=e.month; }

// ---------- expose some functions for console testing ----------
window.reloadFromZapierAndRefresh = reloadFromZapierAndRefresh;
window.fetchRowsFromZapier = fetchRowsFromZapier;
window.patchRowToZapier = patchRowToZapier;
window.setZapierTableGetUrlForSession = (u)=>sessionStorage.setItem("ZAPIER_TABLE_GET_URL",String(u||"").trim());
window.setZapierTablePatchUrlForSession = (u)=>sessionStorage.setItem("ZAPIER_TABLE_PATCH_URL",String(u||"").trim());
window.setZapierHookForSession = (u)=>sessionStorage.setItem("ZAPIER_CATCH_HOOK_URL",String(u||"").trim());

// ---------- start ----------
window.addEventListener("DOMContentLoaded", ()=>{ init().catch(err=>{ console.error("App init error:", err); const lockErr = document.getElementById("lockError"); if (lockErr) lockErr.textContent = String(err?.stack || err); }); });
