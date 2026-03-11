// -------------------------
// Xano config
// -------------------------
const XANO_BASE_URL = "https://x8ki-letl-twmt.n7.xano.io/api:ZvixoXZ8";
const XANO_TABLE_PATH = "/competitor_metrics_dashboard2";
const XANO_CONFIG_PATH = "/app_config";
const EDIT_KEY_NAME = "EDIT_KEY";
const SESSION_KEY = "cmd.editKey.v1";

// -------------------------
// Metrics (table columns)
// -------------------------
const METRIC_FIELDS = [
  { key: "domain_authority", label: "Authority Score", format: "int" },
  { key: "number_of_referring_domains", label: "Referring Domains", format: "int" },
  { key: "number_of_organic_keywords", label: "Organic Keywords", format: "int" },
  { key: "organic_traffic", label: "Organic Traffic (est.)", format: "int" },

  { key: "instagram_followers", label: "Instagram Followers", format: "int" },

  // Posts / month: Images & Reels editable, Total derived
  { key: "posts_images", label: "Posts / month — Images", format: "int" },
  { key: "posts_reels", label: "Posts / month — Reels", format: "int" },
  { key: "posts_total", label: "Posts / month — Total", format: "int", readOnly: true },

  // Engagement: both editable
  { key: "engagement_total", label: "Engagements / month — Total", format: "int" },
  { key: "engagement_rate_percentage", label: "Engagement rate %", format: "float" },

  { key: "agency_fee_one_child_weekly", label: "Agency Fee (1 child) / week", format: "int" },
  { key: "agency_fee_one_child_yearly", label: "Agency Fee (1 child) / year", format: "int" },

  { key: "meta_ads_running", label: "Meta Ads Running", format: "int" },

  { key: "monthly_press_coverage", label: "Monthly Press Coverage", format: "richtext", editable: true }
];

const NOTES_FIELD_KEY = "notes";

// -------------------------
// Chart metrics
// -------------------------
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
function normalizeCompanyName(name) {
  return String(name || "").trim();
}

function companySort(a, b) {
  const aa = normalizeCompanyName(a);
  const bb = normalizeCompanyName(b);
  const aIsSwiis = aa.toLowerCase() === "swiis";
  const bIsSwiis = bb.toLowerCase() === "swiis";
  if (aIsSwiis && !bIsSwiis) return -1;
  if (!aIsSwiis && bIsSwiis) return 1;
  return aa.localeCompare(bb);
}

const COMPANY_COLORS = {
  swiis: "#ef5d2f",
  capstone: "#0d66a2",
  compass: "#1897d3",
  fca: "#f27a30",
  nfa: "#f9ae42",
  "orange grove": "#51277d",
  orangegrove: "#51277d",
  tact: "#b22288"
};

function companyColor(company) {
  const key = normalizeCompanyName(company).toLowerCase();
  if (COMPANY_COLORS[key]) return COMPANY_COLORS[key];

  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 45%)`;
}

// -------------------------
// DOM helpers
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

// -------------------------
// Formatting + parsing
// -------------------------
function toNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function normalizeText(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function formatValue(v, format) {
  if (v === null || v === undefined || v === "") return "—";

  if (format === "int") {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return Math.round(n).toLocaleString();
  }

  if (format === "float") {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    const fixed = n.toFixed(2);
    return fixed.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  }

  return String(v);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function linkifyTextToHtml(text) {
  if (text === null || text === undefined) return "";
  const safe = escapeHtml(String(text));
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const withLinks = safe.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
  return withLinks.replaceAll("\n", "<br>");
}

// -------------------------
// Object helpers (posts + engagement)
// -------------------------
function getObj(root) {
  return root && typeof root === "object" ? root : {};
}

function readPostsImages(row) {
  return toNumberOrNull(getObj(row?.number_of_monthly_instagram_posts).image_graphic);
}
function readPostsReels(row) {
  return toNumberOrNull(getObj(row?.number_of_monthly_instagram_posts).reels_video);
}
function derivePostsTotal(images, reels) {
  return (toNumberOrNull(images) ?? 0) + (toNumberOrNull(reels) ?? 0);
}

function readEngagementTotal(row) {
  return toNumberOrNull(getObj(row?.monthly_instagram_engagement).total_engagement);
}
function readEngagementRate(row) {
  return toNumberOrNull(getObj(row?.monthly_instagram_engagement).engagement_rate_percentage);
}

// -------------------------
// Extract totals for charts/averages
// -------------------------
function extractPostsTotal(obj) {
  if (!obj || typeof obj !== "object") return toNumberOrNull(obj);
  return toNumberOrNull(obj.number_of_monthly_instagram_posts_total ?? obj.Total ?? obj.total ?? obj.total_posts);
}

function extractEngagementTotal(obj) {
  if (!obj || typeof obj !== "object") return toNumberOrNull(obj);
  return toNumberOrNull(obj.total_engagement ?? obj.Total ?? obj.total ?? obj.totalEngagement);
}

// -------------------------
// Month helpers
// -------------------------
const MONTHS = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12"
};

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

function monthKeyFromYYYYMMParts(year, mm) {
  return `${String(year).trim()}-${String(mm).padStart(2, "0")}`;
}

function parseMonthKey(mk) {
  if (!mk || typeof mk !== "string" || mk.length < 7) return null;
  const [y, m] = mk.split("-");
  return { year: Number(y), month: String(m).padStart(2, "0") };
}

function compareMonthKey(a, b) {
  return String(a).localeCompare(String(b));
}

function listMonthKeysBetween(startKey, endKey) {
  const s = parseMonthKey(startKey);
  const e = parseMonthKey(endKey);
  if (!s || !e) return [];

  const start = new Date(Date.UTC(s.year, Number(s.month) - 1, 1));
  const end = new Date(Date.UTC(e.year, Number(e.month) - 1, 1));
  if (start > end) return [];

  const out = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}`);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
}

function currentMonthKeyUTC() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function previousMonthKeyUTC(monthKey) {
  const p = parseMonthKey(monthKey);
  if (!p) return null;
  const dt = new Date(Date.UTC(p.year, Number(p.month) - 1, 1));
  dt.setUTCMonth(dt.getUTCMonth() - 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

// -------------------------
// Session + Xano
// -------------------------
function getEditKey() { return sessionStorage.getItem(SESSION_KEY) || ""; }
function setEditKey(k) { sessionStorage.setItem(SESSION_KEY, k); }
function clearEditKey() { sessionStorage.removeItem(SESSION_KEY); }

async function xanoFetch(path, { method = "GET", body = null, withEditKey = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (withEditKey) {
    const key = getEditKey();
    if (key) headers["x-edit-key"] = key;
  }

  const res = await fetch(`${XANO_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Xano error ${res.status}: ${text || res.statusText}`);
  }
  return await res.json();
}

async function fetchEditKeyFromXano() {
  const res = await xanoFetch(XANO_CONFIG_PATH, { method: "GET", withEditKey: false });
  const rows = Array.isArray(res) ? res : (res?.items || res?.data || []);
  const row = rows.find(r => String(r.key || "").trim() === EDIT_KEY_NAME);
  const value = row?.value;
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

async function verifyPassword(pw) {
  const actual = await fetchEditKeyFromXano();
  if (!actual) return false;
  const entered = String(pw || "").trim();
  if (!entered) return false;
  return entered === actual;
}

// -------------------------
// State
// -------------------------
const state = {
  visibleMonths: [],
  rangeStartKey: null,
  rangeEndKey: null,
  minMonthKey: null,
  maxMonthKey: null,
  selectedCompanies: new Set(),
  rows: [],
  latestMonthKey: null,
  lastLoadedAtUtc: null
};

function computeLatestMonthKey(rows) {
  const keys = rows.map(r => monthKeyFromYearMonthName(r.year, r.month)).filter(Boolean).sort();
  return keys[keys.length - 1] || null;
}

function computeMinMaxMonthKey(rows) {
  const keys = rows.map(r => monthKeyFromYearMonthName(r.year, r.month)).filter(Boolean).sort();
  return { min: keys[0] || null, max: keys[keys.length - 1] || null };
}

function uniqueCompanies(rows) {
  const set = new Set(rows.map(r => normalizeCompanyName(r.company)).filter(Boolean));
  return Array.from(set).sort(companySort);
}

function renderCompanyToggles(companies) {
  const mount = document.getElementById("companyToggle");
  mount.innerHTML = "";
  for (const name of companies) {
    const id = `cmp_${name.replace(/\s+/g, "_")}`;
    const checkbox = el("input", { type: "checkbox", id });
    checkbox.checked = state.selectedCompanies.has(name);

    checkbox.addEventListener("change", () => {
      checkbox.checked ? state.selectedCompanies.add(name) : state.selectedCompanies.delete(name);
      refresh();
    });

    mount.appendChild(el("div", { className: "toggle" }, [
      checkbox,
      el("label", { for: id, text: name })
    ]));
  }
}

function findRowByCompanyAndMonth(companyName, monthKey) {
  return state.rows.find(r => String(r.company) === String(companyName) && monthKeyFromYearMonthName(r.year, r.month) === monthKey);
}

function normalizeRow(row) {
  const r = { ...row };

  // derived fee fields from object
  const feeObj = r.agency_fee_one_child;
  if (feeObj && typeof feeObj === "object") {
    r.agency_fee_one_child_weekly = toNumberOrNull(feeObj.Weekly ?? feeObj.weekly);
    r.agency_fee_one_child_yearly = toNumberOrNull(feeObj.Yearly ?? feeObj.yearly);
  }

  // posts virtual columns (derive total for UI)
  r.posts_images = readPostsImages(r) ?? 0;
  r.posts_reels = readPostsReels(r) ?? 0;
  r.posts_total = derivePostsTotal(r.posts_images, r.posts_reels);

  // engagement virtual columns
  r.engagement_total = readEngagementTotal(r);
  r.engagement_rate_percentage = readEngagementRate(r);

  r.monthly_press_coverage = normalizeText(r.monthly_press_coverage);

  return r;
}

function getRowId(row) {
  const id = row?.id ?? row?.competitor_metrics_dashboard_id;
  return (id === null || id === undefined || id === "") ? null : id;
}

// -------------------------
// Build PATCH bodies for virtual fields
// -------------------------
function buildPatchBodyForMetric(row, fieldKey, rawNum) {
  const num = Number(rawNum);

  // Agency fee virtual fields -> patch agency_fee_one_child object
  if (fieldKey === "agency_fee_one_child_weekly" || fieldKey === "agency_fee_one_child_yearly") {
    const rootKey = "agency_fee_one_child";
    const childKey = fieldKey === "agency_fee_one_child_weekly" ? "Weekly" : "Yearly";
    const current = (row && typeof row[rootKey] === "object" && row[rootKey]) ? row[rootKey] : {};
    return { [rootKey]: { ...current, [childKey]: Math.round(num) } };
  }

  // Posts: images/reels editable; always update total automatically in Xano.
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

  // Total is derived -> no PATCH from UI
  if (fieldKey === "posts_total") return null;

  // Engagement: editable total + rate
  if (fieldKey === "engagement_total" || fieldKey === "engagement_rate_percentage") {
    const rootKey = "monthly_instagram_engagement";
    const current = (row && typeof row[rootKey] === "object" && row[rootKey]) ? row[rootKey] : {};
    const next = { ...current };

    if (fieldKey === "engagement_total") next.total_engagement = Math.round(num);
    if (fieldKey === "engagement_rate_percentage") next.engagement_rate_percentage = num;

    return { [rootKey]: next };
  }

  // Default: patch top-level numeric fields (rounded)
  return { [fieldKey]: Math.round(num) };
}

// -------------------------
// Last-updated + chart download UI helpers (NO HTML changes needed)
// -------------------------
function formatUtcTimestamp(dt) {
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const hh = String(dt.getUTCHours()).padStart(2, "0");
  const mi = String(dt.getUTCMinutes()).padStart(2, "0");
  const ss = String(dt.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} UTC`;
}

function ensureLastUpdatedRightOfViewingInfo() {
  const host = document.getElementById("lastUpdated");
  if (!host) return;

  // Turn host into a flex row: left = existing text, right = last-updated timestamp
  if (!host.dataset.enhanced) {
    host.dataset.enhanced = "1";
    host.style.display = "flex";
    host.style.justifyContent = "space-between";
    host.style.gap = "12px";

    const left = document.createElement("span");
    left.id = "viewingInfo";
    left.style.flex = "1 1 auto";

    const right = document.createElement("span");
    right.id = "lastUpdatedAt";
    right.style.flex = "0 0 auto";
    right.style.whiteSpace = "nowrap";
    right.style.opacity = "0.85";

    // move existing text into left
    left.textContent = host.textContent || "";
    host.textContent = "";
    host.appendChild(left);
    host.appendChild(right);
  }
}

function setViewingAndLastUpdatedText(viewingText) {
  ensureLastUpdatedRightOfViewingInfo();

  const left = document.getElementById("viewingInfo") || document.getElementById("lastUpdated");
  if (left) left.textContent = viewingText;

  const right = document.getElementById("lastUpdatedAt");
  if (right) {
    right.textContent = state.lastLoadedAtUtc
      ? `Last updated: ${formatUtcTimestamp(state.lastLoadedAtUtc)}`
      : "";
  }
}

function downloadDataUrl(filename, dataUrl) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadChartAs(type) {
  const canvas = document.getElementById("metricChart");
  if (!canvas) return alert("Chart not found.");
  const ext = type === "image/jpeg" ? "jpg" : "png";
  const dataUrl = canvas.toDataURL(type, 0.92);
  downloadDataUrl(`chart.${ext}`, dataUrl);
}

function downloadChartPdfViaPrint() {
  const canvas = document.getElementById("metricChart");
  if (!canvas) return alert("Chart not found.");

  const img = canvas.toDataURL("image/png");
  const w = window.open("", "_blank");
  if (!w) return alert("Popup blocked. Allow popups to download PDF.");

  w.document.open();
  w.document.write(`
<!doctype html>
<html>
  <head>
    <title>Chart</title>
    <style>
      body { margin: 0; padding: 24px; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      img { max-width: 100%; height: auto; }
      .hint { margin-top: 12px; opacity: 0.7; font-size: 12px; }
    </style>
  </head>
  <body>
    <img src="${img}" />
    <div class="hint">Use your browser Print (Ctrl+P) and choose “Save as PDF”.</div>
  </body>
</html>
  `);
  w.document.close();
  w.focus();
}

function ensureChartDownloadButtons() {
  const canvas = document.getElementById("metricChart");
  if (!canvas) return;

  // Only insert once
  if (document.getElementById("chartDownloadButtons")) return;

  const wrap = document.createElement("div");
  wrap.id = "chartDownloadButtons";
  wrap.style.display = "inline-flex";
  wrap.style.gap = "8px";
  wrap.style.marginLeft = "12px";
  wrap.style.alignItems = "center";
  wrap.style.flexWrap = "wrap";

  const mkBtn = (id, text, onClick) => {
    const b = document.createElement("button");
    b.id = id;
    b.type = "button";
    b.textContent = text;
    b.style.padding = "6px 10px";
    b.style.border = "1px solid #d0d0d0";
    b.style.borderRadius = "8px";
    b.style.background = "#fff";
    b.style.cursor = "pointer";
    b.addEventListener("click", onClick);
    return b;
  };

  wrap.appendChild(mkBtn("downloadChartPng", "Download PNG", () => downloadChartAs("image/png")));
  wrap.appendChild(mkBtn("downloadChartJpg", "Download JPG", () => downloadChartAs("image/jpeg")));
  wrap.appendChild(mkBtn("downloadChartPdf", "PDF (Print)", downloadChartPdfViaPrint));

  // Try to place next to metric select if available
  const metricSelect = document.getElementById("chartMetricSelect");
  if (metricSelect && metricSelect.parentElement) {
    metricSelect.parentElement.appendChild(wrap);
    return;
  }

  // Otherwise, place above canvas
  const parent = canvas.parentElement;
  if (parent) parent.insertBefore(wrap, canvas);
}

// -------------------------
// Modals
// -------------------------
let editModalState = null;
let editTextModalState = null;
let editNotesModalState = null;

function openEditMetricModal({ row, fieldKey, fieldLabel, currentValue, monthKey }) {
  editModalState = { row, fieldKey, monthKey };

  const backdrop = document.getElementById("editMetricModalBackdrop");
  document.getElementById("editMetricSubtitle").textContent = `${row.company} • ${monthKey} • ${fieldLabel}`;
  document.getElementById("editMetricHint").textContent = "This updates the value in Xano.";

  const input = document.getElementById("editMetricNewValue");
  input.value = (currentValue === null || currentValue === undefined) ? "" : String(currentValue);

  backdrop.style.display = "flex";
  backdrop.setAttribute("aria-hidden", "false");
  setTimeout(() => input.focus(), 0);
}

function closeEditMetricModal() {
  const backdrop = document.getElementById("editMetricModalBackdrop");
  backdrop.style.display = "none";
  backdrop.setAttribute("aria-hidden", "true");
  editModalState = null;
}

function openEditTextModal({ row, fieldKey, fieldLabel, currentValue, monthKey }) {
  editTextModalState = { row, fieldKey, monthKey };

  const backdrop = document.getElementById("editTextModalBackdrop");
  document.getElementById("editTextSubtitle").textContent = `${row.company} • ${monthKey} • ${fieldLabel}`;
  document.getElementById("editTextHint").textContent = "Multiple lines supported. Ctrl+Enter saves.";

  const textarea = document.getElementById("editTextNewValue");
  textarea.value = (currentValue === null || currentValue === undefined) ? "" : String(currentValue);

  document.getElementById("editTextUpdate").dataset.mode = "press";

  backdrop.style.display = "flex";
  backdrop.setAttribute("aria-hidden", "false");
  setTimeout(() => textarea.focus(), 0);
}

function openEditNotesModal({ row, monthKey }) {
  editNotesModalState = { row, monthKey };

  const backdrop = document.getElementById("editTextModalBackdrop");
  document.getElementById("editTextSubtitle").textContent = `${row.company} • ${monthKey} • Notes`;
  document.getElementById("editTextHint").textContent = "Edit notes (multi-line). Ctrl+Enter saves.";

  const textarea = document.getElementById("editTextNewValue");
  textarea.value = row?.[NOTES_FIELD_KEY] ?? "";

  document.getElementById("editTextUpdate").dataset.mode = "notes";

  backdrop.style.display = "flex";
  backdrop.setAttribute("aria-hidden", "false");
  setTimeout(() => textarea.focus(), 0);
}

function closeEditTextModal() {
  const backdrop = document.getElementById("editTextModalBackdrop");
  backdrop.style.display = "none";
  backdrop.setAttribute("aria-hidden", "true");
  editTextModalState = null;
  editNotesModalState = null;
  document.getElementById("editTextUpdate").dataset.mode = "";
}

function wireEditModals() {
  document.getElementById("editMetricClose").addEventListener("click", closeEditMetricModal);
  document.getElementById("editMetricModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "editMetricModalBackdrop") closeEditMetricModal();
  });

  document.getElementById("editTextClose").addEventListener("click", closeEditTextModal);
  document.getElementById("editTextModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "editTextModalBackdrop") closeEditTextModal();
  });

  document.getElementById("editMetricNewValue").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("editMetricUpdate").click();
    }
  });

  document.getElementById("editTextNewValue").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      document.getElementById("editTextUpdate").click();
    }
  });

  document.getElementById("editMetricUpdate").addEventListener("click", async () => {
    if (!editModalState) return;

    const btn = document.getElementById("editMetricUpdate");
    const raw = document.getElementById("editMetricNewValue").value;

    if (raw === "" || raw === null || raw === undefined) return alert("Enter a value.");

    const num = Number(raw);
    if (!Number.isFinite(num)) return alert("Please enter a valid number.");

    const { row, fieldKey } = editModalState;
    const rowId = getRowId(row);
    if (!rowId) return alert("Missing record id.");

    try {
      btn.disabled = true;
      btn.textContent = "Saving...";

      const body = buildPatchBodyForMetric(row, fieldKey, num);
      if (!body) {
        alert("Total is derived. Edit Images or Reels.");
        return;
      }

      await xanoFetch(`${XANO_TABLE_PATH}/${rowId}`, {
        method: "PATCH",
        body,
        withEditKey: true
      });

      closeEditMetricModal();
      await reloadFromXanoAndRefresh();
    } catch (err) {
      alert(`Save failed: ${String(err?.message || err)}`);
    } finally {
      btn.disabled = false;
      btn.textContent = "Update";
    }
  });

  document.getElementById("editTextUpdate").addEventListener("click", async () => {
    const mode = document.getElementById("editTextUpdate").dataset.mode || "";
    const btn = document.getElementById("editTextUpdate");
    const val = document.getElementById("editTextNewValue").value;
    const payloadVal = (val === "" ? null : val);

    try {
      btn.disabled = true;
      btn.textContent = "Saving...";

      if (mode === "press") {
        const row = editTextModalState?.row;
        const rowId = getRowId(row);
        if (!rowId) return alert("Missing record id.");

        await xanoFetch(`${XANO_TABLE_PATH}/${rowId}`, {
          method: "PATCH",
          body: { monthly_press_coverage: payloadVal },
          withEditKey: true
        });

        closeEditTextModal();
        await reloadFromXanoAndRefresh();
        return;
      }

      if (mode === "notes") {
        const row = editNotesModalState?.row;
        const rowId = getRowId(row);
        if (!rowId) return alert("Missing record id.");

        await xanoFetch(`${XANO_TABLE_PATH}/${rowId}`, {
          method: "PATCH",
          body: { [NOTES_FIELD_KEY]: payloadVal },
          withEditKey: true
        });

        closeEditTextModal();
        await reloadFromXanoAndRefresh();
        return;
      }
    } catch (err) {
      alert(`Save failed: ${String(err?.message || err)}`);
    } finally {
      btn.disabled = false;
      btn.textContent = "Update";
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (editModalState) closeEditMetricModal();
    if (editTextModalState || editNotesModalState) closeEditTextModal();
  });
}

// -------------------------
// Multi-month averaging
// -------------------------
function averageNumericForCompanyAcrossMonths(companyName, monthKeys, fieldKey) {
  const vals = monthKeys
    .map(mk => findRowByCompanyAndMonth(companyName, mk))
    .map(r => {
      if (!r) return null;
      if (fieldKey === "number_of_monthly_instagram_posts") return extractPostsTotal(r.number_of_monthly_instagram_posts);
      if (fieldKey === "monthly_instagram_engagement") return extractEngagementTotal(r.monthly_instagram_engagement);
      return toNumberOrNull(r[fieldKey]);
    })
    .filter(v => v !== null);

  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// -------------------------
// Table rendering
// -------------------------
function buildMetricsTable(visibleMonths, companies) {
  const table = el("table");
  const thead = el("thead");
  const trh = el("tr");

  trh.appendChild(el("th", { text: "Company" }));
  trh.appendChild(el("th", { text: "Month(s)" }));
  for (const f of METRIC_FIELDS) trh.appendChild(el("th", { text: f.label }));
  trh.appendChild(el("th", { text: "Notes" }));

  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = el("tbody");
  const singleMonth = visibleMonths.length === 1;

  for (const companyName of companies) {
    const tr = el("tr");
    tr.appendChild(el("td", { text: companyName }));
    tr.appendChild(el("td", { text: singleMonth ? visibleMonths[0] : `${visibleMonths.length} months` }));

    for (const f of METRIC_FIELDS) {
      let displayValue = null;
      let editTargetRow = null;
      let editMonthKey = null;

      if (singleMonth) {
        editMonthKey = visibleMonths[0];
        editTargetRow = findRowByCompanyAndMonth(companyName, editMonthKey);
        displayValue = editTargetRow ? editTargetRow[f.key] : null;
      } else {
        if (f.format === "int" || f.format === "float") displayValue = averageNumericForCompanyAcrossMonths(companyName, visibleMonths, f.key);
        else displayValue = null;
      }

      const td = el("td");

      if (f.format === "richtext") {
        const html = displayValue ? linkifyTextToHtml(displayValue) : "—";
        const div = el("div", {
          className: `clickable-metric metrics-rich${(!displayValue ? " muted-cell" : "")}`,
          html,
          title: singleMonth ? "Click to edit" : "Shown only in single-month view"
        });

        if (singleMonth && editTargetRow && f.editable) {
          div.addEventListener("click", (e) => {
            if (e.target && e.target.closest && e.target.closest("a")) return;
            openEditTextModal({
              row: editTargetRow,
              fieldKey: f.key,
              fieldLabel: f.label,
              currentValue: editTargetRow[f.key],
              monthKey: editMonthKey
            });
          });
        }

        td.appendChild(div);
        tr.appendChild(td);
        continue;
      }

      const isEmpty = displayValue === null || displayValue === undefined || displayValue === "";
      const span = el("span", {
        className: `clickable-metric metrics-num${isEmpty ? " muted-cell" : ""}`,
        text: formatValue(displayValue, f.format),
        title: singleMonth ? (f.readOnly ? "Derived (edit Images/Reels)" : "Click to edit") : "Averaged across selected months"
      });

      if (singleMonth && editTargetRow && !f.readOnly) {
        span.addEventListener("click", () => {
          openEditMetricModal({
            row: editTargetRow,
            fieldKey: f.key,
            fieldLabel: f.label,
            currentValue: editTargetRow[f.key],
            monthKey: editMonthKey
          });
        });
      }

      td.appendChild(span);
      tr.appendChild(td);
    }

    // Notes cell
    const notesTd = el("td");
    let notesRow = null;
    let mk = null;
    if (singleMonth) {
      mk = visibleMonths[0];
      notesRow = findRowByCompanyAndMonth(companyName, mk);
    }

    const notesText = singleMonth ? (notesRow?.[NOTES_FIELD_KEY] ?? "") : "";
    const notesPreview = normalizeText(notesText) ? linkifyTextToHtml(notesText) : "—";

    const notesDiv = el("div", {
      className: `clickable-metric metrics-rich${(normalizeText(notesText) ? "" : " muted-cell")}`,
      html: notesPreview,
      title: singleMonth ? "Click to edit notes" : "Switch to a single month to edit notes"
    });

    if (singleMonth && notesRow) {
      notesDiv.addEventListener("click", (e) => {
        if (e.target && e.target.closest && e.target.closest("a")) return;
        openEditNotesModal({ row: notesRow, monthKey: mk });
      });
    }

    notesTd.appendChild(notesDiv);
    tr.appendChild(notesTd);

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  return table;
}

// -------------------------
// Chart.js
// -------------------------
let metricChart = null;

function getNumericMetricValue(row, metricKey) {
  if (!row) return null;
  if (metricKey === "number_of_monthly_instagram_posts") return extractPostsTotal(row.number_of_monthly_instagram_posts);
  if (metricKey === "monthly_instagram_engagement") return extractEngagementTotal(row.monthly_instagram_engagement);
  return toNumberOrNull(row[metricKey]);
}

function ensureChartMetricOptions(force = false) {
  const sel = document.getElementById("chartMetricSelect");
  if (!sel) return;

  if (force || sel.options.length === 0) {
    const prev = sel.value;
    sel.innerHTML = "";
    for (const m of CHART_METRICS) {
      const opt = document.createElement("option");
      opt.value = m.key;
      opt.textContent = m.label;
      sel.appendChild(opt);
    }
    const want = prev && CHART_METRICS.some(x => x.key === prev) ? prev : (CHART_METRICS[0]?.key || "");
    if (want) sel.value = want;
  }
}

function destroyChart() {
  if (metricChart) {
    metricChart.destroy();
    metricChart = null;
  }
}

function renderChart() {
  const canvas = document.getElementById("metricChart");
  const sel = document.getElementById("chartMetricSelect");
  const modeLabel = document.getElementById("chartModeLabel");
  if (!canvas || !sel || typeof Chart === "undefined") return;

  ensureChartDownloadButtons();

  if (sel.options.length === 0) ensureChartMetricOptions(true);

  const metricKey = sel.value;
  if (!metricKey) return;

  const metricLabel = CHART_METRICS.find(m => m.key === metricKey)?.label || metricKey;

  const visibleMonths = state.visibleMonths.length ? state.visibleMonths : (state.latestMonthKey ? [state.latestMonthKey] : []);
  if (!visibleMonths.length) return;

  const singleMonth = visibleMonths.length === 1;
  const companies = uniqueCompanies(state.rows).filter(c => state.selectedCompanies.has(c));

  if (modeLabel) {
    modeLabel.textContent = singleMonth
      ? `(Bar • ${visibleMonths[0]})`
      : `(Line • ${visibleMonths[0]} → ${visibleMonths[visibleMonths.length - 1]})`;
  }

  destroyChart();

  if (singleMonth) {
    const mk = visibleMonths[0];
    const values = companies.map(c => getNumericMetricValue(findRowByCompanyAndMonth(c, mk), metricKey) ?? 0);
    const colors = companies.map(companyColor);

    metricChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: companies,
        datasets: [{
          label: metricLabel,
          data: values,
          backgroundColor: colors
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        scales: { y: { beginAtZero: true } }
      }
    });
  } else {
    const datasets = companies.map((c) => {
      const data = visibleMonths.map(mk => getNumericMetricValue(findRowByCompanyAndMonth(c, mk), metricKey) ?? 0);
      const color = companyColor(c);
      return {
        label: c,
        data,
        tension: 0.25,
        borderColor: color,
        backgroundColor: color
      };
    });

    metricChart = new Chart(canvas, {
      type: "line",
      data: { labels: visibleMonths, datasets },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }
}

// -------------------------
// Styling
// -------------------------
function applyMetricsTableStyling() {
  const root = document.getElementById("metricsDisplay");
  const table = root?.querySelector("table");
  if (!table) return;

  root.querySelectorAll(".clickable-metric").forEach((n) => {
    n.style.textDecoration = "none";
  });

  table.querySelectorAll("td").forEach((td) => {
    td.style.textAlign = "center";
    td.style.verticalAlign = "middle";
  });

  table.querySelectorAll("tr").forEach((tr) => {
    const tds = tr.querySelectorAll("td");
    if (tds[0]) tds[0].style.textAlign = "left";
    if (tds[1]) tds[1].style.textAlign = "left";
  });

  table.querySelectorAll("td").forEach((td) => {
    if (td.querySelector(".metrics-rich")) td.style.textAlign = "left";
  });
}

// -------------------------
// Refresh / load / init
// -------------------------
function refresh() {
  const mount = document.getElementById("metricsDisplay");
  mount.innerHTML = "";

  if (!state.latestMonthKey) {
    mount.appendChild(el("p", { className: "muted", text: "No data found in Xano." }));
    destroyChart();
    return;
  }

  const visibleMonths = state.visibleMonths.length ? state.visibleMonths : [state.latestMonthKey];
  const selected = uniqueCompanies(state.rows).filter(c => state.selectedCompanies.has(c));

  const viewingText =
    `Loaded from Xano. Latest month in Xano: ${state.latestMonthKey}. Viewing: ${visibleMonths.join(", ")}.`;
  setViewingAndLastUpdatedText(viewingText);

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
  const rows = await xanoFetch(XANO_TABLE_PATH, { method: "GET", withEditKey: false });
  const raw = Array.isArray(rows) ? rows : (rows?.items || rows?.data || []);
  state.rows = raw.map(normalizeRow);

  state.latestMonthKey = computeLatestMonthKey(state.rows);
  const { min, max } = computeMinMaxMonthKey(state.rows);
  state.minMonthKey = min;
  state.maxMonthKey = max;

  state.lastLoadedAtUtc = new Date(); // timestamp of when the UI loaded/refreshed

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

function setLockedUI(locked) {
  const lockScreen = document.getElementById("lockScreen");
  const appRoot = document.getElementById("appRoot");
  const lockBtn = document.getElementById("lockBtn");
  if (locked) {
    lockScreen.classList.remove("hidden");
    appRoot.classList.add("hidden");
    lockBtn.classList.add("hidden");
  } else {
    lockScreen.classList.add("hidden");
    appRoot.classList.remove("hidden");
    lockBtn.classList.add("hidden"); // keep original behavior if you intended it
    lockBtn.classList.remove("hidden"); // show lock button when unlocked
  }
}

async function attemptUnlock(password) {
  setEditKey(password);
  const ok = await verifyPassword(password);
  if (!ok) {
    clearEditKey();
    throw new Error("Incorrect password.");
  }
  await reloadFromXanoAndRefresh();
}

// time range UI
function fillMonthSelect(selectEl) {
  selectEl.innerHTML = "";
  for (const m of MONTH_LABELS) {
    const opt = document.createElement("option");
    opt.value = m.value;
    opt.textContent = m.name;
    selectEl.appendChild(opt);
  }
}

function fillYearSelect(selectEl, minYear, maxYear) {
  selectEl.innerHTML = "";
  for (let y = minYear; y <= maxYear; y++) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    selectEl.appendChild(opt);
  }
}

function setRangeSelectorsFromKeys(startKey, endKey) {
  const s = parseMonthKey(startKey);
  const e = parseMonthKey(endKey);
  if (!s || !e) return;
  document.getElementById("startYear").value = String(s.year);
  document.getElementById("startMonth").value = s.month;
  document.getElementById("endYear").value = String(e.year);
  document.getElementById("endMonth").value = e.month;
}

function applyCustomRangeFromSelectors() {
  const startKey = monthKeyFromYYYYMMParts(
    document.getElementById("startYear").value,
    document.getElementById("startMonth").value
  );
  const endKey = monthKeyFromYYYYMMParts(
    document.getElementById("endYear").value,
    document.getElementById("endMonth").value
  );
  if (compareMonthKey(startKey, endKey) > 0) return alert("Start month must be before (or the same as) End month.");

  document.getElementById("quickThisMonth").checked = false;
  document.getElementById("quickLastMonth").checked = false;

  state.rangeStartKey = startKey;
  state.rangeEndKey = endKey;
  state.visibleMonths = listMonthKeysBetween(startKey, endKey);

  refresh();
}

function setQuickThisMonth() {
  document.getElementById("quickLastMonth").checked = false;
  const key = currentMonthKeyUTC();
  state.rangeStartKey = key;
  state.rangeEndKey = key;
  state.visibleMonths = [key];
  setRangeSelectorsFromKeys(key, key);
  refresh();
}

function setQuickLastMonth() {
  document.getElementById("quickThisMonth").checked = false;
  const thisKey = currentMonthKeyUTC();
  const lastKey = previousMonthKeyUTC(thisKey);
  state.rangeStartKey = lastKey;
  state.rangeEndKey = lastKey;
  state.visibleMonths = [lastKey];
  setRangeSelectorsFromKeys(lastKey, lastKey);
  refresh();
}

// -------------------------
// Init
// -------------------------
async function init() {
  wireEditModals();
  ensureChartMetricOptions(true);

  const chartSelect = document.getElementById("chartMetricSelect");
  if (chartSelect) chartSelect.addEventListener("change", renderChart);

  // Enter = Unlock
  const pw = document.getElementById("pagePassword");
  if (pw) {
    pw.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("unlockBtn").click();
      }
    });
  }

  const applyRangeBtn = document.getElementById("applyRange");
  if (applyRangeBtn) applyRangeBtn.addEventListener("click", applyCustomRangeFromSelectors);

  const thisMonth = document.getElementById("quickThisMonth");
  if (thisMonth) thisMonth.addEventListener("change", (e) => { if (e.target.checked) setQuickThisMonth(); });

  const lastMonth = document.getElementById("quickLastMonth");
  if (lastMonth) lastMonth.addEventListener("change", (e) => { if (e.target.checked) setQuickLastMonth(); });

  const lockBtn = document.getElementById("lockBtn");
  if (lockBtn) {
    lockBtn.addEventListener("click", () => {
      clearEditKey();
      setLockedUI(true);
    });
  }

  const unlockBtn = document.getElementById("unlockBtn");
  if (unlockBtn) {
    unlockBtn.addEventListener("click", async () => {
      const pwVal = document.getElementById("pagePassword").value;
      const errMount = document.getElementById("lockError");
      if (errMount) errMount.textContent = "";

      try {
        await attemptUnlock(pwVal);
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
}

function showFatal(err) {
  console.error(err);
  const lockErr = document.getElementById("lockError");
  if (lockErr) lockErr.textContent = String(err?.stack || err);
}

window.addEventListener("DOMContentLoaded", () => {
  init().catch(showFatal);
});
