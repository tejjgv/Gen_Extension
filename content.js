// --- Field aliases (simple fuzzy match) ---
const KEY_ALIASES = {
  name: ["name", "full name"],
  email: ["email", "e-mail", "email address"],
  phone: ["phone", "phone number", "mobile"],
  country: ["country", "nationality"],
  linkedin: ["linkedin", "linkedin profile"],
  github: ["github", "github profile"],
  resume: ["resume", "cv"]
};

function normalize(text) {
  return text.replace(/[^a-z0-9 ]/gi, "").trim().toLowerCase();
}

function findKeyForText(text, profile) {
  const n = normalize(text);

  // First check direct profile keys (including user-added fields)
  if (profile) {
    for (const key in profile) {
      const nk = normalize(key);
      if (n.includes(nk) || nk.includes(n)) {
        return key;
      }
    }
  }

  // Then check if the text matches any alias
  for (const [key, aliases] of Object.entries(KEY_ALIASES)) {
    for (const alias of aliases) {
      const normalizedAlias = normalize(alias);
      if (n === normalizedAlias || n.includes(normalizedAlias) || normalizedAlias.includes(n)) {
        // Return the key (we'll handle resume separately even if not in profile)
        return key;
      }
    }
  }

  return null;
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
      .resume-box {
        margin-top:10px;
        padding:6px;
        border:1px dashed #aaa;
        border-radius:6px;
        text-align:center;
        cursor:pointer;
        font-size:12px;
        background:#fafafa;
      }
      .resume-box:hover {
        background:#f0f0f0;
        border-color:#888;
      }
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
      <div id="resume-container"></div>
    </div>
  `;

  const copyBtn = panelShadow.querySelector("#jh-copy");
  const fillBtn = panelShadow.querySelector("#jh-fill");
  const closeBtn = panelShadow.querySelector(".close");
  const statusEl = panelShadow.querySelector("#jh-status");
  const resumeContainer = panelShadow.querySelector("#resume-container");

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

  // --- Render resume box if the selected field is "resume" or "cv"
  const normalizedKey = key ? key.toLowerCase() : "";
  if (normalizedKey === "resume" || normalizedKey === "cv") {
    chrome.storage.local.get("resume", ({ resume }) => {
      const resumeBox = document.createElement("div");
      resumeBox.className = "resume-box";

      if (resume && resume.data) {
        resumeBox.textContent = `📄 ${resume.name || "Resume"}`;
        resumeBox.setAttribute("draggable", "true");

        resumeBox.addEventListener("dragstart", (e) => {
          try {
            // Decode base64 to binary
            const byteCharacters = atob(resume.data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: resume.type || "application/pdf" });
            
            // Create a download URL for the file
            const url = URL.createObjectURL(blob);
            
            // Set drag data with download URL
            e.dataTransfer.effectAllowed = "copy";
            e.dataTransfer.setData("DownloadURL", `${resume.type || "application/pdf"}:${resume.name || "resume.pdf"}:${url}`);
            
            // Clean up URL after a delay
            setTimeout(() => URL.revokeObjectURL(url), 100);
          } catch (error) {
            console.error("Error creating draggable resume:", error);
          }
        });

        // Add click handler as alternative to drag
        resumeBox.addEventListener("click", () => {
          try {
            const byteCharacters = atob(resume.data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: resume.type || "application/pdf" });
            const url = URL.createObjectURL(blob);
            
            // Create temporary download link
            const a = document.createElement("a");
            a.href = url;
            a.download = resume.name || "resume.pdf";
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            setTimeout(() => URL.revokeObjectURL(url), 100);
            flashStatus("Downloaded", 900);
          } catch (error) {
            console.error("Error downloading resume:", error);
            flashStatus("Download failed", 1400);
          }
        });

        resumeBox.title = "Click to download or drag to upload";
      } else {
        resumeBox.textContent = "No resume saved";
        resumeBox.style.cursor = "not-allowed";
        resumeBox.title = "Upload a resume in the extension popup";
      }

      resumeContainer.appendChild(resumeBox);
    });
  }

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
document.addEventListener("mouseup", () => {
  const sel = window.getSelection().toString().trim();
  if (!sel) return;
  
  chrome.storage.local.get(["enabled", "profile"], ({ enabled, profile }) => {
    if (enabled === false) return;
    
    const key = findKeyForText(sel, profile);
    console.log("Selected text:", sel, "| Matched key:", key); // Debug log
    
    if (key) {
      // Check if it's in the profile first (for both hardcoded and custom fields)
      if (profile && profile[key]) {
        const value = profile[key];
        autoCopy(key, value);
        renderPanel(key, value);
      }
      // Special handling for resume only if not in profile
      else if (key === "resume") {
        renderPanel(key, "Resume file");
      }
    }
  });
});

document.addEventListener("copy", () => {
  const sel = window.getSelection().toString().trim();
  if (!sel) return;
  
  chrome.storage.local.get(["enabled", "profile"], ({ enabled, profile }) => {
    if (enabled === false) return;
    
    const key = findKeyForText(sel, profile);
    
    if (key) {
      // Check if it's in the profile first (for both hardcoded and custom fields)
      if (profile && profile[key]) {
        const value = profile[key];
        autoCopy(key, value);
        renderPanel(key, value);
      }
      // Special handling for resume only if not in profile
      else if (key === "resume") {
        renderPanel(key, "Resume file");
      }
    }
  });
});

window.addEventListener("beforeunload", hidePanel);

console.log("Job Helper content script loaded");