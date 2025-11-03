// options.js

const form = document.getElementById("profileForm");
const saveBtn = document.getElementById("save");
const addFieldBtn = document.getElementById("addField");
const statusEl = document.getElementById("status");

// --- Render fields dynamically ---
function renderForm(profile = {}) {
  form.innerHTML = ""; // clear old content

  Object.keys(profile).forEach((key) => {
    addFieldRow(key, profile[key]);
  });
}

// --- Add a new row for a field ---
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

// --- Save profile data ---
saveBtn.addEventListener("click", () => {
  const fields = form.querySelectorAll(".field");
  const profile = {};
  fields.forEach((f) => {
    const [keyInput, valueInput] = f.querySelectorAll("input");
    const key = keyInput.value.trim().toLowerCase();
    const value = valueInput.value.trim();
    if (key) {
      profile[key] = value;
    }
  });

  chrome.storage.local.set({ profile }, () => {
    statusEl.textContent = "......Saved!";
    setTimeout(() => (statusEl.textContent = ""), 1500);
  });
});

const resumeUpload = document.getElementById("resume-upload");
const resumeStatus = document.getElementById("resume-status");

resumeUpload.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const base64 = reader.result.split(",")[1];
    chrome.storage.local.set({
      resume: {
        name: file.name,
        type: file.type,
        data: base64
      }
    }, () => {
      resumeStatus.textContent = `Saved: ${file.name}`;
    });
  };
  reader.readAsDataURL(file);
});

// Load status on page open
chrome.storage.local.get("resume", ({ resume }) => {
  if (resume) {
    resumeStatus.textContent = `Saved: ${resume.name}`;
  }
});


// --- Add new empty field ---
addFieldBtn.addEventListener("click", () => {
  addFieldRow();
});

// --- Load saved profile ---
chrome.storage.local.get("profile", ({ profile }) => {
  if (profile) {
    renderForm(profile);
  } else {
    // default initial fields
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
