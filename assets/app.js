const DATA_URL = "data/metrics.json";

const state = {
  timeRange: "thisMonth",
  selectedCompanies: new Set(),
  selectedDatasets: new Set()
};

function monthKey(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function getRangeMonths(latestMonth, range) {
  // latestMonth: "YYYY-MM"
  const [y, m] = latestMonth.split("-").map(Number);
  const latest = new Date(Date.UTC(y, m - 1, 1));

  const months = [];
  const pushMonth = (dt) => months.push(monthKey(dt));

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

function formatValue(v, format) {
  if (v === null || v === undefined) return "—";
  if (format === "int") return Number(v).toLocaleString();
  return String(v);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, val] of Object.entries(attrs)) {
    if (k === "className") node.className = val;
    else if (k === "text") node.textContent = val;
    else node.setAttribute(k, val);
  }
  for (const c of children) node.appendChild(c);
  return node;
}

function renderToggles(container, items, selectedSet, labelFn) {
  container.innerHTML = "";
  for (const item of items) {
    const id = item.id;
    const checkbox = el("input", { type: "checkbox", id: `${container.id}_${id}` });
    checkbox.checked = selectedSet.has(id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedSet.add(id);
      else selectedSet.delete(id);
      refresh();
    });

    const label = el("label", { for: checkbox.id, text: labelFn(item) });
    const row = el("div", { className: "toggle" }, [checkbox, label]);
    container.appendChild(row);
  }
}

function buildTable(data, months, companies, datasets) {
  const monthSet = new Set(months);
  const snapshots = data.snapshots.filter(s => monthSet.has(s.month));

  // Latest-first ordering
  snapshots.sort((a, b) => (a.month < b.month ? 1 : -1));

  const table = el("table");
  const thead = el("thead");
  const trh = el("tr");

  trh.appendChild(el("th", { text: "Company" }));
  trh.appendChild(el("th", { text: "Domain" }));

  // Build columns: for each dataset metric => either show single month (this/last) or average over months
  const columns = [];
  for (const ds of datasets) {
    for (const metric of ds.metrics) {
      columns.push({ datasetId: ds.id, datasetName: ds.name, metricId: metric.id, metricLabel: metric.label, format: metric.format });
    }
  }

  for (const col of columns) {
    trh.appendChild(el("th", { text: col.metricLabel }));
  }

  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = el("tbody");

  const singleMonth = months.length === 1;

  for (const company of companies) {
    const tr = el("tr");

    tr.appendChild(el("td", {}, [
      el("div", { text: company.name }),
      el("div", { className: "muted", text: company.id })
    ]));

    tr.appendChild(el("td", { text: company.domain }));

    for (const col of columns) {
      let value;

      if (singleMonth) {
        const snap = snapshots.find(s => s.month === months[0]);
        value = snap?.values?.[company.id]?.[col.datasetId]?.[col.metricId];
      } else {
        // Average across available months in range
        const values = snapshots
          .map(s => s?.values?.[company.id]?.[col.datasetId]?.[col.metricId])
          .filter(v => v !== null && v !== undefined && !Number.isNaN(Number(v)));

        if (values.length === 0) value = null;
        else value = Math.round(values.reduce((a, b) => a + Number(b), 0) / values.length);
      }

      tr.appendChild(el("td", { text: formatValue(value, col.format) }));
    }

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  return table;
}

let cachedData = null;

async function loadData() {
  if (cachedData) return cachedData;
  const res = await fetch(DATA_URL, { cache: "no-cache" });
  cachedData = await res.json();
  return cachedData;
}

function getLatestMonth(data) {
  const months = data.snapshots.map(s => s.month).sort();
  return months[months.length - 1]; // last ascending
}

function refresh() {
  const data = cachedData;
  const latestMonth = getLatestMonth(data);
  const months = getRangeMonths(latestMonth, state.timeRange);

  document.getElementById("lastUpdated").textContent =
    `Sample data loaded. Latest month in dataset: ${latestMonth}. Showing: ${months.join(", ")}.`;

  const companies = data.companies.filter(c => state.selectedCompanies.has(c.id));
  const datasets = data.datasets.filter(d => state.selectedDatasets.has(d.id));

  const mount = document.getElementById("metricsDisplay");
  mount.innerHTML = "";

  if (companies.length === 0) {
    mount.appendChild(el("p", { className: "muted", text: "No companies selected." }));
    return;
  }

  if (datasets.length === 0) {
    mount.appendChild(el("p", { className: "muted", text: "No datasets selected." }));
    return;
  }

  mount.appendChild(buildTable(data, months, companies, datasets));
}

async function init() {
  const data = await loadData();

  // Defaults: all on
  for (const c of data.companies) state.selectedCompanies.add(c.id);
  for (const d of data.datasets) state.selectedDatasets.add(d.id);

  const companyToggle = document.getElementById("companyToggle");
  const datasetToggle = document.getElementById("datasetToggle");

  renderToggles(companyToggle, data.companies, state.selectedCompanies, (c) => c.name);
  renderToggles(datasetToggle, data.datasets, state.selectedDatasets, (d) => d.name);

  document.getElementById("timeRange").addEventListener("change", (e) => {
    state.timeRange = e.target.value;
    refresh();
  });

  document.getElementById("companiesAllOn").addEventListener("click", () => {
    data.companies.forEach(c => state.selectedCompanies.add(c.id));
    renderToggles(companyToggle, data.companies, state.selectedCompanies, (c) => c.name);
    refresh();
  });
  document.getElementById("companiesAllOff").addEventListener("click", () => {
    state.selectedCompanies.clear();
    renderToggles(companyToggle, data.companies, state.selectedCompanies, (c) => c.name);
    refresh();
  });

  document.getElementById("datasetsAllOn").addEventListener("click", () => {
    data.datasets.forEach(d => state.selectedDatasets.add(d.id));
    renderToggles(datasetToggle, data.datasets, state.selectedDatasets, (d) => d.name);
    refresh();
  });
  document.getElementById("datasetsAllOff").addEventListener("click", () => {
    state.selectedDatasets.clear();
    renderToggles(datasetToggle, data.datasets, state.selectedDatasets, (d) => d.name);
    refresh();
  });

  refresh();
}

init().catch((err) => {
  const mount = document.getElementById("metricsDisplay");
  mount.innerHTML = "";
  mount.appendChild(el("pre", { text: String(err?.stack || err) }));
});
