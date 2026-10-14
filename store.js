// Shared data layer: agendas live in Supabase so every browser sees the same board.
const THEME_KEY = "agenda-theme";
const LEGACY_KEY = "agenda-app-v1";
const LEGACY_DONE_KEY = "agenda-app-v1-imported";

const db = SUPABASE_URL && SUPABASE_KEY ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// In-memory copy of the database, kept in sync with Supabase
const data = { members: [], agendas: [] };
let onChange = () => {};

function now() {
  return new Date().toISOString();
}

function memberName(id) {
  return data.members.find((m) => m.id === id)?.name ?? "";
}

function activeItems(memberId) {
  return data.agendas.filter((a) => a.member_id === memberId && !a.binned_at);
}

function binItems() {
  return data.agendas.filter((a) => a.binned_at).sort((x, y) => Date.parse(y.binned_at) - Date.parse(x.binned_at));
}

// ---------- Sync ----------
async function q(request) {
  const { error } = await request;
  if (error) throw error;
}

async function sync() {
  try {
    const [m, a] = await Promise.all([
      db.from("members").select("*").order("id"),
      db.from("agendas").select("*").order("id"),
    ]);
    if (m.error || a.error) throw m.error || a.error;
    data.members = m.data;
    data.agendas = a.data;
    setStatus("");
  } catch (e) {
    console.error(e);
    setStatus("Couldn't reach the database — showing the last loaded data.", true);
  }
  onChange();
}

// Start loading, then keep the page live: re-sync on any change from other browsers
async function connect(render) {
  onChange = render;
  if (!db) {
    setStatus("Database not configured yet — fill in config.js.", true);
    return false;
  }
  setStatus("Loading…");
  await sync();
  let timer;
  const resync = () => { clearTimeout(timer); timer = setTimeout(sync, 250); };
  db.channel("agenda-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "members" }, resync)
    .on("postgres_changes", { event: "*", schema: "public", table: "agendas" }, resync)
    .subscribe();
  window.addEventListener("focus", resync);
  return true;
}

// Apply a change locally right away, then save it; re-sync from the server if saving fails
async function mutate(applyLocal, save) {
  applyLocal();
  onChange();
  try {
    await save();
  } catch (e) {
    console.error(e);
    setStatus(`Couldn't save: ${e.message}`, true);
    await sync();
  }
}

// Inserts wait for the database, since it assigns the numeric ids
async function insert(table, row) {
  try {
    await q(db.from(table).insert(row));
  } catch (e) {
    console.error(e);
    setStatus(`Couldn't save: ${e.message}`, true);
  }
  await sync();
}

const actions = {
  addMember(name) {
    return insert("members", { name });
  },

  // Deleting a member also deletes all their agendas, including ones in the Bin
  removeMember(id) {
    return mutate(() => {
      data.members = data.members.filter((m) => m.id !== id);
      data.agendas = data.agendas.filter((a) => a.member_id !== id);
    }, () => q(db.from("members").delete().eq("id", id)));
  },

  addAgenda(memberId, text) {
    return insert("agendas", { member_id: memberId, text });
  },

  setDone(id, done) {
    return mutate(
      () => { data.agendas.find((a) => a.id === id).done = done; },
      () => q(db.from("agendas").update({ done }).eq("id", id)),
    );
  },

  deleteAgenda(id) {
    return mutate(
      () => { data.agendas = data.agendas.filter((a) => a.id !== id); },
      () => q(db.from("agendas").delete().eq("id", id)),
    );
  },

  // Move a member's struck-off agendas to the Bin
  refresh(memberId) {
    const ids = activeItems(memberId).filter((a) => a.done).map((a) => a.id);
    if (!ids.length) return;
    const binned_at = now();
    return mutate(
      () => data.agendas.forEach((a) => { if (ids.includes(a.id)) a.binned_at = binned_at; }),
      () => q(db.from("agendas").update({ binned_at }).in("id", ids)),
    );
  },

  restore(id) {
    return mutate(
      () => Object.assign(data.agendas.find((a) => a.id === id), { done: false, binned_at: null }),
      () => q(db.from("agendas").update({ done: false, binned_at: null }).eq("id", id)),
    );
  },

  purge(id) {
    return actions.deleteAgenda(id);
  },

  emptyBin() {
    return mutate(
      () => { data.agendas = data.agendas.filter((a) => !a.binned_at); },
      () => q(db.from("agendas").delete().not("binned_at", "is", null)),
    );
  },
};

// One-time upload of agendas saved in this browser by the earlier, local-only version
async function offerLegacyImport() {
  let legacy;
  try {
    if (localStorage.getItem(LEGACY_DONE_KEY)) return;
    legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
  } catch { return; }
  const lists = (legacy?.lists || []).filter((l) => l.id !== "main" || l.items.length);
  if (!lists.length) return;
  const markDone = () => { try { localStorage.setItem(LEGACY_DONE_KEY, "1"); } catch {} };
  if (!confirm(`This browser has ${lists.length} team member(s) saved from before the cloud upgrade. Upload them so they show up everywhere?`)) {
    markDone();
    return;
  }

  try {
    for (const list of lists) {
      const { data: member, error } = await db.from("members").insert({ name: list.name }).select("id").single();
      if (error) throw error;
      const binned = (legacy.bin || []).filter((b) => b.ownerId === list.id);
      const agendas = [
        ...list.items.map((i) => ({ member_id: member.id, text: i.text, done: !!i.done })),
        ...binned.map((b) => ({ member_id: member.id, text: b.text, done: true, binned_at: new Date(b.binned).toISOString() })),
      ];
      if (agendas.length) await q(db.from("agendas").insert(agendas));
    }
    markDone();
  } catch (e) {
    console.error(e);
    setStatus(`Couldn't upload old agendas: ${e.message}`, true);
  }
  await sync();
}

// ---------- UI helpers ----------
function setStatus(message, isError = false) {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = message;
  el.hidden = !message;
  el.classList.toggle("error", isError);
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function colorFor(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 48%)`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function updateBinBadge() {
  const badge = document.getElementById("bin-count");
  if (badge) {
    const count = binItems().length;
    badge.textContent = count;
    badge.dataset.count = count;
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
