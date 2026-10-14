# Agenda

A simple agenda app with a notebook per team member.

- Add a team member, then add agendas to their notebook.
- Search (top bar) filters to a single member.
- Tick a checkbox to strike off an agenda.
- Press **Refresh** on a list to move its struck-off agendas to the **Bin**.
- The Bin (top-right) lets you restore or permanently delete items.

Data is stored in your browser (localStorage). No build step — open `index.html`.

Pushing to `master` deploys automatically to GitHub Pages via `.github/workflows/pages.yml`.
