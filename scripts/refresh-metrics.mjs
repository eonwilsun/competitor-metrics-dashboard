import fs from "node:fs/promises";
import path from "node:path";
import { scrapeInstagramProfile } from "./instagram-scrape-playwright.mjs";

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

async function withRetries(fn, { retries = 2, baseDelayMs = 3000 } = {}) {
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

async function fetchText(url) {
  const res = await fetch(url);
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}\n${text}`);
  return text;
}

async function fetchJsonLenient(url) {
  const res = await fetch(url);
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}\n${text}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response for ${url}\n${text.slice(0, 200)}`);
  }
}

function pickDatabaseOrder(domain, defaultDb) {
  const d = (domain || "").toLowerCase();
  const isUk = d.endsWith(".co.uk") || d.endsWith(".org.uk") || d.endsWith(".ac.uk");
  const isCom = d.endsWith(".com");
  if (isCom) return ["us", defaultDb].filter(Boolean);
  if (isUk) return [defaultDb || "uk", "us"].filter(Boolean);
  return [defaultDb || "uk", "us"].filter(Boolean);
}

function parseSemrushDomainRank(text) {
  const t = (text || "").trim();
  if (!t) return { organicTraffic: null, organicKeywords: null, error: "Empty SEMrush response" };
  if (/^ERROR/i.test(t)) return { organicTraffic: null, organicKeywords: null, error: t };

  const lines = t.split(/\r?\n/);
  if (lines.length < 2) {
    return { organicTraffic: null, organicKeywords: null, error: `Unexpected SEMrush format: ${t.slice(0, 120)}` };
  }

  const headers = lines[0].split(";");
  const values = lines[1].split(";");

  const idxTraffic = headers.indexOf("Ot") >= 0 ? headers.indexOf("Ot") : headers.indexOf("Organic Traffic");
  const idxKeywords = headers.indexOf("Or") >= 0 ? headers.indexOf("Or") : headers.indexOf("Organic Keywords");

  const organicTraffic = idxTraffic >= 0 ? Number(values[idxTraffic]) : null;
  const organicKeywords = idxKeywords >= 0 ? Number(values[idxKeywords]) : null;

  return {
    organicTraffic: Number.isFinite(organicTraffic) ? organicTraffic : null,
    organicKeywords: Number.isFinite(organicKeywords) ? organicKeywords : null,
    error: null
  };
}

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

  const text = await fetchText(url);
  return parseSemrushDomainRank(text);
}

function gdeltWrapOrQuery(q) {
  if (!q) return q;
  const trimmed = q.trim();
  if (/\sOR\s/i.test(trimmed) && !(trimmed.startsWith("(") && trimmed.endsWith(")"))) {
    return `(${trimmed})`;
  }
  return trimmed;
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

  const safeQuery = gdeltWrapOrQuery(query);

  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc?" +
    new URLSearchParams({
      query: safeQuery,
      mode: "timelinevolraw",
      format: "json",
      startdatetime: fmt(start),
      enddatetime: fmt(end)
    }).toString();

  const json = await fetchJsonLenient(url);
  const timeline = json?.timeline || [];
  const total = timeline.reduce((sum, row) => sum + (Number(row?.value) || 0), 0);
  return total || 0;
}

// --- Instagram (Playwright) helpers ---

function countPostsInWindowFromDatetimes(posts, windowDays) {
  const now = Date.now();
  const start = now - windowDays * 24 * 60 * 60 * 1000;

  let count = 0;
  for (const p of posts || []) {
    const t = Date.parse(p?.datetime || "");
    if (!Number.isFinite(t)) continue;
    if (t >= start && t <= now) count++;
  }
  return count;
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

  const cookiesJson = process.env.IG_SESSION_JSON || "";

  const companiesCfg = await readJsonSafe(COMPANIES_PATH, { companies: [] });
  if (!Array.isArray(companiesCfg.companies) || companiesCfg.companies.length === 0) {
    throw new Error("config/companies.json is missing or has no companies.");
  }

  const settings = await readJsonSafe(SETTINGS_PATH, {});
  const defaultDb = settings?.semrush?.database || "uk";
  const windowDays = settings?.press?.windowDays ?? 30;

  const igEnabled = settings?.instagramScrape?.enabled === true;
  const igWindowDays = settings?.instagramScrape?.windowDays ?? 30;
  const igUsernames =
    settings?.instagramScrape?.usernames && typeof settings.instagramScrape.usernames === "object"
      ? settings.instagramScrape.usernames
      : {};

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
  console.log(`SEMrush defaultDb=${defaultDb}, Press windowDays=${windowDays}`);
  console.log(`Instagram enabled=${igEnabled}, windowDays=${igWindowDays}, usernamesConfigured=${Object.keys(igUsernames).length}`);
  console.log(`Companies: ${companiesCfg.companies.length}`);

  for (const c of companiesCfg.companies) {
    console.log(`\nCompany: ${c.name} (${c.domain})`);

    let organicTraffic = null;
    let organicKeywords = null;

    const dbOrder = pickDatabaseOrder(c.domain, defaultDb);
    for (const db of dbOrder) {
      try {
        const res = await withRetries(async () => semrushDomainRank({ apiKey, domain: c.domain, database: db }), {
          retries: 1,
          baseDelayMs: 2000
        });

        organicTraffic = res.organicTraffic;
        organicKeywords = res.organicKeywords;

        console.log(`  SEMrush (${db}): traffic=${organicTraffic}, keywords=${organicKeywords}`);

        if (organicTraffic !== null || organicKeywords !== null) break;
      } catch (e) {
        console.log(`  SEMrush (${db}) failed: ${String(e?.message || e)}`);
      }
    }

    // Instagram (Playwright)
    let instagramFollowers = null;
    let instagramPostsMonthly = null;

    const username = igUsernames?.[c.id] || null;
    if (igEnabled && username) {
      try {
        const ig = await withRetries(async () => scrapeInstagramProfile({ username, cookiesJson }), {
          retries: 1,
          baseDelayMs: 5000
        });
        instagramFollowers = ig.followers ?? null;
        instagramPostsMonthly = countPostsInWindowFromDatetimes(ig.posts, igWindowDays);

        console.log(
          `  Instagram: followers=${instagramFollowers ?? "null"}, posts(last ${igWindowDays}d)=${instagramPostsMonthly ?? "null"}`
        );
      } catch (e) {
        // If this is an auth error, we want the workflow to fail loudly so you know to add cookies.
        if (String(e?.message || e).includes("INSTAGRAM_AUTH_ERROR")) throw e;

        console.log(`  Instagram failed (storing nulls): ${String(e?.message || e)}`);
        instagramFollowers = null;
        instagramPostsMonthly = null;
      }
    } else {
      console.log("  Instagram: not configured (storing nulls)");
    }

    // GDELT
    let mentionsMonthly = 0;
    try {
      mentionsMonthly = await withRetries(async () => gdeltMentionsCount({ query: c.pressQuery || c.name, windowDays }), {
        retries: 3,
        baseDelayMs: 10000
      });
      console.log(`  GDELT mentions (last ${windowDays}d): ${mentionsMonthly}`);
    } catch (e) {
      console.log(`  GDELT failed (storing 0): ${String(e?.message || e)}`);
      mentionsMonthly = 0;
    }

    await sleep(11000);

    values[c.id] = {
      seo: {
        authorityScore: null,
        refDomains: null,
        organicKeywords,
        organicTraffic
      },
      instagram: { followers: instagramFollowers, postsMonthly: instagramPostsMonthly, engagementsMonthly: null },
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

// In GitHub Actions, some libraries (e.g. Playwright) can keep the Node event loop alive.
// Exiting explicitly prevents the workflow from hanging after the work is done.
process.exit(0);
}

main().catch((err) => {
  console.error(String(err?.message || err));
  process.exit(1);
});