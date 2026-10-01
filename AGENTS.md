# Alunara Web — alunara.my

Sewa meja & kerusi bertema, **Melaka sahaja**. Tagline: **"1 Tarikh, 1 Majlis"**.
React + Vite SPA, di-prerender jadi HTML statik. Deploy Vercel.
Repo: `thegoldprintlab/alunara-web` · Branch: `main`

## Status (kemas kini 2026-10-01)
- Laman + **buku tamu LIVE**. `/admin` berfungsi.
- Buku tamu: poster QR ikut tema, dinding ucapan, had video 60 saat (UI + server).

## Fail penting
- `src/content.ts` — **SEMUA** harga/teks bisnes (satu fail). `TARIKH_LOCK` di sini.
- `src/lib/tarikhSibuk.ts` — baca tarikh lock dari jadual `alunara_bookings`.
- `supabase/` — fungsi SQL (DB `sdzjlekydkwtxjjtrwrh`).
- `api/` — endpoint server.

## Perangkap
- `.env.production` & `SECRETS_LOCAL.md` = **PLACEHOLDER** — jangan percaya.
- Kredensial Supabase sebenar: cari dalam `state.db` / sejarah sesi.
- **Jangan `git add -A`** — banyak sesi Hermes + cron kongsi working tree.

## Seterusnya
- (kemas kini di sini bila kerja baru bermula)
