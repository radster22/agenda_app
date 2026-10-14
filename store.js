// Shared data layer for the agenda pages. Everything is saved in localStorage.
const STORE_KEY = "agenda-app-v1";
const THEME_KEY = "agenda-theme";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultState() {
  return { lists: [], bin: [] };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const state = JSON.parse(raw);
    if (!Array.isArray(state.lists) || !Array.isArray(state.bin)) return defaultState();
    // Older versions had a standalone "main" list; keep it as a member only if it holds agendas
    state.lists = state.lists.filter((l) => l.id !== "main" || l.items.length);
    return state;
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    alert("Could not save — your browser may be blocking storage.");
  }
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function colorFor(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 48%)`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function updateBinBadge(state) {
  const badge = document.getElementById("bin-count");
  if (badge) {
    badge.textContent = state.bin.length;
    badge.dataset.count = state.bin.length;
  }
}

// ---------- Theme (dark by default) ----------
function currentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function setupThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const paint = () => {
    const dark = currentTheme() === "dark";
    btn.textContent = dark ? "☀️ Light" : "🌙 Dark";
    btn.title = dark ? "Switch to light mode" : "Switch to dark mode";
  };
  btn.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch {}
    paint();
  });
  paint();
}
