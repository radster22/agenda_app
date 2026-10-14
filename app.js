let state = loadState();

const membersEl = document.getElementById("members");
const searchEl = document.getElementById("search");

function commit() {
  saveState(state);
  render();
}

function findList(id) {
  return state.lists.find((l) => l.id === id);
}

function cardHtml(list) {
  const done = list.items.filter((i) => i.done).length;
  const items = list.items.length
    ? list.items.map((item) => `
        <li class="item ${item.done ? "done" : ""}" data-item="${item.id}">
          <input type="checkbox" data-action="toggle" ${item.done ? "checked" : ""} aria-label="Strike off">
          <span class="text">${escapeHtml(item.text)}</span>
          <button class="btn-icon del" data-action="delete-item" title="Delete">✕</button>
        </li>`).join("")
    : `<li class="empty">No agendas yet.</li>`;

  return `
    <section class="card" data-list="${list.id}">
      <div class="card-head">
        <span class="avatar" style="background:${colorFor(list.id)}">${escapeHtml(initials(list.name))}</span>
        <span class="title">${escapeHtml(list.name)}</span>
        <span class="count">${done}/${list.items.length}</span>
        <button class="btn-icon" data-action="refresh" title="Move struck-off agendas to the Bin" ${done ? "" : "disabled"}>⟳ Refresh</button>
        <button class="btn-icon" data-action="remove-member" title="Remove member">✕</button>
      </div>
      <div class="card-body">
        <form class="row" data-action="add-item">
          <input type="text" name="text" placeholder="Add an agenda for ${escapeHtml(list.name)}…" autocomplete="off" required>
          <button type="submit">Add</button>
        </form>
        <ul class="items">${items}</ul>
      </div>
    </section>`;
}

function render() {
  const q = searchEl.value.trim().toLowerCase();
  const shown = state.lists.filter((l) => l.name.toLowerCase().includes(q));
  if (!state.lists.length) {
    membersEl.innerHTML = `<p class="empty">No team members yet — add one above to start adding agendas.</p>`;
  } else if (!shown.length) {
    membersEl.innerHTML = `<p class="empty">No team member matches “${escapeHtml(searchEl.value.trim())}”.</p>`;
  } else {
    membersEl.innerHTML = shown.map(cardHtml).join("");
  }
  updateBinBadge(state);
}

// ---------- Event handling (delegated) ----------
searchEl.addEventListener("input", render);

document.addEventListener("submit", (e) => {
  const form = e.target;
  if (form.id === "add-member-form") {
    e.preventDefault();
    const input = document.getElementById("member-name");
    const name = input.value.trim();
    if (!name) return;
    state.lists.push({ id: uid(), name, items: [] });
    input.value = "";
    commit();
    return;
  }
  if (form.dataset.action === "add-item") {
    e.preventDefault();
    const listId = form.closest("[data-list]").dataset.list;
    const text = form.elements.text.value.trim();
    if (!text) return;
    findList(listId).items.push({ id: uid(), text, done: false, created: Date.now() });
    commit();
    // keep focus in the same input for fast entry
    document.querySelector(`[data-list="${listId}"] input[name="text"]`)?.focus();
  }
});

document.addEventListener("change", (e) => {
  if (e.target.dataset.action !== "toggle") return;
  const list = findList(e.target.closest("[data-list]").dataset.list);
  const item = list.items.find((i) => i.id === e.target.closest("[data-item]").dataset.item);
  item.done = e.target.checked;
  commit();
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const card = btn.closest("[data-list]");
  if (!card) return;
  const list = findList(card.dataset.list);

  switch (btn.dataset.action) {
    case "refresh": {
      const struck = list.items.filter((i) => i.done);
      const now = Date.now();
      state.bin.unshift(...struck.map((i) => ({ ...i, owner: list.name, ownerId: list.id, binned: now })));
      list.items = list.items.filter((i) => !i.done);
      commit();
      break;
    }
    case "delete-item": {
      const itemId = btn.closest("[data-item]").dataset.item;
      list.items = list.items.filter((i) => i.id !== itemId);
      commit();
      break;
    }
    case "remove-member": {
      if (!confirm(`Remove ${list.name} and their agendas? Struck-off items already in the Bin are kept.`)) return;
      state.lists = state.lists.filter((l) => l.id !== list.id);
      commit();
      break;
    }
  }
});

// Keep multiple tabs in sync
window.addEventListener("storage", (e) => {
  if (e.key === STORE_KEY) { state = loadState(); render(); }
});

setupThemeToggle();
render();
