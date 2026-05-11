const STORAGE_KEY = "silenzio";
const DEFAULTS = {
  modes: { video: "blur", image: "blur" },
  scope: { type: "all", sites: [] },
  pause: { globalUntil: 0, siteUntil: {} },
  schedule: { enabled: false, days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" },
};

const siteEl = document.getElementById("site");
const notesEl = document.getElementById("notes");
const pauseControls = document.getElementById("pause-controls");
const pauseStatus = document.getElementById("pause-status");
const pauseText = document.getElementById("pause-text");
const resumeBtn = document.getElementById("resume");

let host = "";

function merge(saved) {
  saved = saved || {};
  return {
    modes: { ...DEFAULTS.modes, ...(saved.modes || {}) },
    scope: { ...DEFAULTS.scope, ...(saved.scope || {}) },
    pause: {
      globalUntil: saved.pause?.globalUntil ?? 0,
      siteUntil: { ...(saved.pause?.siteUntil || {}) },
    },
    schedule: { ...DEFAULTS.schedule, ...(saved.schedule || {}) },
  };
}

function load(cb) {
  chrome.storage.local.get([STORAGE_KEY], (res) => cb(merge(res[STORAGE_KEY])));
}

function save(cfg) {
  chrome.storage.local.set({ [STORAGE_KEY]: cfg });
}

function fmtTime(ms) {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function hostMatchesList(sites) {
  return sites.some((s) => host === s || host.endsWith("." + s));
}

function inScopeStatus(cfg) {
  if (cfg.scope.type === "allowlist" && !hostMatchesList(cfg.scope.sites)) {
    return "Not in allowlist — Silenzio inactive on this site.";
  }
  if (cfg.scope.type === "blocklist" && hostMatchesList(cfg.scope.sites)) {
    return "On blocklist — Silenzio inactive on this site.";
  }
  return null;
}

function pausedUntil(cfg) {
  const now = Date.now();
  if (cfg.pause.globalUntil > now) return { until: cfg.pause.globalUntil, scope: "global" };
  const su = cfg.pause.siteUntil?.[host];
  if (su && su > now) return { until: su, scope: "site" };
  return null;
}

function render(cfg) {
  document.querySelectorAll(".row[data-target]").forEach((row) => {
    const target = row.dataset.target;
    const mode = cfg.modes[target];
    row.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === mode);
    });
  });

  const scopeNote = inScopeStatus(cfg);
  const paused = pausedUntil(cfg);

  notesEl.innerHTML = "";
  if (scopeNote) {
    const n = document.createElement("div");
    n.className = "note";
    n.textContent = scopeNote;
    notesEl.appendChild(n);
  }

  if (paused) {
    pauseControls.hidden = true;
    pauseStatus.hidden = false;
    const label = paused.scope === "global" ? "Paused everywhere" : "Paused";
    pauseText.textContent = `${label} until ${fmtTime(paused.until)}`;
  } else {
    pauseControls.hidden = false;
    pauseStatus.hidden = true;
  }
}

async function getActiveHost() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url;
    if (!url) return "";
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

async function init() {
  host = await getActiveHost();
  siteEl.textContent = host || "(no site)";

  load(render);

  document.querySelectorAll(".row[data-target] button").forEach((b) => {
    b.addEventListener("click", () => {
      load((cfg) => {
        const target = b.parentElement.dataset.target;
        cfg.modes[target] = b.dataset.mode;
        save(cfg);
        render(cfg);
      });
    });
  });

  document.querySelectorAll("#pause-controls button").forEach((b) => {
    b.addEventListener("click", () => {
      if (!host) return;
      load((cfg) => {
        const minutes = Number(b.dataset.pause);
        cfg.pause.siteUntil[host] = Date.now() + minutes * 60_000;
        save(cfg);
        render(cfg);
      });
    });
  });

  resumeBtn.addEventListener("click", () => {
    load((cfg) => {
      cfg.pause.globalUntil = 0;
      if (host) delete cfg.pause.siteUntil[host];
      save(cfg);
      render(cfg);
    });
  });

  document.getElementById("open-options").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) render(merge(changes[STORAGE_KEY].newValue));
  });
}

init();
