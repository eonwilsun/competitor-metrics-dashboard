import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

const COMPANIES_PATH = path.join(ROOT, "config", "companies.json");
const SETTINGS_PATH = path.join(ROOT, "config", "settings.json");
const METRICS_PATH = path.join(ROOT, "data", "metrics.json");

function monthKeyUTC(d = new Date()) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries(fn, { retries = 3, baseDelayMs = 5000 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const delay = baseDelayMs * Math.max(1, i + 1);
      console.log(
        `Retry ${i + 1}/${retries + 1} after error: ${String(e?.message || e)}. Sleeping ${delay}ms...`
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}

async function readJsonSafe(p, fallback) {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch (e) {
    console.log(`Warning: could not read/parse ${p}. Using fallback. Error=${String(e?.message || e)}`);
    return fallback;
  }
}

async function writeJson(p, obj) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url}\n${text}`);
  }
  return res.json();
}

/**
 * SEMrush starter: domain_rank -> organic traffic (Ot) and organic keywords (Or)
 */
async function semrushDomainRank({ apiKey, domain, database }) {
  const url =
    "https://api.semrush.com/?" +
    new URLSearchParams({
      type: "domain_rank",
      key: apiKey,
      domain,
      database,
      export_columns: "Dn,Ot,Or"
    }).toString();

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SEMrush error HTTP ${res.status} for ${domain}\n${text}`);
  }
  const text = await res.text();

  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { organicTraffic: null, organicKeywords: null };

  const headers = lines[0].split(";");
  const values = lines[1].split(";");

  const idxOt = headers.indexOf("Ot");
  const idxOr = headers.indexOf("Or");

  const organicTraffic = idxOt >= 0 ? Number(values[idxOt]) : null;
  const organicKeywords = idxOr >= 0 ? Number(values[idxOr]) : null;

  return {
    organicTraffic: Number.isFinite(organicTraffic) ? organicTraffic : null,
    organicKeywords: Number.isFinite(organicKeywords) ? organicKeywords : null
  };
}

async function gdeltMentionsCount({ query, windowDays }) {
  const end = new Date();
  const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const fmt = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return (
      d.getUTCFullYear() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds())
    );
  };

  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc?" +
    new URLSearchParams({
      query,
      mode: "timelinevolraw",
      format: "json",
      startdatetime: fmt(start),
      enddatetime: fmt(end)
    }).toString();

  const json = await fetchJson(url);
  const timeline = json?.timeline || [];
  const total = timeline.reduce((sum, row) => sum + (Number(row?.value) || 0), 0);
  return total || 0;
}

function normalizeMetricsShape(metrics, companiesCfg) {
  const out = metrics && typeof metrics === "object" ? metrics : {};

  if (!Array.isArray(out.snapshots)) out.snapshots = [];
  if (!Array.isArray(out.companies)) out.companies = [];
  if (!Array.isArray(out.datasets)) out.datasets = [];

  out.companies = companiesCfg.companies.map(({ id, name, domain }) => ({ id, name, domain }));
  out.generatedAt = out.generatedAt || new Date().toISOString();

  return out;
}

async function main() {
  const apiKey = process.env.SEMRUSH_API_KEY;
  if (!apiKey) throw new Error("Missing SEMRUSH_API_KEY env var.");

  const companiesCfg = await readJsonSafe(COMPANIES_PATH, { companies: [] });
  if (!Array.isArray(companiesCfg.companies) || companiesCfg.companies.length === 0) {
    throw new Error("config/companies.json is missing or has no companies.");
  }

  const settings = await readJsonSafe(SETTINGS_PATH, {});
  const database = settings?.semrush?.database || "uk";
  const windowDays = settings?.press?.windowDays ?? 30;

  const month = monthKeyUTC(new Date());

  const metricsRaw = await readJsonSafe(METRICS_PATH, {
    generatedAt: new Date().toISOString(),
    companies: [],
    datasets: [],
    snapshots: []
  });

  const metrics = normalizeMetricsShape(metricsRaw, companiesCfg);

  const values = {};

  console.log(`Refreshing metrics for month=${month}`);
  console.log(`SEMrush database=${database}, Press windowDays=${windowDays}`);
  console.log(`Companies: ${companiesCfg.companies.length}`);

  for (const c of companiesCfg.companies) {
    console.log(`\nCompany: ${c.name} (${c.domain})`);

    let organicTraffic = null;
    let organicKeywords = null;

    try {
      const seo = await withRetries(
        async () => semrushDomainRank({ apiKey, domain: c.domain, database }),
        { retries: 2, baseDelayMs: 2500 }
      );
      organicTraffic = seo.organicTraffic;
      organicKeywords = seo.organicKeywords;
      console.log(`  SEMrush: traffic=${organicTraffic}, keywords=${organicKeywords}`);
    } catch (e) {
      console.log(`  SEMrush failed: ${String(e?.message || e)}`);
    }

    let mentionsMonthly = null;
    try {
      mentionsMonthly = await withRetries(
        async () =>
          gdeltMentionsCount({
            query: c.pressQuery || c.name,
            windowDays
          }),
        { retries: 4, baseDelayMs: 7000 }
      );
      console.log(`  GDELT mentions (last ${windowDays}d): ${mentionsMonthly}`);
    } catch (e) {
      console.log(`  GDELT failed (will store null): ${String(e?.message || e)}`);
      mentionsMonthly = null;
    }

    await sleep(7500);

    values[c.id] = {
      seo: {
        authorityScore: null,
        refDomains: null,
        organicKeywords,
        organicTraffic
      },
      instagram: { followers: null, postsMonthly: null, engagementsMonthly: null },
      metaAds: { adsRunning: null },
      press: { mentionsMonthly }
    };
  }

  const existingIdx = metrics.snapshots.findIndex((s) => s?.month === month);
  const snapshot = { month, values };

  if (existingIdx >= 0) metrics.snapshots[existingIdx] = snapshot;
  else metrics.snapshots.push(snapshot);

  metrics.snapshots.sort((a, b) => (a.month < b.month ? -1 : 1));
  metrics.generatedAt = new Date().toISOString();

  await writeJson(METRICS_PATH, metrics);
  console.log(`\nUpdated ${METRICS_PATH} for month=${month}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
