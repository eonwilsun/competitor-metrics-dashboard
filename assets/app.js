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

  // Agency fee is stored as an object in Xano (e.g. { Weekly: 520, Yearly: ... }).
  // We normalize that into numeric fields for display/editing.
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
  if (Number.isNaN(n)) return null;
  return n;
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

// ... keep existing code ...

function normalizeRow(row) {
  const r = { ...row };

  // --- Agency fee object -> numeric fields
  const feeObj = r.agency_fee_one_child;
  if (feeObj && typeof feeObj === "object") {
    r.agency_fee_one_child_weekly = toNumberOrNull(feeObj.Weekly ?? feeObj.weekly);
    r.agency_fee_one_child_yearly = toNumberOrNull(feeObj.Yearly ?? feeObj.yearly);
  }

  // --- Monthly Instagram objects -> numeric fields (prevent NaN in UI)
  const postsObj = r.number_of_monthly_instagram_posts;
  if (postsObj && typeof postsObj === "object") {
    const total = toNumberOrNull(postsObj.total) ?? toNumberOrNull(postsObj.total_posts);
    if (total !== null) {
      r.number_of_monthly_instagram_posts = total;
    } else {
      const sum = Object.values(postsObj)
        .map(toNumberOrNull)
        .filter(v => v !== null)
        .reduce((a, b) => a + b, 0);
      r.number_of_monthly_instagram_posts = sum;
    }
  }

  const engObj = r.monthly_instagram_engagement;
  if (engObj && typeof engObj === "object") {
    const total = toNumberOrNull(engObj.total_engagement) ?? toNumberOrNull(engObj.total);
    if (total !== null) {
      r.monthly_instagram_engagement = total;
    } else {
      const sum = Object.values(engObj)
        .map(toNumberOrNull)
        .filter(v => v !== null)
        .reduce((a, b) => a + b, 0);
      r.monthly_instagram_engagement = sum;
    }
  }

  return r;
}

async function reloadFromXanoAndRefresh() {
  const rows = await xanoFetch(XANO_TABLE_PATH, { method: "GET" });
  const raw = Array.isArray(rows) ? rows : (rows?.items || rows?.data || []);

  // Normalize fields to prevent object -> NaN UI output.
  state.rows = raw.map(normalizeRow);

  state.latestMonthKey = computeLatestMonthKey(state.rows);

  // ... keep the rest unchanged ...
}
