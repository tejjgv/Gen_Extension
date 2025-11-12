// options.js (sync version without resume)

const form = document.getElementById("profileForm");
const saveBtn = document.getElementById("save");
const addFieldBtn = document.getElementById("addField");
const statusEl = document.getElementById("status");

// --- Helper: safe storage set with fallback to local ---
async function safeSetProfile(profile) {
  try {
    await chrome.storage.sync.set({ profile });
    console.log("Profile saved to sync storage ✅");
    statusEl.textContent = "✅ Profile synced to Google account";
  } catch (err) {
    console.warn("Sync storage failed, falling back to local:", err);
    await chrome.storage.local.set({ profile });
    statusEl.textContent = "⚠️ Saved locally (sync quota exceeded)";
  }

  setTimeout(() => (statusEl.textContent = ""), 2000);
}

// --- Helper: safe storage get with fallback ---
async function safeGetProfile() {
  return new Promise((resolve) => {
    chrome.storage.sync.get("profile", (syncData) => {
      if (chrome.runtime.lastError || !syncData.profile) {
        console.warn("Sync unavailable, reading from local storage");
        chrome.storage.local.get("profile", (localData) => {
          resolve(localData.profile || {});
        });
      } else {
        resolve(syncData.profile);
      }
    });
  });
}

// --- Render form dynamically ---
function renderForm(profile = {}) {
  form.innerHTML = ""; // clear old content

  Object.keys(profile).forEach((key) => {
    addFieldRow(key, profile[key]);
  });
}

// --- Add a new field row ---
function addFieldRow(key = "", value = "") {
  const wrapper = document.createElement("div");
  wrapper.className = "field";

  const keyInput = document.createElement("input");
  keyInput.placeholder = "Field name (e.g. email)";
  keyInput.value = key;

  const valueInput = document.createElement("input");
  valueInput.placeholder = "Field value (e.g. test@example.com)";
  valueInput.value = value;

  const removeBtn = document.createElement("button");
  removeBtn.textContent = "delete";
  removeBtn.type = "button";
  removeBtn.style.background = "#f44336";
  removeBtn.style.color = "white";
  removeBtn.style.marginLeft = "6px";
  removeBtn.onclick = () => wrapper.remove();

  wrapper.appendChild(keyInput);
  wrapper.appendChild(valueInput);
  wrapper.appendChild(removeBtn);
  form.appendChild(wrapper);
}

// --- Save profile ---
saveBtn.addEventListener("click", async () => {
  const fields = form.querySelectorAll(".field");
  const profile = {};
  fields.forEach((f) => {
    const [keyInput, valueInput] = f.querySelectorAll("input");
    const key = keyInput.value.trim().toLowerCase();
    const value = valueInput.value.trim();
    if (key) profile[key] = value;
  });

  await safeSetProfile(profile);
});

// --- Add new empty field ---
addFieldBtn.addEventListener("click", () => {
  addFieldRow();
});

// --- Load saved profile (on page open) ---
(async () => {
  const profile = await safeGetProfile();
  if (Object.keys(profile).length) {
    renderForm(profile);
  } else {
    // Default starter fields
    renderForm({
      name: "",
      email: "",
      phone: "",
      country: "",
      linkedin: "",
      github: ""
    });
  }
})();
