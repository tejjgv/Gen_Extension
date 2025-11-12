// options.js (stable + export/import, no resume)

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("profileForm");
  const saveBtn = document.getElementById("save");
  const addFieldBtn = document.getElementById("addField");
  const exportBtn = document.getElementById("exportProfile");
  const importBtn = document.getElementById("importProfile");
  const statusEl = document.getElementById("status");

  // --- Helpers ---
  async function safeSetProfile(profile) {
    try {
      await chrome.storage.sync.set({ profile });
      console.log("✅ Profile saved to sync storage");
      statusEl.textContent = "✅ Profile saved to Google sync";
    } catch (err) {
      console.warn("Sync failed, saving locally:", err);
      await chrome.storage.local.set({ profile });
      statusEl.textContent = "⚠️ Saved locally (sync unavailable)";
    }
    setTimeout(() => (statusEl.textContent = ""), 2500);
  }

  async function safeGetProfile() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get("profile", (syncData) => {
          if (chrome.runtime.lastError || !syncData.profile) {
            console.warn("Sync unavailable, reading from local");
            chrome.storage.local.get("profile", (localData) => {
              resolve(localData.profile || {});
            });
          } else {
            resolve(syncData.profile);
          }
        });
      } catch (err) {
        console.error("Error getting profile:", err);
        resolve({});
      }
    });
  }

  function renderForm(profile = {}) {
    form.innerHTML = "";
    Object.keys(profile).forEach((key) => addFieldRow(key, profile[key]));
  }

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

  addFieldBtn.addEventListener("click", () => addFieldRow());

  // --- Export profile ---
  exportBtn.addEventListener("click", async () => {
    const profile = await safeGetProfile();
    const blob = new Blob([JSON.stringify(profile, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "job-helper-profile.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    statusEl.textContent = "✅ Exported successfully";
    setTimeout(() => (statusEl.textContent = ""), 2000);
  });

  // --- Import profile ---
  importBtn.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const importedProfile = JSON.parse(text);
        if (typeof importedProfile !== "object" || Array.isArray(importedProfile)) {
          throw new Error("Invalid file format");
        }
        await safeSetProfile(importedProfile);
        renderForm(importedProfile);
        statusEl.textContent = "✅ Imported successfully";
      } catch (err) {
        console.error("Import failed:", err);
        statusEl.textContent = "❌ Invalid file or format";
      }
      setTimeout(() => (statusEl.textContent = ""), 2500);
    };
    input.click();
  });

  // --- Initial load ---
  const profile = await safeGetProfile();
  if (Object.keys(profile).length) {
    renderForm(profile);
  } else {
    renderForm({
      name: "",
      email: "",
      phone: "",
      country: "",
      linkedin: "",
      github: ""
    });
  }
});
