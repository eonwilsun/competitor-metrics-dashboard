// -------------------------
// Xano config
// -------------------------
const XANO_BASE_URL = "https://x8ki-letl-twmt.n7.xano.io/api:ZvixoXZ8";
const XANO_TABLE_PATH = "/competitor_metrics_dashboard"; // metrics table endpoint
const XANO_CONFIG_PATH = "/app_config";                 // app_config endpoint (must exist in Xano API)
const EDIT_KEY_NAME = "EDIT_KEY";                       // key column value in app_config table
const SESSION_KEY = "cmd.editKey.v1";

// Which fields to show/edit (must match your Xano column names)
const METRIC_FIELDS = [
  { key: "domain_authority", label: "Authority Score", format: "int" },
  { key: "number_of_referring_domains", label: "Referring Domains", format: "int" },
  { key: "number_of_organic_keywords", label: "Organic Keywords", format: "int" },
  { key: "organic_traffic", label: "Organic Traffic (est.)", format: "int" },
  { key: "instagram_followers", label: "Followers", format: "int" },
  { key: "number_of_monthly_instagram_posts", label: "Posts / month", format: "int" },
  { key: "monthly_instagram_engagement", label: "Engagements / month", format: "int" },

  // Derived from Xano object field: agency_fee_one_child (e.g. { Weekly: 520, Yearly: 27040 })
  { key: "agency_fee_one_child_weekly", label: "Agency Fee (1 child) / week", format: "int" },
  { key: "agency_fee_one_child_yearly", label: "Agency Fee (1 child) / year", format: "int" },

  { key: "meta_ads_running", label: "Meta Ads Running", format: "int" },
  { key: "monthly_press_coverage", label: "Monthly Press Coverage", format: "int" }
];

// Notes field key in Xano
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

const MONTHS = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12"
};

const MONTH_LABELS = [
  { name: "January", value: "01" },
  { name: "February", value: "02" },
  { name: "March", value: "03" },
  { name: "April", value: "04" },
  { name: "May", value: "05" },
  { name: "June", value: "06" },
  { name: "July", value: "07" },
  { name: "August", value: "08" },
  { name: "September", value: "09" },
  { name: "October", value: "10" },
  { name: "November", value: "11" },
  { name: "December", value: "12" }
];

function monthKeyFromYearMonthName(year, monthName) {
  const mm = MONTHS[String(monthName || "").toLowerCase()];
  if (!mm) return null;
  return `${year}-${mm}`;
}

function monthKeyFromYYYYMMParts(year, mm) {
  const y = String(year).trim();
  const m = String(mm).padStart(2, "0");
  return `${y}-${m}`;
}

function parseMonthKey(mk) {
  // mk is "YYYY-MM"
  if (!mk || typeof mk !== "string" || mk.length < 7) return null;
  const [y, m] = mk.split("-");
  if (!y || !m) return null;
  return { year: Number(y), month: String(m).padStart(2, "0") };
}

function compareMonthKey(a, b) {
  // lexical works for YYYY-MM
  return String(a).localeCompare(String(b));
}

function listMonthKeysBetween(startKey, endKey) {
  // Inclusive list from startKey to endKey (YYYY-MM)
  const s = parseMonthKey(startKey);
  const e = parseMonthKey(endKey);
  if (!s || !e) return [];

  const start = new Date(Date.UTC(s.year, Number(s.month) - 1, 1));
  const end = new Date(Date.UTC(e.year, Number(e.month) - 1, 1));

  if (start > end) return [];

  const out = [];
  const cur = new Date(start);
  while (cur <= end) {
    const yyyy = cur.getUTCFullYear();
    const mm = String(cur.getUTCMonth() + 1).padStart(2, "0");
    out.push(`${yyyy}-${mm}`);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
}

function getEditKey() {
  return sessionStorage.getItem(SESSION_KEY) || "";
}

function setEditKey(k) {
  sessionStorage.setItem(SESSION_KEY, k);
}

function clearEditKey() {
  sessionStorage.removeItem(SESSION_KEY);
}

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
  // Time selection state:
  // - visibleMonths is the concrete list of YYYY-MM keys currently shown (the single source of truth)
  visibleMonths: [],

  // UI form values (custom range)
  rangeStartKey: null,
  rangeEndKey: null,

  selectedCompanies: new Set(),
  rows: [],              // normalized rows
  latestMonthKey: null   // YYYY-MM from data
};

// -------------------------
// Load + normalize helpers
// -------------------------
function computeLatestMonthKey(rows) {
  const keys = rows
    .map(r => monthKeyFromYearMonthName(r.year, r.month))
    .filter(Boolean)
    .sort(); // ascending YYYY-MM
  return keys[keys.length - 1] || null;
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
      if (checkbox.checked) state.selectedCompanies.add(name);
      else state.selectedCompanies.delete(name);
      refresh();
    });

    const label = el("label", { for: id, text: name });
    mount.appendChild(el("div", { className: "toggle" }, [checkbox, label]));
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
  return state.rows.find(r => {
    const mk = monthKeyFromYearMonthName(r.year, r.month);
    return String(r.company) === String(companyName) && mk === monthKey;
  });
}

function normalizeRow(row) {
  const r = { ...row };

  // --- Agency fee object -> numeric fields
  const feeObj = r.agency_fee_one_child;
  if (feeObj && typeof feeObj === "object") {
    r.agency_fee_one_child_weekly = toNumberOrNull(feeObj.Weekly ?? feeObj.weekly);
    r.agency_fee_one_child_yearly = toNumberOrNull(feeObj.Yearly ?? feeObj.yearly);
  }

  // --- Monthly Instagram posts object -> numeric field
  const postsObj = r.number_of_monthly_instagram_posts;
  if (postsObj && typeof postsObj === "object") {
    const total = toNumberOrNull(postsObj.total) ?? toNumberOrNull(postsObj.total_posts);
    if (total !== null) {
      r.number_of_monthly_instagram_posts = total;
    } else {
      r.number_of_monthly_instagram_posts = Object.values(postsObj)
        .map(toNumberOrNull)
        .filter(v => v !== null)
        .reduce((a, b) => a + b, 0);
    }
  }

  // --- Monthly Instagram engagement object -> numeric field
  const engObj = r.monthly_instagram_engagement;
  if (engObj && typeof engObj === "object") {
    const total = toNumberOrNull(engObj.total_engagement) ?? toNumberOrNull(engObj.total);
    if (total !== null) {
      r.monthly_instagram_engagement = total;
    } else {
      r.monthly_instagram_engagement = Object.values(engObj)
        .map(toNumberOrNull)
        .filter(v => v !== null)
        .reduce((a, b) => a + b, 0);
    }
  }

  return r;
}

// -------------------------
// Editable metric modal
// -------------------------
let editModalState = null;

function openEditMetricModal({ row, fieldKey, fieldLabel, currentValue, monthKey }) {
  editModalState = { row, fieldKey, monthKey };

  const backdrop = document.getElementById("editMetricModalBackdrop");
  const subtitle = document.getElementById("editMetricSubtitle");
  const input = document.getElementById("editMetricNewValue");
  const hint = document.getElementById("editMetricHint");

  subtitle.textContent = `${row.company} • ${monthKey} • ${fieldLabel}`;
  hint.textContent = "This updates the value in Xano.";
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

function wireEditMetricModal() {
  const backdrop = document.getElementById("editMetricModalBackdrop");
  const closeBtn = document.getElementById("editMetricClose");
  const updateBtn = document.getElementById("editMetricUpdate");
  const input = document.getElementById("editMetricNewValue");

  closeBtn.addEventListener("click", closeEditMetricModal);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeEditMetricModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && editModalState) closeEditMetricModal();
  });

  updateBtn.addEventListener("click", async () => {
    if (!editModalState) return;
    const raw = input.value;
    if (raw === "" || raw === null || raw === undefined) {
      alert("Enter a value.");
      return;
    }
    const num = Number(raw);
    if (Number.isNaN(num)) {
      alert("Please enter a valid number.");
      return;
    }

    const { row, fieldKey } = editModalState;
    const id = row.id;
    if (!id) {
      alert("Missing record id.");
      return;
    }

    await xanoFetch(`${XANO_TABLE_PATH}/${id}`, {
      method: "PATCH",
      body: { [fieldKey]: num },
      withEditKey: true
    });

    closeEditMetricModal();
    await reloadFromXanoAndRefresh();
  });
}

// -------------------------
// Rendering
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
        const vals = visibleMonths
          .map(mk => findRowByCompanyAndMonth(companyName, mk)?.[f.key])
          .filter(v => v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v)))
          .map(Number);

        if (vals.length) displayValue = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      }

      const td = el("td");
      const isEmpty = displayValue === null || displayValue === undefined;

      const span = el("span", {
        className: `clickable-metric${isEmpty ? " muted-cell" : ""}`,
        text: formatValue(displayValue, f.format),
        title: singleMonth ? "Click to edit" : "Switch to a single month to edit"
      });

      if (singleMonth && editTargetRow) {
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

    const notesTd = el("td");
    const notesWrap = el("div", { style: "display:flex; gap:8px; align-items:flex-start;" });

    const notesArea = el("textarea", {
      rows: "3",
      style: "width: 100%; min-width: 200px; resize: vertical;"
    });

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
      const monthKey = visibleMonths[0];
      const r = findRowByCompanyAndMonth(companyName, monthKey);
      if (!r?.id) {
        alert(`No Xano record found for ${companyName} ${monthKey}. Create it in Xano first.`);
        return;
      }
      await xanoFetch(`${XANO_TABLE_PATH}/${r.id}`, {
        method: "PATCH",
        body: { [NOTES_FIELD_KEY]: notesArea.value },
        withEditKey: true
      });
      saveBtn.textContent = "Saved";
      saveBtn.disabled = true;
      setTimeout(() => {
        saveBtn.textContent = "Save";
        saveBtn.disabled = false;
      }, 700);
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

function refresh() {
  const mount = document.getElementById("metricsDisplay");
  mount.innerHTML = "";

  if (!state.latestMonthKey) {
    mount.appendChild(el("p", { className: "muted", text: "No data found in Xano." }));
    return;
  }

  const visibleMonths = state.visibleMonths.length ? state.visibleMonths : [state.latestMonthKey];

  const allCompanies = uniqueCompanies(state.rows);
  const selected = allCompanies.filter(c => state.selectedCompanies.has(c));

  document.getElementById("lastUpdated").textContent =
    `Loaded from Xano. Latest month: ${state.latestMonthKey}. Viewing: ${visibleMonths.join(", ")}.`;

  if (!selected.length) {
    mount.appendChild(el("p", { className: "muted", text: "No companies selected." }));
    return;
  }

  mount.appendChild(buildMetricsTable(visibleMonths, selected));
}

// -------------------------
// Export
// -------------------------
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
      if (singleMonth) {
        v = findRowByCompanyAndMonth(companyName, visibleMonths[0])?.[f.key];
      } else {
        const vals = visibleMonths
          .map(mk => findRowByCompanyAndMonth(companyName, mk)?.[f.key])
          .filter(x => x !== null && x !== undefined && x !== "" && !Number.isNaN(Number(x)))
          .map(Number);
        v = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : "";
      }
      row.push(csvEscape(v));
    }

    const noteVal = singleMonth
      ? (findRowByCompanyAndMonth(companyName, visibleMonths[0])?.[NOTES_FIELD_KEY] ?? "")
      : "";
    row.push(csvEscape(noteVal));

    lines.push(row.join(","));
  }

  downloadBlob(
    `competitor-metrics-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`,
    "text/csv;charset=utf-8",
    lines.join("\n")
  );
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
// Time-range UI wiring
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
  const sy = document.getElementById("startYear").value;
  const sm = document.getElementById("startMonth").value;
  const ey = document.getElementById("endYear").value;
  const em = document.getElementById("endMonth").value;

  const startKey = monthKeyFromYYYYMMParts(sy, sm);
  const endKey = monthKeyFromYYYYMMParts(ey, em);

  // If reversed, block
  if (compareMonthKey(startKey, endKey) > 0) {
    alert("Start month must be before (or the same as) End month.");
    return;
  }

  // turn off quick ticks because user chose a custom range
  document.getElementById("quickThisMonth").checked = false;
  document.getElementById("quickLastMonth").checked = false;

  state.rangeStartKey = startKey;
  state.rangeEndKey = endKey;
  state.visibleMonths = listMonthKeysBetween(startKey, endKey);

  refresh();
}

function setQuickThisMonth() {
  document.getElementById("quickLastMonth").checked = false;

  state.rangeStartKey = state.latestMonthKey;
  state.rangeEndKey = state.latestMonthKey;
  state.visibleMonths = [state.latestMonthKey];

  setRangeSelectorsFromKeys(state.latestMonthKey, state.latestMonthKey);
  refresh();
}

function setQuickLastMonth() {
  document.getElementById("quickThisMonth").checked = false;

  const { year, month } = parseMonthKey(state.latestMonthKey);
  const dt = new Date(Date.UTC(year, Number(month) - 1, 1));
  dt.setUTCMonth(dt.getUTCMonth() - 1);

  const lastKey = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;

  state.rangeStartKey = lastKey;
  state.rangeEndKey = lastKey;
  state.visibleMonths = [lastKey];

  setRangeSelectorsFromKeys(lastKey, lastKey);
  refresh();
}

// -------------------------
// Lock screen / init
// -------------------------
async function reloadFromXanoAndRefresh() {
  const rows = await xanoFetch(XANO_TABLE_PATH, { method: "GET", withEditKey: false });
  const raw = Array.isArray(rows) ? rows : (rows?.items || rows?.data || []);

  state.rows = raw.map(normalizeRow);
  state.latestMonthKey = computeLatestMonthKey(state.rows);

  const companies = uniqueCompanies(state.rows);

  // default: all companies selected first load
  if (state.selectedCompanies.size === 0) {
    companies.forEach(c => state.selectedCompanies.add(c));
  } else {
    for (const c of Array.from(state.selectedCompanies)) {
      if (!companies.includes(c)) state.selectedCompanies.delete(c);
    }
  }

  renderCompanyToggles(companies);
  renderDatasetToggles();

  // If no visible months chosen yet, default to latest month.
  if (!state.visibleMonths.length && state.latestMonthKey) {
    state.visibleMonths = [state.latestMonthKey];
    state.rangeStartKey = state.latestMonthKey;
    state.rangeEndKey = state.latestMonthKey;
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
  wireEditMetricModal();

  // Wire exports
  document.getElementById("exportCsv").addEventListener("click", exportVisibleToCsv);
  document.getElementById("exportXlsx").addEventListener("click", () => {
    alert("Excel export can be added next. CSV export is enabled now.");
  });

  // Company bulk actions
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

  // Lock
  document.getElementById("lockBtn").addEventListener("click", () => {
    clearEditKey();
    setLockedUI(true);
  });

  // Unlock
  document.getElementById("unlockBtn").addEventListener("click", async () => {
    const pw = document.getElementById("pagePassword").value;
    const errMount = document.getElementById("lockError");
    errMount.textContent = "";

    try {
      await attemptUnlock(pw);
      setLockedUI(false);

      // Once unlocked, initialize time-range controls based on data
      const minYear = Math.min(...state.visibleMonths.map(m => Number(m.split("-")[0])));
      const maxYear = Math.max(...state.visibleMonths.map(m => Number(m.split("-")[0])), Number(state.latestMonthKey.split("-")[0]));

      fillYearSelect(document.getElementById("startYear"), minYear, maxYear);
      fillYearSelect(document.getElementById("endYear"), minYear, maxYear);
      fillMonthSelect(document.getElementById("startMonth"));
      fillMonthSelect(document.getElementById("endMonth"));

      setRangeSelectorsFromKeys(state.rangeStartKey, state.rangeEndKey);

      // Apply custom range button
      document.getElementById("applyRange").addEventListener("click", applyCustomRangeFromSelectors);

      // Quick ticks
      document.getElementById("quickThisMonth").addEventListener("change", (e) => {
        if (e.target.checked) setQuickThisMonth();
      });
      document.getElementById("quickLastMonth").addEventListener("change", (e) => {
        if (e.target.checked) setQuickLastMonth();
      });

    } catch (err) {
      clearEditKey();
      errMount.textContent = `Unlock failed: ${String(err?.message || err)}`;
    }
  });

  // Default to locked
  setLockedUI(true);
}

function showFatal(err) {
  const msg = String(err?.stack || err);
  console.error(err);

  const lockErr = document.getElementById("lockError");
  if (lockErr) lockErr.textContent = msg;

  const mount = document.getElementById("metricsDisplay");
  if (mount) mount.appendChild(el("pre", { text: msg }));
}

window.addEventListener("DOMContentLoaded", () => {
  init().catch(showFatal);
});
