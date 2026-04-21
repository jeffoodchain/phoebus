const defaults = {
  apiKey: "",
  sourceLanguage: "English",
  targetLanguage: "Traditional Chinese",
  model: "gemini-2.5-flash"
};

const $ = (id) => document.getElementById(id);

async function load() {
  const s = await browser.storage.sync.get(defaults);
  $("apiKey").value = s.apiKey || "";
  $("sourceLanguage").value = s.sourceLanguage || defaults.sourceLanguage;
  $("targetLanguage").value = s.targetLanguage || defaults.targetLanguage;
  $("model").value = s.model || defaults.model;
}

async function save() {
  const payload = {
    apiKey: $("apiKey").value.trim(),
    sourceLanguage: $("sourceLanguage").value.trim() || defaults.sourceLanguage,
    targetLanguage: $("targetLanguage").value.trim() || defaults.targetLanguage,
    model: $("model").value || defaults.model
  };
  await browser.storage.sync.set(payload);
  flashStatus(payload.apiKey ? "Saved." : "Saved. Add an API key to enable translation.");
}

function flashStatus(text) {
  const el = $("status");
  el.textContent = text;
  el.classList.add("visible");
  clearTimeout(flashStatus._t);
  flashStatus._t = setTimeout(() => el.classList.remove("visible"), 2400);
}

function toggleKey() {
  const input = $("apiKey");
  const btn = $("toggleKey");
  if (input.type === "password") {
    input.type = "text";
    btn.textContent = "Hide";
  } else {
    input.type = "password";
    btn.textContent = "Show";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  $("save").addEventListener("click", save);
  $("toggleKey").addEventListener("click", toggleKey);
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
  });
});
