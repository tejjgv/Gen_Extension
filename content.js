// content.js (updated)
// --- Field aliases (simple fuzzy match) ---
const KEY_ALIASES = {
  name: ["name", "full name"],
  email: ["email", "e-mail", "email address"],
  phone: ["phone", "phone number", "mobile"],
  country: ["country", "nationality"],
  linkedin: ["linkedin", "linkedin profile"],
  github: ["github", "github profile"]
};

// normalize helper
function normalize(text) {
  return String(text || "").replace(/[^a-z0-9 ]/gi, "").trim().toLowerCase();
}

// Improved findKeyForText (exact -> alias -> fuzzy)
function findKeyForText(text, profile) {
  const n = normalize(text);

  // 1️⃣ Check exact match in profile keys
  if (profile) {
    for (const key in profile) {
      const nk = normalize(key);
      if (n === nk) return key; // exact match wins
    }
  }

  // 2️⃣ Check alias matches first (more reliable)
  for (const [key, aliases] of Object.entries(KEY_ALIASES)) {
    for (const alias of aliases) {
      const normalizedAlias = normalize(alias);
      // Exact or word boundary match
      try {
        if (
          n === normalizedAlias ||
          new RegExp(`\\b${normalizedAlias}\\b`).test(n)
        ) {
          return key;
        }
      } catch (e) {
        // Fallback (regex could fail on weird alias) -> simple equality
        if (n === normalizedAlias) return key;
      }
    }
  }

  // 3️⃣ Fallback: fuzzy partial match (last resort)
  if (profile) {
    for (const key in profile) {
      const nk = normalize(key);
      if (!nk) continue;
      if (n.includes(nk) || nk.includes(n)) {
        return key;
      }
    }
  }

  return null;
}

// --- Storage helper: try sync first, fallback to local ---
// keys: array or string; cb: function(resultObj)
function getStorage(keys, cb) {
  // Prefer sync
  chrome.storage.sync.get(keys, (syncRes) => {
    const lastErr = chrome.runtime.lastError;
    // If sync produced error OR returned nothing meaningful for requested keys, fallback to local
    if (lastErr) {
      // fallback
      chrome.storage.local.get(keys, (localRes) => {
        // clear any runtime.lastError so callers don't see leftover errors
        // (chrome API clears it on success, but we still handle defensively)
        cb(localRes || {});
      });
    } else {
      // If user requested specific keys and syncRes doesn't contain them (undefined),
      // we should check local to ensure we don't miss data that exists locally but not yet synced.
      if (Array.isArray(keys)) {
        let missing = false;
        for (const k of keys) {
          if (syncRes[k] === undefined) { missing = true; break; }
        }
        if (missing) {
          // read local and merge (sync wins when present)
          chrome.storage.local.get(keys, (localRes) => {
            const merged = Object.assign({}, localRes || {}, syncRes || {});
            cb(merged);
          });
          return;
        }
      } else if (typeof keys === "string") {
        if (syncRes[keys] === undefined) {
          chrome.storage.local.get(keys, (localRes) => {
            cb(Object.assign({}, localRes || {}, syncRes || {}));
          });
          return;
        }
      }
      // otherwise use sync result
      cb(syncRes || {});
    }
  });
}

// --- Panel host (shadow DOM for isolation) ---
let panelHost = null;
let panelShadow = null;

function ensurePanelHost() {
  if (panelHost) return;
  panelHost = document.createElement("div");
  panelHost.id = "job-helper-panel-host";
  panelHost.style.position = "fixed";
  panelHost.style.right = "12px";
  panelHost.style.top = "40%";
  panelHost.style.zIndex = "2147483647";
  panelShadow = panelHost.attachShadow({ mode: "open" });
  document.body.appendChild(panelHost);
}

function renderPanel(key, value) {
  ensurePanelHost();

  panelShadow.innerHTML = `
    <style>
      :host { all: initial; }
      .panel {
        box-sizing: border-box;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        color: #111;
        background: #fff;
        border: 1px solid rgba(0,0,0,0.12);
        box-shadow: 0 6px 18px rgba(0,0,0,0.12);
        border-radius: 10px;
        padding: 10px;
        min-width: 240px;
        max-width: 320px;
      }
      .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
      .title { font-weight:700; }
      .value { margin-bottom:8px; word-break:break-word; color:#222; }
      .actions { display:flex; gap:8px; align-items:center; }
      button {
        -webkit-appearance:none;
        appearance:none;
        border: none;
        padding: 6px 8px;
        font-size: 13px;
        border-radius: 6px;
        cursor: pointer;
      }
      button.copy { background:#f3f3f3; color:#111; }
      button.fill { background:#e8f5e9; color:#0b6b2f; }
      button.close {
        background: transparent;
        color:#666;
      }
      button.close::after {
        content: "×";
        font-size: 16px;
      }
      .status { font-size:12px; color:#2d7a2d; margin-left:6px; }
    </style>

    <div class="panel" role="dialog" aria-label="Job Helper">
      <div class="header">
        <div class="title">${escapeHtml(key)}</div>
        <button class="close" title="Close"></button>
      </div>
      <div class="value">${escapeHtml(value || "(empty)")}</div>
      <div class="actions">
        <button class="copy" id="jh-copy">Copy</button>
        <button class="fill" id="jh-fill">Fill</button>
        <div class="status" id="jh-status" aria-hidden="true"></div>
      </div>
    </div>
  `;

  const copyBtn = panelShadow.querySelector("#jh-copy");
  const fillBtn = panelShadow.querySelector("#jh-fill");
  const closeBtn = panelShadow.querySelector(".close");
  const statusEl = panelShadow.querySelector("#jh-status");

  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(value || "");
      flashStatus("Copied", 900);
    } catch (err) {
      flashStatus("Copy failed", 1400);
    }
  };

  fillBtn.onclick = () => {
    const ok = fillActive(value || "");
    if (ok) flashStatus("Filled", 900);
    else flashStatus("No input focused", 1400);
  };

  closeBtn.onclick = () => hidePanel();

  function flashStatus(msg, ms) {
    statusEl.textContent = msg;
    setTimeout(() => { statusEl.textContent = ""; }, ms);
  }
}

function hidePanel() {
  if (!panelHost) return;
  try { panelHost.remove(); } catch {}
  panelHost = null;
  panelShadow = null;
}

// --- Auto copy helper ---
async function autoCopy(key, value) {
  try {
    await navigator.clipboard.writeText(value || "");
    console.log(`Job Helper — auto-copied ${key}: ${value}`);
  } catch (err) {
    console.warn("Job Helper — auto-copy failed:", err);
  }
}

// --- Fill helper ---
function fillActive(value) {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName;
  if (active.isContentEditable) {
    active.focus();
    active.innerText = value;
    active.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  } else if (tag === "INPUT" || tag === "TEXTAREA") {
    active.focus();
    active.value = value;
    active.dispatchEvent(new Event("input", { bubbles: true }));
    active.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  return false;
}

function escapeHtml(str) {
  if (!str && str !== 0) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// --- Selection listener & copy listener ---
// On mouseup (selection)
document.addEventListener("mouseup", () => {
  const sel = window.getSelection().toString().trim();
  if (!sel) return;

  getStorage(["enabled", "profile"], ({ enabled, profile } = {}) => {
    if (enabled === false) return;

    const key = findKeyForText(sel, profile || {});
    console.log("Selected text:", sel, "| Matched key:", key); // Debug log

    if (key) {
      if (profile && profile[key]) {
        const value = profile[key];
        autoCopy(key, value);
        renderPanel(key, value);
      } else {
        // key matched via alias but not present in profile -> show panel with empty value
        renderPanel(key, "");
      }
    }
  });
});

// On explicit copy event (Ctrl+C)
document.addEventListener("copy", () => {
  const sel = window.getSelection().toString().trim();
  if (!sel) return;

  getStorage(["enabled", "profile"], ({ enabled, profile } = {}) => {
    if (enabled === false) return;

    const key = findKeyForText(sel, profile || {});
    if (key) {
      if (profile && profile[key]) {
        const value = profile[key];
        autoCopy(key, value);
        renderPanel(key, value);
      } else {
        renderPanel(key, "");
      }
    }
  });
});

window.addEventListener("beforeunload", hidePanel);

console.log("Job Helper content script loaded");
