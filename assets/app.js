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

  // Derived display fields
  { key: "number_of_monthly_instagram_posts_display", label: "Posts / month", format: "text" },
  { key: "monthly_instagram_engagement_display", label: "Engagements / month", format: "text" },

  { key: "agency_fee_one_child_weekly", label: "Agency Fee (1 child) / week", format: "int" },
  { key: "agency_fee_one_child_yearly", label: "Agency Fee (1 child) / year", format: "int" },

  { key: "meta_ads_running", label: "Meta Ads Running", format: "int" },

  // Editable text
  { key: "monthly_press_coverage", label: "Monthly Press Coverage", format: "text", editable: true }
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

function formatValue(v, format) {
  if (v === null || v === undefined || v === "") return "—";
  if (format === "int") {
    const n = Number(v);
    if (Number.isNaN(n)) return "—";
    return n.toLocaleString();
  }
  return String(v);
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

// "Images: 7, Reels: 0, Total: 7"
function formatPostsBreakdown(obj) {
  if (!obj || typeof obj !== "object") return null;

  const images = toNumberOrNull(obj.Images ?? obj.images ?? obj.Image ?? obj.image);
  const reels = toNumberOrNull(obj.Reels ?? obj.reels ?? obj.reels_video ?? obj.reel);
  const total = toNumberOrNull(obj.Total ?? obj.total ?? obj.number_of_monthly_instagram_posts_total ?? obj.total_posts);

  const parts = [];
  if (images !== null) parts.push(`Images: ${images.toLocaleString()}`);
  if (reels !== null) parts.push(`Reels: ${reels.toLocaleString()}`);
  if (total !== null) parts.push(`Total: ${total.toLocaleString()}`);
  return parts.length ? parts.join(", ") : null;
}

// "0.6% engagement rate, total: 94"
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

// -------------------------
// Password verification (uses app_config EDIT_KEY)
// -------------------------
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
// App state
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

// -------------------------
// Compute month bounds
// -------------------------
function computeLatestMonthKey(rows) {
  const keys = rows.map(r => monthKeyFromYearMonthName(r.year, r.month)).filter(Boolean).sort();
  return keys[keys.length - 1] || null;
}
function computeMinMaxMonthKey(rows) {
  const keys = rows.map(r => monthKeyFromYearMonthName(r.year, r.month)).filter(Boolean).sort();
  return { min: keys[0] || null, max: keys[keys.length - 1] || null };
}

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

function normalizeRow(row) {
  const r = { ...row };

  // agency fee object -> numeric fields
  const feeObj = r.agency_fee_one_child;
  if (feeObj && typeof feeObj === "object") {
    r.agency_fee_one_child_weekly = toNumberOrNull(feeObj.Weekly ?? feeObj.weekly);
    r.agency_fee_one_child_yearly = toNumberOrNull(feeObj.Yearly ?? feeObj.yearly);
  }

  // press coverage is text
  r.monthly_press_coverage = normalizeText(r.monthly_press_coverage);

  // instagram displays
  r.number_of_monthly_instagram_posts_display =
    formatPostsBreakdown(r.number_of_monthly_instagram_posts) ??
    (toNumberOrNull(r.number_of_monthly_instagram_posts) !== null ? Number(r.number_of_monthly_instagram_posts).toLocaleString() : null);

  r.monthly_instagram_engagement_display =
    formatEngagementBreakdown(r.monthly_instagram_engagement) ??
    (toNumberOrNull(r.monthly_instagram_engagement) !== null ? Number(r.monthly_instagram_engagement).toLocaleString() : null);

  return r;
}

// -------------------------
// Edit modals (number + text)
// -------------------------
let editModalState = null;
let editTextModalState = null;

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
  document.getElementById("editTextHint").textContent = "This updates the value in Xano.";
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

function wireEditModals() {
  // number modal
  document.getElementById("editMetricClose").addEventListener("click", closeEditMetricModal);
  document.getElementById("editMetricModalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "editMetricModalBackdrop") closeEditMetricModal();
  });
  document.getElementById("editMetricUpdate").addEventListener("click", async () => {
    if (!editModalState) return;
    const input = document.getElementById("editMetricNewValue");
    const raw = input.value;
    if (raw === "" || raw === null || raw === undefined) return alert("Enter a value.");
    const num = Number(raw);
    if (Number.isNaN(num)) return alert("Please enter a valid number.");

    const { row, fieldKey } = editModalState;
    if (!row?.id) return alert("Missing record id.");

    await xanoFetch(`${XANO_TABLE_PATH}/${row.id}`, { method: "PATCH", body: { [fieldKey]: num }, withEditKey: true });
    closeEditMetricModal();
    await reloadFromXanoAndRefresh();
  });

  // text modal
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

    // Allow blank -> null (so you can clear it)
    const payloadVal = normalizeText(val);

    await xanoFetch(`${XANO_TABLE_PATH}/${row.id}`, { method: "PATCH", body: { [fieldKey]: payloadVal }, withEditKey: true });
    closeEditTextModal();
    await reloadFromXanoAndRefresh();
  });

  // Esc closes whichever is open
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (editModalState) closeEditMetricModal();
    if (editTextModalState) closeEditTextModal();
  });
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
        if (f.format === "text") {
          displayValue = null;
        } else {
          const vals = visibleMonths
            .map(mk => findRowByCompanyAndMonth(companyName, mk)?.[f.key])
            .filter(v => v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v)))
            .map(Number);
          if (vals.length) displayValue = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        }
      }

      const td = el("td");
      const isEmpty = displayValue === null || displayValue === undefined || displayValue === "";
      const span = el("span", {
        className: `clickable-metric${isEmpty ? " muted-cell" : ""}`,
        text: formatValue(displayValue, f.format),
        title: singleMonth ? "Click to edit" : (f.format === "text" ? "Shown only in single-month view" : "Switch to a single month to edit")
      });

      const isDerived = f.key.endsWith("_display");
      const isText = f.format === "text";

      if (singleMonth && editTargetRow && !isDerived) {
        if (isText && f.editable) {
          span.addEventListener("click", () => {
            openEditTextModal({
              row: editTargetRow,
              fieldKey: f.key,
              fieldLabel: f.label,
              currentValue: editTargetRow[f.key],
              monthKey: editMonthKey
            });
          });
        } else if (!isText) {
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
      }

      td.appendChild(span);
      tr.appendChild(td);
    }

    // Notes cell (same as before)
    const notesTd = el("td");
    const notesWrap = el("div", { style: "display:flex; gap:8px; align-items:flex-start;" });
    const notesArea = el("textarea", { rows: "3", style: "width: 100%; min-width: 200px; resize: vertical;" });

    if (singleMonth) {
      const r = findRowByCompanyAndMonth(companyName, visibleMonths[0]);
      notesArea.value = r?.[NOTES_FIELD_KEY] ?? "";
    } else {
      notesArea.value = "";
      notesArea.disabled = true;
      notesArea.placeholder = "Switch to a single month to edit notes";
    }

    const saveBtn = el("button", { type: "button", text: "Save" });
    saveBtn.disabled = !singleMonth;

    saveBtn.addEventListener("click", async () => {
      if (!singleMonth) return;
      const mk = visibleMonths[0];
      const r = findRowByCompanyAndMonth(companyName, mk);
      if (!r?.id) return alert(`No Xano record found for ${companyName} ${mk}. Create it in Xano first.`);
      await xanoFetch(`${XANO_TABLE_PATH}/${r.id}`, { method: "PATCH", body: { [NOTES_FIELD_KEY]: notesArea.value }, withEditKey: true });
      saveBtn.textContent = "Saved";
      saveBtn.disabled = true;
      setTimeout(() => { saveBtn.textContent = "Save"; saveBtn.disabled = false; }, 700);
    });

    notesWrap.appendChild(notesArea);
    notesWrap.appendChild(saveBtn);
    notesTd.appendChild(notesWrap);
    tr.appendChild(notesTd);

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  return table;
}

// -------------------------
// Charts
// -------------------------
let metricChart = null;

function chartableMetrics() {
  // pick metrics that are numeric or can be derived numeric for charting
  return [
    { key: "domain_authority", label: "Authority Score" },
    { key: "number_of_referring_domains", label: "Referring Domains" },
    { key: "number_of_organic_keywords", label: "Organic Keywords" },
    { key: "organic_traffic", label: "Organic Traffic (est.)" },
    { key: "instagram_followers", label: "Followers" },
    { key: "number_of_monthly_instagram_posts", label: "Posts / month (Total)" },
    { key: "monthly_instagram_engagement", label: "Engagements / month (Total)" },
    { key: "agency_fee_one_child_weekly", label: "Agency Fee / week" },
    { key: "agency_fee_one_child_yearly", label: "Agency Fee / year" },
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
  if (!sel.value && opts.length) sel.value = opts[0].key;
}

function destroyChart() {
  if (metricChart) {
    metricChart.destroy();
    metricChart = null;
  }
}

function renderChart() {
  const canvas = document.getElementById("metricChart");
  if (!canvas || typeof Chart === "undefined") return;

  const visibleMonths = state.visibleMonths.length ? state.visibleMonths : [state.latestMonthKey];
  const singleMonth = visibleMonths.length === 1;

  const allCompanies = uniqueCompanies(state.rows);
  const companies = allCompanies.filter(c => state.selectedCompanies.has(c));

  const metricKey = document.getElementById("chartMetricSelect")?.value || "domain_authority";
  const metricLabel = chartableMetrics().find(m => m.key === metricKey)?.label || metricKey;

  const modeLabel = document.getElementById("chartModeLabel");
  modeLabel.textContent = singleMonth ? `(Bar • ${visibleMonths[0]})` : `(Line • ${visibleMonths[0]} → ${visibleMonths[visibleMonths.length - 1]})`;

  destroyChart();

  if (singleMonth) {
    const mk = visibleMonths[0];
    const values = companies.map(c => getNumericMetricValue(findRowByCompanyAndMonth(c, mk), metricKey) ?? 0);

    metricChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: companies,
        datasets: [{
          label: metricLabel,
          data: values
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  } else {
    // line chart over months; one dataset per company
    const datasets = companies.map((c, idx) => {
      const data = visibleMonths.map(mk => getNumericMetricValue(findRowByCompanyAndMonth(c, mk), metricKey) ?? 0);
      return {
        label: c,
        data,
        tension: 0.25
      };
    });

    metricChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: visibleMonths,
        datasets
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }
}

// -------------------------
// Refresh / export
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

function exportVisibleToCsv() {
  const visibleMonths = state.visibleMonths.length ? state.visibleMonths : [state.latestMonthKey];
  const allCompanies = uniqueCompanies(state.rows);
  const selected = allCompanies.filter(c => state.selectedCompanies.has(c));

  const headers = ["company", "months"].concat(METRIC_FIELDS.map(f => f.key)).concat([NOTES_FIELD_KEY]);
  const lines = [headers.join(",")];

  const singleMonth = visibleMonths.length === 1;

  for (const companyName of selected) {
    const row = [];
    row.push(csvEscape(companyName));
    row.push(csvEscape(singleMonth ? visibleMonths[0] : visibleMonths.join("|")));

    for (const f of METRIC_FIELDS) {
      let v = "";
      if (singleMonth) v = findRowByCompanyAndMonth(companyName, visibleMonths[0])?.[f.key];
      row.push(csvEscape(v));
    }

    const noteVal = singleMonth ? (findRowByCompanyAndMonth(companyName, visibleMonths[0])?.[NOTES_FIELD_KEY] ?? "") : "";
    row.push(csvEscape(noteVal));

    lines.push(row.join(","));
  }

  downloadBlob(`competitor-metrics-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`, "text/csv;charset=utf-8", lines.join("\n"));
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function downloadBlob(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// -------------------------
// Time-range UI
// -------------------------
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

// -------------------------
// Load / init
// -------------------------
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

async function init() {
  wireEditModals();

  // Chart metric dropdown
  ensureChartMetricOptions();
  document.getElementById("chartMetricSelect").addEventListener("change", () => renderChart());

  // Enter key triggers Unlock
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

  document.getElementById("exportCsv").addEventListener("click", exportVisibleToCsv);
  document.getElementById("exportXlsx").addEventListener("click", () => alert("Excel export can be added next. CSV export is enabled now."));

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

      // Populate year/month selectors spanning ALL data in Xano
      if (state.minMonthKey && state.maxMonthKey) {
        const minY = Number(state.minMonthKey.split("-")[0]);
        const maxY = Number(state.maxMonthKey.split("-")[0]);

        fillYearSelect(document.getElementById("startYear"), minY, maxY);
        fillYearSelect(document.getElementById("endYear"), minY, maxY);
        fillMonthSelect(document.getElementById("startMonth"));
        fillMonthSelect(document.getElementById("endMonth"));

        setRangeSelectorsFromKeys(state.rangeStartKey, state.rangeEndKey);

        document.getElementById("applyRange").addEventListener("click", applyCustomRangeFromSelectors);
        document.getElementById("quickThisMonth").addEventListener("change", (e) => { if (e.target.checked) setQuickThisMonth(); });
        document.getElementById("quickLastMonth").addEventListener("change", (e) => { if (e.target.checked) setQuickLastMonth(); });
      }

    } catch (err) {
      clearEditKey();
      errMount.textContent = `Unlock failed: ${String(err?.message || err)}`;
    }
  });

  setLockedUI(true);
}

function showFatal(err) {
  const msg = String(err?.stack || err);
  console.error(err);
  const lockErr = document.getElementById("lockError");
  if (lockErr) lockErr.textContent = msg;
}

window.addEventListener("DOMContentLoaded", () => {
  init().catch(showFatal);
});
