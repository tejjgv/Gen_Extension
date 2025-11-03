// Toggle switch for enabling/disabling the extension
const toggle = document.getElementById("ext-toggle");

// Load saved state (default ON)
chrome.storage.local.get("enabled", ({ enabled }) => {
  toggle.checked = enabled !== false;
});

// Update storage on change
toggle.addEventListener("change", () => {
  chrome.storage.local.set({ enabled: toggle.checked });
});

// Open options page when "Edit Profile" is clicked
document.getElementById("edit-profile").addEventListener("click", () => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL("options.html"));
  }
});
