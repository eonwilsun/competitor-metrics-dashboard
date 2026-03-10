// -------------------------
// Xano config
// -------------------------
const XANO_BASE_URL = "https://x8ki-letl-twmt.n7.xano.io/api:ZvixoXZ8";
const XANO_TABLE_PATH = "/competitor_metrics_dashboard"; // from your screenshot
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

function formatValue(v, format) {
  if (v === null || v === undefined || v === "") return "—";
  if (format === "int") return Number(v).toLocaleString();
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

function monthKeyFromYearMonthName(year, monthName) {
  const mm = MONTHS[String(monthName || "").toLowerCase()];
  if (!mm) return null;
  return `${year}-${mm}`;
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

async function xanoFetch(path, { method = "GET", body = null } = {}) {
  const headers = { "Content-Type": "application/json" };
  const key = getEditKey();
  if (key) headers["x-edit-key"] = key;

  const res = await fetch(`${XANO_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Xano error ${res.status}: ${text || res.statusText}`);
  }

  // Xano returns JSON for CRUD
  return await res.json();
}

// -------------------------
// Time range logic
// -------------------------
function getRangeMonths(latestMonth, range) {
  const [y, m] = latestMonth.split("-").map(Number);
  const latest = new Date(Date.UTC(y, m - 1, 1));

  const months = [];
  const pushMonth = (dt) => {
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    months.push(`${yyyy}-${mm}`);
  };

  if (range === "thisMonth") {
    pushMonth(latest);
    return months;
  }

  if (range === "lastMonth") {
    const dt = new Date(latest);
    dt.setUTCMonth(dt.getUTCMonth() - 1);
    pushMonth(dt);
    return months;
  }

  let count = 1;
  if (range === "last6Months") count = 6;
  if (range === "lastYear") count = 12;

  for (let i = 0; i < count; i++) {
    const dt = new Date(latest);
    dt.setUTCMonth(dt.getUTCMonth() - i);
    pushMonth(dt);
  }
  return months;
}

// -------------------------
// App state
// -------------------------
const state = {
  timeRange: "thisMonth",
  selectedCompanies: new Set(),
  rows: [],              // raw Xano rows
  latestMonthKey: null   // YYYY-MM
};

// -------------------------
// Load + normalize
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
  // You currently have one dataset table in Xano (flat fields),
  // so we'll show a simple "All metrics" toggle group for now.
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
    const id = row.id; // Xano record id field is "id"
    if (!id) {
      alert("Missing record id.");
      return;
    }

    await xanoFetch(`${XANO_TABLE_PATH}/${id}`, {
      method: "PATCH",
      body: { [fieldKey]: num }
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

    // Metric cells
    for (const f of METRIC_FIELDS) {
      let displayValue = null;
      let editTargetRow = null;
      let editMonthKey = null;

      if (singleMonth) {
        editMonthKey = visibleMonths[0];
        editTargetRow = findRowByCompanyAndMonth(companyName, editMonthKey);
        displayValue = editTargetRow ? editTargetRow[f.key] : null;
      } else {
        // Multi-month: show average of available numeric values.
        // Editing multi-month averages is ambiguous, so we disable editing in this view.
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
        title: singleMonth ? "Click to edit" : "Switch to This Month/Last Month to edit"
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

    // Notes cell (edits PATCH notes)
    const notesTd = el("td");
    const notesWrap = el("div", { style: "display:flex; gap:8px; align-items:flex-start;" });

    const notesArea = el("textarea", {
      rows: "3",
      style: "width: 100%; min-width: 200px; resize: vertical;"
    });

    // Notes are stored per single-month record. In multi-month view, we show blank + disable.
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
        body: { [NOTES_FIELD_KEY]: notesArea.value }
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

  const visibleMonths = getRangeMonths(state.latestMonthKey, state.timeRange);

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
  const visibleMonths = getRangeMonths(state.latestMonthKey, state.timeRange);
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
// Lock screen / init
// -------------------------
async function reloadFromXanoAndRefresh() {
  // Xano GET list endpoint
  const rows = await xanoFetch(XANO_TABLE_PATH, { method: "GET" });

  // Xano's CRUD list usually returns an array; if it returns { items: [...] }, handle that too.
  state.rows = Array.isArray(rows) ? rows : (rows?.items || rows?.data || []);

  state.latestMonthKey = computeLatestMonthKey(state.rows);

  const companies = uniqueCompanies(state.rows);

  // Default: all on (only on first load)
  if (state.selectedCompanies.size === 0) {
    companies.forEach(c => state.selectedCompanies.add(c));
  } else {
    // Remove companies that no longer exist
    for (const c of Array.from(state.selectedCompanies)) {
      if (!companies.includes(c)) state.selectedCompanies.delete(c);
    }
  }

  renderCompanyToggles(companies);
  renderDatasetToggles();
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
  setEditKey(password);

  // Try a read call; if Xano is enforcing x-edit-key, this will fail when password is wrong.
  await reloadFromXanoAndRefresh();
}

async function init() {
  wireEditMetricModal();

  document.getElementById("timeRange").addEventListener("change", (e) => {
    state.timeRange = e.target.value;
    refresh();
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

  document.getElementById("datasetsAllOn").addEventListener("click", () => {});
  document.getElementById("datasetsAllOff").addEventListener("click", () => {});

  document.getElementById("exportCsv").addEventListener("click", exportVisibleToCsv);
  document.getElementById("exportXlsx").addEventListener("click", () => {
    alert("Excel export can be added next. CSV export is enabled now.");
  });

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
    } catch (err) {
      clearEditKey();
      errMount.textContent = "Incorrect password or API not yet protected. Check Xano auth enforcement.";
    }
  });

  // Auto-unlock if key exists in session
  const existing = getEditKey();
  if (existing) {
    try {
      await attemptUnlock(existing);
      setLockedUI(false);
    } catch {
      clearEditKey();
      setLockedUI(true);
    }
  } else {
    setLockedUI(true);
  }
}

init().catch((err) => {
  const mount = document.getElementById("metricsDisplay");
  if (mount) mount.appendChild(el("pre", { text: String(err?.stack || err) }));
});
