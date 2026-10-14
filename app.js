const membersEl = document.getElementById("members");
const searchEl = document.getElementById("search");

function cardHtml(member) {
  const list = activeItems(member.id);
  const done = list.filter((i) => i.done).length;
  const items = list.length
    ? list.map((item) => `
        <li class="item ${item.done ? "done" : ""}" data-item="${item.id}">
          <input type="checkbox" data-action="toggle" ${item.done ? "checked" : ""} aria-label="Strike off">
          <span class="text">${escapeHtml(item.text)}</span>
          <button class="btn-icon del" data-action="delete-item" title="Delete">✕</button>
        </li>`).join("")
    : `<li class="empty">No agendas yet.</li>`;

  return `
    <section class="card" data-list="${member.id}">
      <div class="card-head">
        <span class="avatar" style="background:${colorFor(member.id)}">${escapeHtml(initials(member.name))}</span>
        <span class="title">${escapeHtml(member.name)}</span>
        <span class="count">${done}/${list.length}</span>
        <button class="btn-icon" data-action="refresh" title="Move struck-off agendas to the Bin" ${done ? "" : "disabled"}>⟳ Refresh</button>
        <button class="btn-icon" data-action="remove-member" title="Remove member">✕</button>
      </div>
      <div class="card-body">
        <form class="row" data-action="add-item">
          <input type="text" name="text" placeholder="Add an agenda for ${escapeHtml(member.name)}…" autocomplete="off" required>
          <button type="submit">Add</button>
        </form>
        <ul class="items">${items}</ul>
      </div>
    </section>`;
}

function render() {
  // Re-rendering replaces the cards, so carry over half-typed agendas and focus
  const drafts = {};
  membersEl.querySelectorAll("[data-list]").forEach((card) => {
    drafts[card.dataset.list] = card.querySelector('input[name="text"]').value;
  });
  const active = document.activeElement;
  const focusedList = active?.name === "text" ? active.closest("[data-list]")?.dataset.list : null;

  const q = searchEl.value.trim().toLowerCase();
  const shown = data.members.filter((m) => m.name.toLowerCase().includes(q));
  if (!db) {
    membersEl.innerHTML = "";
  } else if (!data.members.length) {
    membersEl.innerHTML = `<p class="empty">No team members yet — add one above to start adding agendas.</p>`;
  } else if (!shown.length) {
    membersEl.innerHTML = `<p class="empty">No team member matches “${escapeHtml(searchEl.value.trim())}”.</p>`;
  } else {
    membersEl.innerHTML = shown.map(cardHtml).join("");
  }

  for (const [id, value] of Object.entries(drafts)) {
    const input = membersEl.querySelector(`[data-list="${id}"] input[name="text"]`);
    if (input) input.value = value;
  }
  if (focusedList) membersEl.querySelector(`[data-list="${focusedList}"] input[name="text"]`)?.focus();
  updateBinBadge();
}

// ---------- Event handling (delegated) ----------
searchEl.addEventListener("input", render);

document.addEventListener("submit", (e) => {
  const form = e.target;
  if (form.id === "add-member-form") {
    e.preventDefault();
    const input = document.getElementById("member-name");
    const name = input.value.trim();
    if (!name || !db) return;
    input.value = "";
    actions.addMember(name);
    return;
  }
  if (form.dataset.action === "add-item") {
    e.preventDefault();
    const text = form.elements.text.value.trim();
    if (!text) return;
    form.elements.text.value = "";
    actions.addAgenda(Number(form.closest("[data-list]").dataset.list), text);
  }
});

document.addEventListener("change", (e) => {
  if (e.target.dataset.action !== "toggle") return;
  actions.setDone(Number(e.target.closest("[data-item]").dataset.item), e.target.checked);
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  const card = btn?.closest("[data-list]");
  if (!card) return;
  const member = data.members.find((m) => m.id === Number(card.dataset.list));

  switch (btn.dataset.action) {
    case "refresh":
      actions.refresh(member.id);
      break;
    case "delete-item":
      actions.deleteAgenda(Number(btn.closest("[data-item]").dataset.item));
      break;
    case "remove-member":
      if (confirm(`Remove ${member.name} and all their agendas, including any in the Bin?`)) {
        actions.removeMember(member.id);
      }
      break;
  }
});

setupThemeToggle();
connect(render).then((ok) => ok && offerLegacyImport());
