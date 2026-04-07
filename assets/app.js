// app.js - Full replacement
// Zapier for data (GET + PATCH) and Xano only for the edit-key (unlock) + optional dispatch endpoints.
// Configure endpoints via window.APP_CONFIG or sessionStorage.
//
// Required/runtime keys:
// - ZAPIER_TABLE_GET_URL   (optional; if present, Zapier is used for reads)
// - ZAPIER_TABLE_PATCH_URL (optional; if present, Zapier is used for updates)
// - ZAPIER_CONFIG_GET_URL  (optional; Zapier can store EDIT_KEY but Xano preferred)
// - ZAPIER_CATCH_HOOK_URL  (optional; collect trigger)
//
// - XANO_CONFIG_GET_URL    (recommended; Xano endpoint /app_config -> returns EDIT_KEY)
// - XANO_TABLE_GET_URL     (optional runtime override for Xano table get base URL)
// - XANO_TABLE_PATCH_URL   (optional runtime override for Xano table patch base URL)
//
// After deploying: hard-refresh (Ctrl/Cmd+Shift+R)
// Quick test (Console) examples:
// sessionStorage.setItem('ZAPIER_TABLE_GET_URL','https://hooks.zapier.com/hooks/catch/.../GET');
// sessionStorage.setItem('ZAPIER_TABLE_PATCH_URL','https://hooks.zapier.com/hooks/catch/.../PATCH');
// sessionStorage.setItem('XANO_CONFIG_GET_URL','https://x8ki-letl-twmt.n7.xano.io/api:ZvixoXZ8/app_config');

// -------------------------
// Session / Edit Key helpers (defined first to avoid ReferenceError)
// -------------------------
const SESSION_KEY = "cmd.editKey.v1";
function getEditKey() { try { return sessionStorage.getItem(SESSION_KEY) || ""; } catch (e) { return ""; } }
function setEditKey(k) { try { sessionStorage.setItem(SESSION_KEY, String(k || "")); } catch (e) {} }
function clearEditKey() { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {} }

// -------------------------
// Zapier / runtime config helpers (APP_CONFIG or sessionStorage)
// -------------------------
function _getCfg(key) {
  try { if (typeof window !== "undefined" && window.APP_CONFIG && window.APP_CONFIG[key]) { const v = String(window.APP_CONFIG[key] || "").trim(); if (v) return v; } } catch (e) {}
  try { const s = sessionStorage.getItem(key); if (s && String(s).trim()) return String(s).trim(); } catch (e) {}
  return null;
}
function getZapierTableGetUrl() { return _getCfg("ZAPIER_TABLE_GET_URL"); }
function setZapierTableGetUrlForSession(url) { try { if (!url) sessionStorage.removeItem("ZAPIER_TABLE_GET_URL"); else sessionStorage.setItem("ZAPIER_TABLE_GET_URL", String(url).trim()); } catch(e){} }
function getZapierTablePatchUrl() { return _getCfg("ZAPIER_TABLE_PATCH_URL"); }
function setZapierTablePatchUrlForSession(url) { try { if (!url) sessionStorage.removeItem("ZAPIER_TABLE_PATCH_URL"); else sessionStorage.setItem("ZAPIER_TABLE_PATCH_URL", String(url).trim()); } catch(e){} }
function getZapierConfigGetUrl() { return _getCfg("ZAPIER_CONFIG_GET_URL"); }
function setZapierConfigGetUrlForSession(url) { try { if (!url) sessionStorage.removeItem("ZAPIER_CONFIG_GET_URL"); else sessionStorage.setItem("ZAPIER_CONFIG_GET_URL", String(url).trim()); } catch(e){} }
function getZapierHook() { return _getCfg("ZAPIER_CATCH_HOOK_URL"); }
function setZapierHookForSession(url) { try { if (!url) sessionStorage.removeItem("ZAPIER_CATCH_HOOK_URL"); else sessionStorage.setItem("ZAPIER_CATCH_HOOK_URL", String(url).trim()); } catch(e){} }

// Xano runtime overrides
function getXanoTableGetUrl() { return _getCfg("XANO_TABLE_GET_URL"); }
function getXanoTablePatchUrl() { return _getCfg("XANO_TABLE_PATCH_URL"); }
function getXanoConfigGetUrl() { return _getCfg("XANO_CONFIG_GET_URL"); }

// -------------------------
// Xano defaults
// -------------------------
const XANO_BASE_URL = "https://x8ki-letl-twmt.n7.xano.io/api:ZvixoXZ8";
const XANO_TABLE_PATH = "/competitor_metrics_dashboard";
const XANO_CONFIG_PATH = "/app_config";
const EDIT_KEY_NAME = "EDIT_KEY";

// -------------------------
// Metrics + UI constants (unchanged from original)
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
// Company ordering + colors
// -------------------------
function normalizeCompanyName(name) { return String(name || "").trim(); }
function companySort(a, b) { const aa = normalizeCompanyName(a); const bb = normalizeCompanyName(b); const aIsSwiis = aa.toLowerCase() === "swiis"; const bIsSwiis = bb.toLowerCase() === "swiis"; if (aIsSwiis && !bIsSwiis) return -1; if (!aIsSwiis && bIsSwiis) return 1; return aa.localeCompare(bb); }
const COMPANY_COLORS = { swiis:"#ef5d2f", capstone:"#0d66a2", compass:"#1897d3", fca:"#f27a30", nfa:"#f9ae42", "orange grove":"#51277d", orangegrove:"#51277d", tact:"#b22288" };
function companyColor(company) { const key = normalizeCompanyName(company).toLowerCase(); if (COMPANY_COLORS[key]) return COMPANY_COLORS[key]; let hash=0; for (let i=0;i<key.length;i++) hash=(hash*31+key.charCodeAt(i))>>>0; return `hsl(${hash%360},70%,45%)`; }

// -------------------------
// DOM + formatting helpers
// -------------------------
function el(tag, attrs = {}, children = []) { const node = document.createElement(tag); for (const [k,val] of Object.entries(attrs)) { if (k==="className") node.className = val; else if (k==="text") node.textContent = val; else if (k==="html") node.innerHTML = val; else node.setAttribute(k, val); } for (const c of children) node.appendChild(c); return node; }
function toNumberOrNull(v){ if (v===null||v===undefined||v==="") return null; const n=Number(v); return Number.isNaN(n)?null:n; }
function normalizeText(v){ if (v===null||v===undefined) return null; const s=String(v).trim(); return s.length ? s : null; }
function escapeHtml(s){ return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function linkifyTextToHtml(text){ if (text===null||text===undefined) return ""; const safe=escapeHtml(String(text)); const urlRegex=/(https?:\/\/[^\s]+)/g; return safe.replace(urlRegex, (url)=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`).replaceAll("\n","<br>"); }

// -------------------------
// API fetch wrapper
// -------------------------
async function apiFetch(url, { method="GET", body=null, headers={}, expectJson=true } = {}) {
  const opts = { method, headers: { ...(headers||{}) } };
  if (body !== null && body !== undefined) { opts.body = typeof body === "string" ? body : JSON.stringify(body); if (!opts.headers["Content-Type"]) opts.headers["Content-Type"] = "application/json"; }
  const res = await fetch(url, opts);
  if (!res.ok) { const text = await res.text().catch(()=>""); throw new Error(`API error ${res.status}: ${text || res.statusText}`); }
  if (!expectJson) return res;
  return await res.json();
}

// -------------------------
// Xano fetch helper (flexible, supports runtime overrides and headers)
// -------------------------
async function xanoFetch(pathOrUrl, { method = "GET", body = null, withEditKey = true } = {}) {
  const candidate = String(pathOrUrl || "");
  let full;
  if (/^https?:\/\//i.test(candidate)) {
    full = candidate;
  } else {
    const getUrl = getXanoTableGetUrl();
    if (getUrl) {
      const base = getUrl.replace(/\/competitor_metrics_dashboard(\/.*)?$/i, "");
      full = base + candidate;
    } else {
      full = XANO_BASE_URL + candidate;
    }
  }

  const headers = { "Content-Type": "application/json" };
  if (withEditKey) {
    const key = getEditKey();
    if (key) headers["x-edit-key"] = String(key);
  }

  const opts = { method, headers };
  if (body !== null && body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(full, opts);
  if (!res.ok) { const text = await res.text().catch(()=>""); throw new Error(`Xano error ${res.status}: ${text || res.statusText}`); }
  return await res.json();
}

// -------------------------
// Backend adapters (Zapier primary, Xano fallback)
// -------------------------
async function fetchRowsFromBackend() {
  const zapGet = getZapierTableGetUrl();
  if (zapGet) {
    const rows = await apiFetch(zapGet, { method: "GET" });
    if (Array.isArray(rows)) return rows;
    if (rows && Array.isArray(rows.items)) return rows.items;
    if (rows && Array.isArray(rows.data)) return rows.data;
    if (rows && typeof rows === "object") {
      for (const k of Object.keys(rows)) if (Array.isArray(rows[k])) return rows[k];
    }
    return [];
  }

  // fallback to Xano GET
  const xurl = getXanoTableGetUrl() || (XANO_BASE_URL + XANO_TABLE_PATH);
  const res = await apiFetch(xurl, { method: "GET" });
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.items)) return res.items;
  if (res && Array.isArray(res.data)) return res.data;
  for (const k of Object.keys(res || {})) if (Array.isArray(res[k])) return res[k];
  return [];
}

async function patchRowToBackend(rowId, fields) {
  const zapPatch = getZapierTablePatchUrl();
  if (zapPatch) {
    const payload = { id: rowId, fields };
    const updated = await apiFetch(zapPatch, { method: "POST", body: payload });
    return updated;
  }

  // fallback to Xano PATCH
  const base = getXanoTablePatchUrl() || (XANO_BASE_URL + XANO_TABLE_PATH);
  const url = `${base.replace(/\/$/,"")}/${encodeURIComponent(rowId)}`;
  const updated = await apiFetch(url, { method: "PATCH", body: fields });
  return updated;
}

// -------------------------
// Fetch edit key: Xano primary, Zapier optional fallback
// -------------------------
async function fetchEditKeyFromXano() {
  // Try Xano config endpoint first
  try {
    const cfgUrl = getXanoConfigGetUrl() || (XANO_BASE_URL + XANO_CONFIG_PATH);
    const res = await apiFetch(cfgUrl, { method: "GET" });
    const rows = Array.isArray(res) ? res : (res?.items || res?.data || []);
    if (Array.isArray(rows)) {
      const row = rows.find(r => String(r.key || "").trim() === EDIT_KEY_NAME);
      const value = row?.value;
      if (value !== undefined && value !== null) return String(value).trim() || null;
    }
    if (res && typeof res === "object" && res[EDIT_KEY_NAME] !== undefined) {
      const v = res[EDIT_KEY_NAME];
      const s = String(v || "").trim();
      return s.length ? s : null;
    }
  } catch (e) {
    console.warn("fetchEditKeyFromXano failed:", e);
  }

  // Fallback: try Zapier config endpoint if set
  try {
    const cfgUrl = getZapierConfigGetUrl();
    if (cfgUrl) {
      const cfg = await apiFetch(cfgUrl, { method: "GET" });
      const rows = Array.isArray(cfg) ? cfg : (cfg?.items || cfg?.data || []);
      if (Array.isArray(rows)) {
        const row = rows.find(r => String(r.key || "").trim() === EDIT_KEY_NAME);
        const value = row?.value;
        if (value !== undefined && value !== null) return String(value).trim() || null;
      }
      if (cfg && typeof cfg === "object" && cfg[EDIT_KEY_NAME] !== undefined) {
        const v = cfg[EDIT_KEY_NAME];
        const s = String(v || "").trim();
        return s.length ? s : null;
      }
    }
  } catch (e) {
    console.warn("fetchEditKeyFromZapier failed:", e);
  }

  return null;
}

async function verifyPassword(pw) {
  const actual = await fetchEditKeyFromXano();
  if (!actual) return false;
  const entered = String(pw || "").trim();
  if (!entered) return false;
  return entered === actual;
}

// -------------------------
// State + normalization
// -------------------------
const state = { visibleMonths: [], rangeStartKey: null, rangeEndKey: null, minMonthKey: null, maxMonthKey: null, selectedCompanies: new Set(), rows: [], latestMonthKey: null, lastLoadedAtUtc: null };

function computeLatestMonthKey(rows) { const keys = rows.map(r => monthKeyFromYearMonthName(r.year, r.month)).filter(Boolean).sort(); return keys[keys.length-1] || null; }
function computeMinMaxMonthKey(rows) { const keys = rows.map(r => monthKeyFromYearMonthName(r.year, r.month)).filter(Boolean).sort(); return { min: keys[0] || null, max: keys[keys.length-1] || null }; }

function uniqueCompanies(rows) { const set = new Set(rows.map(r => normalizeCompanyName(r.company)).filter(Boolean)); return Array.from(set).sort(companySort); }
function findRowByCompanyAndMonth(companyName, monthKey) { return state.rows.find(r => String(r.company) === String(companyName) && monthKeyFromYearMonthName(r.year, r.month) === monthKey); }

function normalizeRow(row) {
  const r = { ...row };
  const feeObj = r.agency_fee_one_child;
  if (feeObj && typeof feeObj === "object") {
    r.agency_fee_one_child_weekly = toNumberOrNull(feeObj.Weekly ?? feeObj.weekly);
    r.agency_fee_one_child_yearly = toNumberOrNull(feeObj.Yearly ?? feeObj.yearly);
  }
  r.posts_images = readPostsImages(r) ?? 0;
  r.posts_reels = readPostsReels(r) ?? 0;
  r.posts_total = derivePostsTotal(r.posts_images, r.posts_reels);
  r.engagement_total = readEngagementTotal(r);
  r.engagement_rate_percentage = readEngagementRate(r);
  r.monthly_press_coverage = normalizeText(r.monthly_press_coverage);
  return r;
}

function getRowId(row) { const id = row?.id ?? row?.competitor_metrics_dashboard_id; return (id === null || id === undefined || id === "") ? null : id; }

// -------------------------
// Build PATCH body for virtual/nested fields
// -------------------------
function buildPatchBodyForMetric(row, fieldKey, rawNum) {
  const num = Number(rawNum);
  if (fieldKey === "agency_fee_one_child_weekly" || fieldKey === "agency_fee_one_child_yearly") {
    const rootKey = "agency_fee_one_child"; const childKey = fieldKey === "agency_fee_one_child_weekly" ? "Weekly" : "Yearly"; const current = (row && typeof row[rootKey] === "object" && row[rootKey]) ? row[rootKey] : {}; return { [rootKey]: { ...current, [childKey]: Math.round(num) } };
  }
  if (fieldKey === "posts_images" || fieldKey === "posts_reels") {
    const rootKey = "number_of_monthly_instagram_posts"; const current = (row && typeof row[rootKey] === "object" && row[rootKey]) ? row[rootKey] : {}; const next = { ...current }; if (fieldKey === "posts_images") next.image_graphic = Math.round(num); if (fieldKey === "posts_reels") next.reels_video = Math.round(num); next.number_of_monthly_instagram_posts_total = (toNumberOrNull(next.image_graphic) || 0) + (toNumberOrNull(next.reels_video) || 0); return { [rootKey]: next };
  }
  if (fieldKey === "posts_total") return null;
  if (fieldKey === "engagement_total" || fieldKey === "engagement_rate_percentage") {
    const rootKey = "monthly_instagram_engagement"; const current = (row && typeof row[rootKey] === "object" && row[rootKey]) ? row[rootKey] : {}; const next = { ...current }; if (fieldKey === "engagement_total") next.total_engagement = Math.round(num); if (fieldKey === "engagement_rate_percentage") next.engagement_rate_percentage = num; return { [rootKey]: next };
  }
  return { [fieldKey]: Math.round(num) };
}

// -------------------------
// Chart / render functions (unchanged logic)
// -------------------------
let metricChart = null;
function ensureChartMetricOptions(force = false) { const sel = document.getElementById("chartMetricSelect"); if (!sel) return; if (force || sel.options.length === 0) { const prev = sel.value; sel.innerHTML = ""; for (const m of CHART_METRICS) { const opt = document.createElement("option"); opt.value = m.key; opt.textContent = m.label; sel.appendChild(opt); } const want = prev && CHART_METRICS.some(x => x.key === prev) ? prev : (CHART_METRICS[0]?.key || ""); if (want) sel.value = want; } }
function destroyChart() { if (metricChart) { metricChart.destroy(); metricChart = null; } }
function getNumericMetricValue(row, metricKey) { if (!row) return null; if (metricKey === "number_of_monthly_instagram_posts") return extractPostsTotal(row.number_of_monthly_instagram_posts); if (metricKey === "monthly_instagram_engagement") return extractEngagementTotal(row.monthly_instagram_engagement); return toNumberOrNull(row[metricKey]); }
// renderChart defined earlier (kept same) - already present above

// -------------------------
// Modals & edit wiring (uses patchRowToBackend and reloadFromXanoAndRefresh)
// -------------------------
function openEditMetricModal({ row, fieldKey, fieldLabel, currentValue, monthKey }) {
  editModalState = { row, fieldKey, monthKey };
  const backdrop = document.getElementById("editMetricModalBackdrop");
  document.getElementById("editMetricSubtitle").textContent = `${row.company} • ${monthKey} • ${fieldLabel}`;
  document.getElementById("editMetricHint").textContent = "This updates the value in backend.";
  const input = document.getElementById("editMetricNewValue");
  input.value = (currentValue === null || currentValue === undefined) ? "" : String(currentValue);
  backdrop.style.display = "flex";
  backdrop.setAttribute("aria-hidden", "false");
  setTimeout(() => input.focus(), 0);
}
function closeEditMetricModal(){ const b=document.getElementById("editMetricModalBackdrop"); if(!b) return; b.style.display="none"; b.setAttribute("aria-hidden","true"); editModalState=null; }
function openEditTextModal({ row, fieldKey, fieldLabel, currentValue, monthKey }) { editTextModalState={row,fieldKey,monthKey}; const b=document.getElementById("editTextModalBackdrop"); if(!b) return; document.getElementById("editTextSubtitle").textContent=`${row.company} • ${monthKey} • ${fieldLabel}`; document.getElementById("editTextHint").textContent="Multiple lines supported. Ctrl+Enter saves."; const ta=document.getElementById("editTextNewValue"); if(ta) ta.value=(currentValue===null||currentValue===undefined)?"":String(currentValue); document.getElementById("editTextUpdate").dataset.mode="press"; b.style.display="flex"; b.setAttribute("aria-hidden","false"); setTimeout(()=>ta&&ta.focus(),0); }
function openEditNotesModal({ row, monthKey }) { editNotesModalState={row,monthKey}; const b=document.getElementById("editTextModalBackdrop"); if(!b) return; document.getElementById("editTextSubtitle").textContent=`${row.company} • ${monthKey} • Notes`; document.getElementById("editTextHint").textContent="Edit notes (multi-line). Ctrl+Enter saves."; const ta=document.getElementById("editTextNewValue"); if(ta) ta.value=row?.[NOTES_FIELD_KEY]??""; document.getElementById("editTextUpdate").dataset.mode="notes"; b.style.display="flex"; b.setAttribute("aria-hidden","false"); setTimeout(()=>ta&&ta.focus(),0); }
function closeEditTextModal(){ const b=document.getElementById("editTextModalBackdrop"); if(!b) return; b.style.display="none"; b.setAttribute("aria-hidden","true"); editTextModalState=null; editNotesModalState=null; document.getElementById("editTextUpdate").dataset.mode=""; }

// wireEditModals function already defined above in earlier snippet (kept unchanged)

// -------------------------
// Refresh / reload (Zapier data primary)
// -------------------------
function refresh() {
  const mount = document.getElementById("metricsDisplay");
  if (!mount) return;
  mount.innerHTML = "";

  if (!state.latestMonthKey) {
    mount.appendChild(el("p", { className: "muted", text: "No data found in backend." }));
    destroyChart();
    return;
  }

  const visibleMonths = state.visibleMonths.length ? state.visibleMonths : [state.latestMonthKey];
  const selected = uniqueCompanies(state.rows).filter(c => state.selectedCompanies.has(c));

  document.getElementById("lastUpdated").textContent = `Loaded from backend. Latest month: ${state.latestMonthKey}. Viewing: ${visibleMonths.join(", ")}.`;
  setLastUpdatedAtText();

  if (!selected.length) {
    mount.appendChild(el("p", { className: "muted", text: "No companies selected." }));
    destroyChart();
    return;
  }

  mount.appendChild(buildMetricsTable(visibleMonths, selected));
  ensureChartMetricOptions(false);
  renderChart();
  applyMetricsTableStyling();
}

async function reloadFromXanoAndRefresh() {
  const rawRows = await fetchRowsFromBackend();
  const raw = Array.isArray(rawRows) ? rawRows : (rawRows?.items || rawRows?.data || []);
  state.rows = raw.map(normalizeRow);

  state.latestMonthKey = computeLatestMonthKey(state.rows);
  const { min, max } = computeMinMaxMonthKey(state.rows);
  state.minMonthKey = min;
  state.maxMonthKey = max;
  state.lastLoadedAtUtc = new Date();

  const companies = uniqueCompanies(state.rows);
  if (state.selectedCompanies.size === 0) companies.forEach(c => state.selectedCompanies.add(c));
  else for (const c of Array.from(state.selectedCompanies)) if (!companies.includes(c)) state.selectedCompanies.delete(c);

  renderCompanyToggles(companies);

  if (!state.visibleMonths.length) {
    const defaultKey = state.latestMonthKey;
    state.visibleMonths = [defaultKey];
    state.rangeStartKey = defaultKey;
    state.rangeEndKey = defaultKey;
  }

  ensureChartMetricOptions(true);
  refresh();
}

// expose reload aliases used in UI
window.reloadFromZapierAndRefresh = reloadFromXanoAndRefresh;
window.reloadFromXanoAndRefresh = reloadFromXanoAndRefresh;

// -------------------------
// Collect / dispatch helpers (kept original Xano behavior)
// -------------------------
async function triggerCollectDispatch({ test = false } = {}) {
  const mk = lastMonthKeyUtcYYYYMM() || currentMonthKeyUTC();
  const parts = String(mk).split("-").map(s => s.trim());
  let year = String(new Date().getUTCFullYear());
  let month = String(new Date().getUTCMonth() + 1).padStart(2, "0");
  if (parts.length === 2) { year = String(parts[0]); month = String(parts[1]).padStart(2, "0"); }

  const payload = { year: Number(year), month: String(month).padStart(2, "0"), month_key: `${String(year)}-${String(month).padStart(2,"0")}`, test: !!test };
  const res = await xanoFetch("/trigger_collect", { method: "POST", body: payload, withEditKey: true });
  if (!res || !res.ok || !res.run_id) throw new Error(`Dispatch failed: ${JSON.stringify(res)}`);
  return res.run_id;
}
async function pollRunAndRefresh(runId, { intervalMs = 5000, timeoutMs = 5 * 60 * 1000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const status = await xanoFetch(`/run_status/${encodeURIComponent(runId)}`, { method: "GET", withEditKey: true });
      if (status && status.finished) {
        if (status.success) { try { await reloadFromXanoAndRefresh(); } catch (e) { console.warn("Refresh failed after run completion:", e); } return { ok: true, status }; }
        else return { ok: false, status };
      }
    } catch (err) { console.warn("pollRunAndRefresh transient error:", err); }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return { ok: false, error: "timeout" };
}

// Zapier legacy collect hook (kept)
async function triggerZapierCollectAgencyFeeSwiisLastMonth() {
  const hook = getZapierHook();
  if (hook) {
    const payload = { action: "collect_agency_fees", company: "SWIIS", month_key: lastMonthKeyUtcYYYYMM(), source_url: "https://www.swiisfostercare.com/fostering/fostering-allowance-pay/" };
    const res = await fetch(hook, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
    if (!res.ok) { const t = await res.text().catch(()=> ""); throw new Error(`Zapier hook failed (${res.status}): ${t || res.statusText}`); }
    return;
  }
  throw new Error("Missing ZAPIER_CATCH_HOOK_URL. Configure assets/config.js or set sessionStorage key 'ZAPIER_CATCH_HOOK_URL'.");
}

// -------------------------
// Test button: use Xano dispatch (test)
// -------------------------
async function sendTestPayloadToZapier() {
  const btn = document.getElementById("testZapBtn");
  const prevText = btn ? btn.textContent : null;
  try {
    if (btn) { btn.disabled = true; btn.textContent = "Sending test..."; }
    const runId = await triggerCollectDispatch({ test: true });
    alert("Test dispatch started. Run ID: " + runId + ". The scraper will run and post results to Xano.");
    console.log("Test dispatch started, runId:", runId);
  } catch (err) {
    alert("Test failed: " + String(err?.message || err));
    console.error(err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = prevText; }
  }
}

// -------------------------
// Init wiring
// -------------------------
function setLockedUI(locked) {
  const lockScreen = document.getElementById("lockScreen");
  const appRoot = document.getElementById("appRoot");
  const lockBtn = document.getElementById("lockBtn");
  if (locked) {
    lockScreen && lockScreen.classList.remove("hidden");
    appRoot && appRoot.classList.add("hidden");
    lockBtn && lockBtn.classList.add("hidden");
  } else {
    lockScreen && lockScreen.classList.add("hidden");
    appRoot && appRoot.classList.remove("hidden");
    lockBtn && lockBtn.classList.remove("hidden");
  }
}

async function attemptUnlock(password) {
  setEditKey(password);
  const ok = await verifyPassword(password);
  if (!ok) return false;
  await reloadFromXanoAndRefresh();
  return true;
}

async function init() {
  try {
    wireEditModals();
    ensureChartMetricOptions(true);
    wireChartDownloadButtons();

    const chartSelect = document.getElementById("chartMetricSelect");
    if (chartSelect) chartSelect.addEventListener("change", renderChart);

    const collectBtn = document.getElementById("collectDataBtn");
    if (collectBtn) {
      collectBtn.addEventListener("click", async () => {
        const prevText = collectBtn.textContent;
        try {
          collectBtn.disabled = true;
          collectBtn.textContent = "Collecting...";
          const runId = await triggerCollectDispatch();
          const pollResult = await pollRunAndRefresh(runId, { intervalMs: 5000, timeoutMs: 5 * 60 * 1000 });
          if (pollResult.ok) alert("Collect complete — dashboard updated.");
          else { console.warn("Collect finished with error/timeout:", pollResult); alert("Collect finished with a problem (see console)."); }
        } catch (err) {
          alert(String(err?.message || err));
        } finally {
          collectBtn.disabled = false;
          collectBtn.textContent = prevText;
        }
      });
    }

    const testBtn = document.getElementById("testZapBtn");
    if (testBtn) testBtn.addEventListener("click", sendTestPayloadToZapier);

    const pwInput = document.getElementById("pagePassword");
    if (pwInput) pwInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const unlockBtn = document.getElementById("unlockBtn"); if (unlockBtn) unlockBtn.click(); }});

    const applyRangeBtn = document.getElementById("applyRange");
    if (applyRangeBtn) applyRangeBtn.addEventListener("click", applyCustomRangeFromSelectors);

    const quickThis = document.getElementById("quickThisMonth");
    if (quickThis) quickThis.addEventListener("change", (e) => { if (e.target.checked) setQuickThisMonth(); });
    const quickLast = document.getElementById("quickLastMonth");
    if (quickLast) quickLast.addEventListener("change", (e) => { if (e.target.checked) setQuickLastMonth(); });

    const lockBtn = document.getElementById("lockBtn");
    if (lockBtn) lockBtn.addEventListener("click", () => { clearEditKey(); setLockedUI(true); });

    const unlockBtn = document.getElementById("unlockBtn");
    if (unlockBtn) {
      unlockBtn.addEventListener("click", async () => {
        const pw = (document.getElementById("pagePassword") || {}).value;
        const errMount = document.getElementById("lockError");
        if (errMount) errMount.textContent = "";
        try {
          const ok = await attemptUnlock(pw);
          if (!ok) throw new Error("Incorrect password.");
          setLockedUI(false);
          if (state.minMonthKey && state.maxMonthKey) {
            const minY = Number(state.minMonthKey.split("-")[0]);
            const maxY = Number(state.maxMonthKey.split("-")[0]);
            fillYearSelect(document.getElementById("startYear"), minY, maxY);
            fillYearSelect(document.getElementById("endYear"), minY, maxY);
            fillMonthSelect(document.getElementById("startMonth"));
            fillMonthSelect(document.getElementById("endMonth"));
            setRangeSelectorsFromKeys(state.rangeStartKey, state.rangeEndKey);
          }
        } catch (err) {
          clearEditKey();
          if (errMount) errMount.textContent = `Unlock failed: ${String(err?.message || err)}`;
        }
      });
    }

    setLockedUI(true);
  } catch (e) {
    console.error("init failed:", e);
    const lockErr = document.getElementById("lockError");
    if (lockErr) lockErr.textContent = String(e?.stack || e);
    throw e;
  }
}

// -------------------------
// Debug / console helpers
// -------------------------
window.fetchRowsFromZapier = fetchRowsFromBackend;
window.patchRowToZapier = patchRowToBackend;
window.fetchEditKeyFromXano = fetchEditKeyFromXano;
window.verifyPassword = verifyPassword;
window.reloadFromZapierAndRefresh = reloadFromXanoAndRefresh;
window.reloadFromXanoAndRefresh = reloadFromXanoAndRefresh;

// -------------------------
// Start
// -------------------------
window.addEventListener("DOMContentLoaded", () => { init().catch(err => { console.error("App init error:", err); const lockErr = document.getElementById("lockError"); if (lockErr) lockErr.textContent = String(err?.stack || err); }); });
