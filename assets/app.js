// -------------------------
// Xano config
// -------------------------
const XANO_BASE_URL = "https://x8ki-letl-twmt.n7.xano.io/api:ZvixoXZ8";
const XANO_TABLE_PATH = "/competitor_metrics_dashboard";
const XANO_CONFIG_PATH = "/app_config";
const EDIT_KEY_NAME = "EDIT_KEY";
const SESSION_KEY = "cmd.editKey.v1";

// Which fields to show/edit
const METRIC_FIELDS = [
  { key: "domain_authority", label: "Authority Score", format: "int" },
  { key: "number_of_referring_domains", label: "Referring Domains", format: "int" },
  { key: "number_of_organic_keywords", label: "Organic Keywords", format: "int" },
  { key: "organic_traffic", label: "Organic Traffic (est.)", format: "int" },
  { key: "instagram_followers", label: "Followers", format: "int" },

  // Display-only formatted strings derived from objects
  { key: "number_of_monthly_instagram_posts_display", label: "Posts / month", format: "richtext" },
  { key: "monthly_instagram_engagement_display", label: "Engagements / month", format: "richtext" },

  { key: "agency_fee_one_child_weekly", label: "Agency Fee (1 child) / week", format: "int" },
  { key: "agency_fee_one_child_yearly", label: "Agency Fee (1 child) / year", format: "int" },

  { key: "meta_ads_running", label: "Meta Ads Running", format: "int" },

  // Editable rich text (multi-line + clickable links)
  { key: "monthly_press_coverage", label: "Monthly Press Coverage", format: "richtext", editable: true }
];

const NOTES_FIELD_KEY = "notes";

// -------------------------
// Utilities
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

function formatPercent(v) {
  const n = toNumberOrNull(v);
  if (n === null) return null;
  return `${String(n)}%`;
}

function formatValue(v, format) {
  if (v === null || v === undefined || v === "") return "—";

  if (format === "int") {
    const n = Number(v);
    if (Number.isNaN(n)) return "—";
    return n.toLocaleString();
  }

  if (format === "richtext") {
    // richtext will be inserted as HTML elsewhere; fallback to string for CSV/export
    return String(v);
  }

  return String(v);
}

// Convert multiline text with URLs into safe clickable HTML
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
  // Preserve newlines
  return withLinks.replaceAll("\n", "<br>");
}

// Instagram formatting
function formatPostsBreakdown(obj) {
  if (!obj || typeof obj !== "object") return null;

  // Your Xano keys (from screenshots) appear as:
  // Image, reels_video, number_of_monthly_instagram_posts_total
  const images = toNumberOrNull(
    obj.Images ?? obj.images ?? obj.Image ?? obj.image ?? obj.image_total ?? obj.images_total
  );
  const reels = toNumberOrNull(
    obj.Reels ?? obj.reels ?? obj.reels_video ?? obj.reel ?? obj.reelsVideo
  );
  const total = toNumberOrNull(
    obj.Total ?? obj.total ?? obj.number_of_monthly_instagram_posts_total ?? obj.total_posts
  );

  const parts = [];
  if (images !== null) parts.push(`Images: ${images.toLocaleString()}`);
  if (reels !== null) parts.push(`Reels: ${reels.toLocaleString()}`);
  if (total !== null) parts.push(`Total: ${total.toLocaleString()}`);

  return parts.length ? parts.join(", ") : null;
}

function formatEngagementBreakdown(obj) {
  if (!obj || typeof obj !== "object") return null;

  const rate = obj.engagement_rate_percentage ?? obj.engagementRatePercentage ?? obj.engagement_rate;
  const total = obj.Total ?? obj.total ?? obj.total_engagement ?? obj.totalEngagement;

  const rateStr = formatPercent(rate);
  const totalNum = toNumberOrNull(total);

  const parts = [];
  if (rateStr) parts.push(`${rateStr} engagement rate`);
  if (totalNum !== null) parts.push(`total: ${totalNum.toLocaleString()}`);

  return parts.length ? parts.join(", ") : null;
}

function extractPostsTotal(obj) {
  if (!obj || typeof obj !== "object") return toNumberOrNull(obj);
  return toNumberOrNull(obj.Total ?? obj.total ?? obj.number_of_monthly_instagram_posts_total ?? obj.total_posts);
}

function extractEngagementTotal(obj) {
  if (!obj || typeof obj !== "object") return toNumberOrNull(obj);
  return toNumberOrNull(obj.Total ?? obj.total ?? obj.total_engagement ?? obj.totalEngagement);
}

// Month helpers
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

// Session
function getEditKey() { return sessionStorage.getItem(SESSION_KEY) || ""; }
function setEditKey(k) { sessionStorage.setItem(SESSION_KEY, k); }
function clearEditKey() { sessionStorage.removeItem(SESSION_KEY); }

// Xano
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

// Password verification
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
  latestMonthKey: null
};

// Month bounds
function computeLatestMonthKey(rows) {
  const keys = rows.map(r => monthKeyFromYearMonthName(r.year, r.month)).filter(Boolean).sort();
  return keys[keys.length - 1] || null;
}
function computeMinMaxMonthKey(rows) {
  const keys = rows.map(r => monthKeyFromYearMonthName(r.year, r.month)).filter(Boolean).sort();
  return { min: keys[0] || null, max: keys[keys.length - 1] || null };
}

// Companies + row lookup
function uniqueCompanies(rows) {
  const set = new Set(rows.map(r => String(r.company || "").trim()).filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
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
    mount.appendChild(el("div", { className: "toggle" }, [checkbox, el("label", { for: id, text: name })]));
  }
}
function renderDatasetToggles() {
  const mount = document.getElementById("datasetToggle");
  mount.innerHTML = "";
  const checkbox = el("input", { type: "checkbox", id: "allMetrics" });
  checkbox.checked = true;
  checkbox.disabled = true;
  mount.appendChild(el("div", { className: "toggle" }, [
    checkbox,
    el("label", { for: "allMetrics", text: "All metrics (from Xano table fields)" })
  ]));
}
function findRowByCompanyAndMonth(companyName, monthKey) {
  return state.rows.find(r => String(r.company) === String(companyName) && monthKeyFromYearMonthName(r.year, r.month) === monthKey);
}

// Normalize rows
function normalizeRow(row) {
  const r = { ...row };

  // Press coverage (keep raw text; display as clickable HTML)
  r.monthly_press_coverage = normalizeText(r.monthly_press_coverage);

  // Instagram display strings
  r.number_of_monthly_instagram_posts_display =
    formatPostsBreakdown(r.number_of_monthly_instagram_posts) ??
    (toNumberOrNull(r.number_of_monthly_instagram_posts) !== null ? Number(r.number_of_monthly_instagram_posts).toLocaleString() : null);

  r.monthly_instagram_engagement_display =
    formatEngagementBreakdown(r.monthly_instagram_engagement) ??
    (toNumberOrNull(r.monthly_instagram_engagement) !== null ? Number(r.monthly_instagram_engagement).toLocaleString() : null);

  return r;
}

// -------------------------
// Edit text modal for Monthly Press Coverage
// -------------------------
let editTextModalState = null;

function openEditTextModal({ row, fieldKey, fieldLabel, currentValue, monthKey }) {
  editTextModalState = { row, fieldKey, monthKey };

  const backdrop = document.getElementById("editTextModalBackdrop");
  document.getElementById("editTextSubtitle").textContent = `${row.company} • ${monthKey} • ${fieldLabel}`;
  document.getElementById("editTextHint").textContent = "You can paste multiple lines. Links will be clickable after saving.";

  const input = document.getElementById("editTextNewValue");
  input.value = (currentValue === null || currentValue === undefined) ? "" : String(currentValue);

  backdrop.style.display = "flex";
  backdrop.setAttribute("aria-hidden", "false");
  setTimeout(() => input.focus(), 0);
}

function closeEditTextModal() {
  const backdrop = document.getElementById("editTextModalBackdrop");
  backdrop.style.display = "none";
  backdrop.setAttribute("aria-hidden", "true");
  editTextModalState = null;
}

function wireEditTextModal() {
  document.getElementById("editTextClose").addEventListener("click", closeEditTextModal);

  document.getElementById("editTextModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "editTextModalBackdrop") closeEditTextModal();
  });

  document.getElementById("editTextUpdate").addEventListener("click", async () => {
    if (!editTextModalState) return;

    const input = document.getElementById("editTextNewValue");
    const val = input.value;

    const { row, fieldKey } = editTextModalState;
    if (!row?.id) return alert("Missing record id.");

    const payloadVal = normalizeText(val); // blank -> null (clears)

    await xanoFetch(`${XANO_TABLE_PATH}/${row.id}`, {
      method: "PATCH",
      body: { [fieldKey]: payloadVal },
      withEditKey: true
    });

    closeEditTextModal();
    await reloadFromXanoAndRefresh();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && editTextModalState) closeEditTextModal();
  });
}

// -------------------------
// Table rendering + richtext HTML
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
        // show blanks for multi-month for now (esp. richtext)
        displayValue = null;
      }

      const td = el("td");
      const isEmpty = displayValue === null || displayValue === undefined || displayValue === "";

      // richtext: render as HTML (links clickable, multiline preserved)
      if (f.format === "richtext") {
        const div = el("div", {
          className: `clickable-metric${isEmpty ? " muted-cell" : ""}`,
          html: displayValue ? linkifyTextToHtml(displayValue) : "—",
          title: singleMonth ? "Click to edit" : "Shown only in single-month view"
        });

        if (singleMonth && editTargetRow && f.editable) {
          div.addEventListener("click", () => {
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

      const span = el("span", {
        className: `clickable-metric${isEmpty ? " muted-cell" : ""}`,
        text: formatValue(displayValue, f.format),
        title: singleMonth ? "Click to edit" : "Shown only in single-month view"
      });

      td.appendChild(span);
      tr.appendChild(td);
    }

    // Notes cell left as-is (not implemented here)
    tr.appendChild(el("td", { text: "" }));
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  return table;
}

// -------------------------
// Charts
// -------------------------
let metricChart = null;

function companyColor(company) {
  // Force "Swiis" orange
  if (String(company).toLowerCase() === "swiis") return "#f59e0b"; // orange
  // deterministic-ish fallback
  let hash = 0;
  const s = String(company);
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 45%)`;
}

function chartableMetrics() {
  return [
    { key: "domain_authority", label: "Authority Score" },
    { key: "number_of_referring_domains", label: "Referring Domains" },
    { key: "number_of_organic_keywords", label: "Organic Keywords" },
    { key: "organic_traffic", label: "Organic Traffic (est.)" },
    { key: "instagram_followers", label: "Followers" },
    { key: "number_of_monthly_instagram_posts", label: "Posts / month (Total)" },
    { key: "monthly_instagram_engagement", label: "Engagements / month (Total)" },
    { key: "meta_ads_running", label: "Meta Ads Running" }
  ];
}

function getNumericMetricValue(row, metricKey) {
  if (!row) return null;

  if (metricKey === "number_of_monthly_instagram_posts") {
    return extractPostsTotal(row.number_of_monthly_instagram_posts);
  }
  if (metricKey === "monthly_instagram_engagement") {
    return extractEngagementTotal(row.monthly_instagram_engagement);
  }
  return toNumberOrNull(row[metricKey]);
}

function ensureChartMetricOptions() {
  const sel = document.getElementById("chartMetricSelect");
  if (!sel) return;

  const opts = chartableMetrics();
  sel.innerHTML = "";

  for (const o of opts) {
    const opt = document.createElement("option");
    opt.value = o.key;
    opt.textContent = o.label;
    sel.appendChild(opt);
  }

  // Ensure a visible selection
  if (opts.length) sel.value = opts[0].key;
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
  if (!canvas || typeof Chart === "undefined" || !sel) return;

  // IMPORTANT: If dropdown shows "nothing", it usually means options never got added.
  // ensureChartMetricOptions() is called after unlock, and we always set sel.value.
  const metricKey = sel.value || (chartableMetrics()[0]?.key);
  if (!metricKey) return;

  const metricLabel = chartableMetrics().find(m => m.key === metricKey)?.label || metricKey;

  const visibleMonths = state.visibleMonths.length ? state.visibleMonths : (state.latestMonthKey ? [state.latestMonthKey] : []);
  if (!visibleMonths.length) return;

  const singleMonth = visibleMonths.length === 1;

  const allCompanies = uniqueCompanies(state.rows);
  const companies = allCompanies.filter(c => state.selectedCompanies.has(c));

  const modeLabel = document.getElementById("chartModeLabel");
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
  const allCompanies = uniqueCompanies(state.rows);
  const selected = allCompanies.filter(c => state.selectedCompanies.has(c));

  document.getElementById("lastUpdated").textContent =
    `Loaded from Xano. Latest month in Xano: ${state.latestMonthKey}. Viewing: ${visibleMonths.join(", ")}.`;

  if (!selected.length) {
    mount.appendChild(el("p", { className: "muted", text: "No companies selected." }));
    destroyChart();
    return;
  }

  mount.appendChild(buildMetricsTable(visibleMonths, selected));
  renderChart();
}

async function reloadFromXanoAndRefresh() {
  const rows = await xanoFetch(XANO_TABLE_PATH, { method: "GET", withEditKey: false });
  const raw = Array.isArray(rows) ? rows : (rows?.items || rows?.data || []);
  state.rows = raw.map(normalizeRow);

  state.latestMonthKey = computeLatestMonthKey(state.rows);
  const { min, max } = computeMinMaxMonthKey(state.rows);
  state.minMonthKey = min;
  state.maxMonthKey = max;

  const companies = uniqueCompanies(state.rows);
  if (state.selectedCompanies.size === 0) companies.forEach(c => state.selectedCompanies.add(c));
  else for (const c of Array.from(state.selectedCompanies)) if (!companies.includes(c)) state.selectedCompanies.delete(c);

  renderCompanyToggles(companies);
  renderDatasetToggles();

  if (!state.visibleMonths.length) {
    const thisKey = currentMonthKeyUTC();
    const okWithinDataset =
      state.minMonthKey && state.maxMonthKey &&
      compareMonthKey(thisKey, state.minMonthKey) >= 0 &&
      compareMonthKey(thisKey, state.maxMonthKey) <= 0;

    const defaultKey = okWithinDataset ? thisKey : state.latestMonthKey;
    state.visibleMonths = [defaultKey];
    state.rangeStartKey = defaultKey;
    state.rangeEndKey = defaultKey;
  }

  // IMPORTANT: Build chart dropdown only AFTER data exists
  ensureChartMetricOptions();

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
    lockBtn.classList.remove("hidden");
  }
}

async function attemptUnlock(password) {
  const ok = await verifyPassword(password);
  if (!ok) throw new Error("Incorrect password.");
  setEditKey(password);
  await reloadFromXanoAndRefresh();
}

// Time-range UI helpers (minimal: keep your existing index.html handlers)
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
  const startKey = monthKeyFromYYYYMMParts(document.getElementById("startYear").value, document.getElementById("startMonth").value);
  const endKey = monthKeyFromYYYYMMParts(document.getElementById("endYear").value, document.getElementById("endMonth").value);
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

async function init() {
  wireEditTextModal();

  // Chart dropdown changes should redraw
  const chartSelect = document.getElementById("chartMetricSelect");
  if (chartSelect) chartSelect.addEventListener("change", () => renderChart());

  // Enter key = Unlock
  document.getElementById("pagePassword").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("unlockBtn").click();
    }
  });

  document.getElementById("companiesAllOn").addEventListener("click", () => {
    uniqueCompanies(state.rows).forEach(c => state.selectedCompanies.add(c));
    renderCompanyToggles(uniqueCompanies(state.rows));
    refresh();
  });
  document.getElementById("companiesAllOff").addEventListener("click", () => {
    state.selectedCompanies.clear();
    renderCompanyToggles(uniqueCompanies(state.rows));
    refresh();
  });

  document.getElementById("applyRange").addEventListener("click", applyCustomRangeFromSelectors);
  document.getElementById("quickThisMonth").addEventListener("change", (e) => { if (e.target.checked) setQuickThisMonth(); });
  document.getElementById("quickLastMonth").addEventListener("change", (e) => { if (e.target.checked) setQuickLastMonth(); });

  document.getElementById("lockBtn").addEventListener("click", () => {
    clearEditKey();
    setLockedUI(true);
  });

  document.getElementById("unlockBtn").addEventListener("click", async () => {
    const pw = document.getElementById("pagePassword").value;
    const errMount = document.getElementById("lockError");
    errMount.textContent = "";

    try {
      await attemptUnlock(pw);
      setLockedUI(false);

      // Populate year/month selectors spanning ALL data
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
      errMount.textContent = `Unlock failed: ${String(err?.message || err)}`;
    }
  });

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
