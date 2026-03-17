// Full assets/app.js replacement (trimmed non-essential UI code for brevity).
// This file wires three buttons:
// - Collect data (existing Zapier flow if you still use it)
// - Trigger GitHub Action via Xano endpoint (secure server-side dispatch) <- new
// - Test Zap (sends test payload to your Zapier catch hook)

const XANO_BASE_URL = "https://x8ki-letl-twmt.n7.xano.io/api:ZvixoXZ8"; // <--- replace with your Xano base if different
const XANO_TRIGGER_PATH = "/trigger_collect_via_github"; // endpoint we'll create in Xano
const ZAPIER_CATCH_HOOK_URL = "PASTE_YOUR_ZAPIER_CATCH_HOOK_URL_HERE"; // if you still use Zapier directly

const SESSION_KEY = "cmd.editKey.v1"; // used by your existing app to store edit key

// Small helpers (only what we need here)
function getEditKey() { return sessionStorage.getItem(SESSION_KEY) || ""; }
function setEditKey(k) { sessionStorage.setItem(SESSION_KEY, k); }
function clearEditKey() { sessionStorage.removeItem(SESSION_KEY); }

function lastMonthKeyUtcYYYYMM() {
  const now = new Date();
  const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  dt.setUTCMonth(dt.getUTCMonth() - 1);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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

// -----------------------------
// 1) Trigger GitHub Actions via Xano endpoint (secure)
// -----------------------------
// This function calls your Xano endpoint: POST /trigger_collect_via_github
// The endpoint will verify the edit key (we send it in the request body), then use
// the server-side stored GITHUB_PAT to call GitHub API and dispatch the workflow.
async function triggerCollectViaXanoWorkflow({ company = "SWIIS", month_key = null } = {}) {
  const mk = month_key || lastMonthKeyUtcYYYYMM();
  const editKey = getEditKey();
  if (!editKey) throw new Error("Not authenticated — please unlock the dashboard first.");

  const payload = {
    company,
    month_key: mk,
    edit_key: editKey
  };

  // Call Xano trigger (Xano checks edit_key vs stored EDIT_KEY and uses GITHUB_PAT to dispatch)
  const res = await xanoFetch(XANO_TRIGGER_PATH, { method: "POST", body: payload, withEditKey: false });
  return res;
}

// -----------------------------
// 2) Zapier trigger (existing flow for tests)
// -----------------------------
async function triggerZapierCollectAgencyFeeSwiisLastMonth() {
  if (!ZAPIER_CATCH_HOOK_URL || ZAPIER_CATCH_HOOK_URL.includes("PASTE_")) {
    throw new Error("Missing ZAPIER_CATCH_HOOK_URL in app.js");
  }

  const payload = {
    secret: "swiissecret",
    action: "collect_agency_fees",
    company: "SWIIS",
    month_key: lastMonthKeyUtcYYYYMM(),
    source_url: "https://www.swiisfostercare.com/fostering/fostering-allowance-pay/"
  };

  const res = await fetch(ZAPIER_CATCH_HOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Zapier hook failed (${res.status}): ${t || res.statusText}`);
  }
  return { ok: true };
}

// -----------------------------
// 3) Small helper to send a test payload to the Zapier hook
// -----------------------------
async function sendTestPayloadToZapier() {
  if (!ZAPIER_CATCH_HOOK_URL || ZAPIER_CATCH_HOOK_URL.includes("PASTE_")) {
    alert("Missing ZAPIER_CATCH_HOOK_URL in app.js. Paste the Zapier hook URL into the constant.");
    return;
  }

  const monthKey = lastMonthKeyUtcYYYYMM();
  const payload = {
    secret: "swiissecret",
    month_key: monthKey,
    action: "collect_agency_fees",
    company: "SWIIS",
    source_url: "https://www.swiisfostercare.com/fostering/fostering-allowance-pay/"
  };

  const res = await fetch(ZAPIER_CATCH_HOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    alert("Test failed: " + (txt || res.statusText));
    return;
  }

  alert("Test payload sent. Check Zapier trigger panel.");
}

// -----------------------------
// Wire buttons
// -----------------------------
window.addEventListener("DOMContentLoaded", () => {
  const collectBtn = document.getElementById("collectDataBtn");
  const triggerBtn = document.getElementById("triggerWorkflowBtn");
  const testBtn = document.getElementById("testZapBtn");

  if (collectBtn) {
    collectBtn.addEventListener("click", async () => {
      const prev = collectBtn.textContent;
      try {
        collectBtn.disabled = true;
        collectBtn.textContent = "Sending...";
        // keep the old behavior if you still want Zapier collect
        await triggerZapierCollectAgencyFeeSwiisLastMonth();
        alert("Zapier collect triggered.");
      } catch (err) {
        alert("Collect failed: " + String(err?.message || err));
      } finally {
        collectBtn.disabled = false;
        collectBtn.textContent = prev;
      }
    });
  }

  if (triggerBtn) {
    triggerBtn.addEventListener("click", async () => {
      const prev = triggerBtn.textContent;
      try {
        triggerBtn.disabled = true;
        triggerBtn.textContent = "Triggering workflow...";
        const result = await triggerCollectViaXanoWorkflow({ company: "SWIIS" });
        // Show basic result
        alert("Workflow triggered (server). Check Actions UI. Response: " + JSON.stringify(result));
      } catch (err) {
        alert("Trigger failed: " + String(err?.message || err));
        console.error(err);
      } finally {
        triggerBtn.disabled = false;
        triggerBtn.textContent = prev;
      }
    });
  }

  if (testBtn) {
    testBtn.addEventListener("click", async () => {
      testBtn.disabled = true;
      testBtn.textContent = "Sending test...";
      try {
        await sendTestPayloadToZapier();
      } catch (err) {
        alert("Test failed: " + String(err?.message || err));
      } finally {
        testBtn.disabled = false;
        testBtn.textContent = "Send test to Zap";
      }
    });
  }
});
