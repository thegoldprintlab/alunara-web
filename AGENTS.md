# Alunara Web — alunara.my

Sewa meja & kerusi bertema, **Melaka sahaja**. Tagline: **"1 Tarikh, 1 Majlis"**.
React + Vite SPA, di-prerender jadi HTML statik. Deploy Vercel.
Repo: `thegoldprintlab/alunara-web` · Branch: `main`

## Status (kemas kini 2026-10-02)
- Laman + **buku tamu LIVE**. `/admin` berfungsi.
- Buku tamu: poster QR ikut tema, dinding ucapan, had video 60 saat (UI + server).
- **Poster QR ditulis semula (2 Okt)**: font jenama sebenar (Cormorant + Jost)
  dibenam, susun atur majalah (monogram, bingkai garis dua, kad QR bertepi).
  Sebelum ini Helvetica dan tiada susun atur tema — nampak macam resit bank.

## Fail penting
- `src/content.ts` — **SEMUA** harga/teks bisnes (satu fail). `TARIKH_LOCK` di sini.
- `src/lib/tarikhSibuk.ts` — baca tarikh lock dari jadual `alunara_bookings`.
- `src/lib/qrPoster.ts` — penjana poster QR (PDF). Susun atur menegak ada dalam
  satu fungsi `susun(k, kNama)`; **jangan** letak semula `Math.max` pada saiz kad.
- `src/lib/qrPosterFonts.ts` — **JANA AUTOMATIK, jangan edit**. Jana semula:
  `python3 scripts/bina-font-poster.py` (muat turun google/fonts + subset ASCII).
  Selepas jana, sahkan `npx tsc -b` lulus sebelum commit.
- `scripts/uji-qr-poster.mjs` — ujian end-to-end 4 tema × 3 saiz: saiz kertas,
  QR boleh diimbas dari pixel, tiada jalur kosong, kad di atas blok bawah.
- `supabase/` — fungsi SQL (DB `sdzjlekydkwtxjjtrwrh`).
- `api/` — endpoint server.

## Perangkap
- `.env.production` & `SECRETS_LOCAL.md` = **PLACEHOLDER** — jangan percaya.
- `src/lib/qrPosterFonts.ts` pernah di-commit **rosak** (skrip penjana terlepas
  koma → TS1005, build Vercel gagal). Jana semula, `npx tsc -b`, baru commit.
- **Jangan percaya pemeriksa visual sahaja** untuk poster QR — model gambar
  pernah dua kali mendakwa teks "menindih QR" padahal kad bersih (disahkan
  kiraan pixel). Ujian pixel (`uji-qr-poster.mjs`) ialah kebenaran.
- Kredensial Supabase sebenar: cari dalam `state.db` / sejarah sesi.
- **Jangan `git add -A`** — banyak sesi Hermes + cron kongsi working tree.
- **Env Vercel boleh baca via API** (bukan `vercel env pull` yang mask):
  `curl "https://api.vercel.com/v9/projects/prj_QytHsNTbfOTSFPTo8iZhTh5aHc4v/env?teamId=team_Ii0w9ey2O9Xoxjahvty9n6LZ" -H "Authorization: Bearer <token-dari-~/.local/share/com.vercel.cli/auth.json>"`.
  Yang `type=encrypted/sensitive` masih tak decrypt.
- `adminSah` di `api/guestbook-sign.js` panggil `is_admin` RPC di `SUPABASE_URL` — akaun admin sebenar: `arfasyrf@gmail.com`, `nuraliaarj@gmail.com` (project Alunara `sdzj`). Password `test123` dari SECRETS_LOCAL **dah tak sah** (user sign-in 1 Okt).

## Nota teknikal
- **Nota suara = audio/mp4 (AAC), BUKAN webm.** `MediaRecorder` di Safari/iOS
  keluarkan `audio/mp4`; Chrome `audio/webm`. Kod lama hardcode `audio/webm`
  → R2 hidang Content-Type salah → browser tak play. Fix: server terima
  `mime_type` dari klien (`blob.type`), dan presigned GET paksa
  `ResponseContentType` dari lajur `mime_type` DB (self-healing fail lama).

