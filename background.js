chrome.runtime.onInstalled.addListener(() => {
  const defaultProfile = {
    name: "Your Name",
    email: "you@example.com",
    phone: "+91 9876543210",
    country: "India",
    linkedin: "https://linkedin.com/in/yourprofile",
    github: "https://github.com/yourprofile"
  };

  chrome.storage.local.get("profile", ({ profile }) => {
    if (!profile) {
      chrome.storage.local.set({ profile: defaultProfile });
    }
  });
});
