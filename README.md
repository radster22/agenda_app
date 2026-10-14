# Agenda

A simple agenda app with a notebook per team member. Live at https://radster22.github.io/agenda_app/

- Add a team member, then add agendas to their notebook.
- Search (top bar) filters to a single member.
- Tick a checkbox to strike off an agenda.
- Press **Refresh** on a member's list to move their struck-off agendas to the **Bin**.
- The Bin (top-right) lets you restore or permanently delete items.

## Data

Agendas are stored in [Supabase](https://supabase.com) (tables in `supabase/schema.sql`), so every
browser sees the same board and open pages update live. Anyone with the link can read and edit.
Connection settings are in `config.js`; the publishable key there is meant to be public.

## Deployment

- Pushing to `master` deploys to GitHub Pages via `.github/workflows/pages.yml`.
- `.github/workflows/keepalive.yml` pings the database every 3 days so the free Supabase project
  doesn't pause. It uses the `SUPABASE_URL` and `SUPABASE_KEY` repository secrets.
