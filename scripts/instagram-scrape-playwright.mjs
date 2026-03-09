import { chromium } from "playwright";

function decodeHtmlEntities(s) {
  return (s || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'");
}

function parseCompactNumber(s) {
  const t = (s || "").trim();
  if (!t) return null;
  const normalized = t.replaceAll(",", "").toUpperCase();
  const m = normalized.match(/^(\d+(\.\d+)?)([KM])?$/);
  if (!m) return null;
  const num = Number(m[1]);
  if (!Number.isFinite(num)) return null;
  const unit = m[3];
  if (unit === "K") return Math.round(num * 1_000);
  if (unit === "M") return Math.round(num * 1_000_000);
  return Math.round(num);
}

function classifyAuthProblem(url, pageText) {
  const t = (pageText || "").toLowerCase();
  const u = (url || "").toLowerCase();
  if (u.includes("/accounts/login") || t.includes("log in") || t.includes("login")) return "LOGIN_REQUIRED";
  if (t.includes("challenge required") || t.includes("verify")) return "CHECKPOINT";
  return null;
}

async function dismissCookieDialogIfPresent(page) {
  const candidates = [
    "Only allow essential cookies",
    "Allow essential cookies",
    "Decline optional cookies",
    "Decline",
    "Reject all",
    "Not now"
  ];
  for (const name of candidates) {
    const btn = page.getByRole("button", { name, exact: false });
    if (await btn.first().isVisible().catch(() => false)) {
      await btn.first().click({ timeout: 3000 }).catch(() => {});
      return;
    }
  }
}

async function maybeAddCookies(context, cookiesJson) {
  if (!cookiesJson) return;
  let payload;
  try {
    payload = JSON.parse(cookiesJson);
  } catch {
    throw new Error("IG_SESSION_JSON is not valid JSON.");
  }
  if (!Array.isArray(payload?.cookies) || payload.cookies.length === 0) return;
  await context.addCookies(
    payload.cookies.map((c) => ({
      ...c,
      url: c.url || "https://www.instagram.com/"
    }))
  );
}

export async function scrapeInstagramProfile({ username, cookiesJson }) {
  const profileUrl = `https://www.instagram.com/${username}/`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await maybeAddCookies(context, cookiesJson);

  const page = await context.newPage();

  try {
    await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
    await dismissCookieDialogIfPresent(page);

    const text = await page.textContent("body").catch(() => "");
    const authProblem = classifyAuthProblem(page.url(), text);
    if (authProblem) {
      throw new Error(
        [
          `INSTAGRAM_AUTH_ERROR: ${authProblem}`,
          `Profile: ${profileUrl}`,
          "",
          "Instagram blocked GitHub Actions.",
          "Fix: add/update IG_SESSION_JSON secret then re-run.",
          "See scripts/ig-cookie.md"
        ].join("\n")
      );
    }

    const metaDesc = await page.locator('meta[name="description"]').getAttribute("content").catch(() => null);

    let followers = null;
    if (metaDesc) {
      const decoded = decodeHtmlEntities(metaDesc);
      const m = decoded.match(/([\d.,]+[KM]?)\s+Followers/i);
      if (m) followers = parseCompactNumber(m[1]);
    }

    const postLinks = await page.$$eval('a[href^="/p/"]', (as) => {
      const hrefs = as.map((a) => a.getAttribute("href")).filter(Boolean);
      return Array.from(new Set(hrefs)).slice(0, 18);
    });

    const posts = [];
    for (const href of postLinks) {
      const url = `https://www.instagram.com${href}`;
      const p = await context.newPage();
      try {
        await p.goto(url, { waitUntil: "domcontentloaded" });
        await dismissCookieDialogIfPresent(p);
        const dt = await p.locator("time").first().getAttribute("datetime").catch(() => null);
        if (dt) posts.push({ url, datetime: dt });
      } finally {
        await p.close().catch(() => {});
      }
    }

    return { username, followers, posts };
  } finally {
    await browser.close().catch(() => {});
  }
}