# ALUNARA — laman web (alunara.my)

Sewa meja & kerusi bertema, Melaka. Tagline: **1 Tarikh, 1 Majlis**.
Laman statik sepenuhnya — React + Vite SPA yang **di-prerender** jadi HTML statik.

## Struktur penting

| Perkara | Di mana |
|---|---|
| Semua harga/teks bisnes | `src/content.ts` (satu fail sahaja) |
| Tarikh yang di-lock (manual) | `TARIKH_LOCK` dalam `src/content.ts` |
| Tarikh yang di-lock (dari panel) | jadual `alunara_bookings` → dibaca `src/lib/tarikhSibuk.ts` |
| Nombor WhatsApp | `WA` / `WA_DISPLAY` dalam `src/content.ts` |
| Title + meta ikut laluan | `src/components/Seo.tsx` |
| SEO statik + JSON-LD | `index.html` |
| Lead → Telegram + DB | `api/lead.js` (env Vercel) |
| Panel admin | `src/pages/Admin.tsx` · logik data `src/lib/admin.ts` |
| Skema DB | `supabase/alunara_admin.sql` |

## Panel admin — `/admin`

Tempat bos daftar klien dan tarikh majlis. Tiga tab: **Tempahan · Klien · Lead Web**.

Log masuk guna Supabase Auth (email + password). Akaun admin mesti ada
`role = 'admin'` dalam jadual `profiles`. Untuk jadikan akaun admin:

```sql
insert into public.profiles (user_id, role) values ('<uuid>', 'admin')
on conflict (user_id) do update set role = 'admin';
```

Cari `<uuid>` di Supabase → Authentication → Users.

### Apa yang berlaku bila bos tambah tempahan

1. Baris masuk `alunara_bookings` (status `pending` atau `confirmed`).
2. Satu tarikh = satu majlis (unique index pada `event_date`; status
   `cancelled` tak dikira).
3. Kalendar awam `/tempah` panggil RPC `alunara_public_booked_dates()` dan
   tanda tarikh itu **kelabu, tak boleh klik**. **Tiada deploy perlu.**

RPC itu sengaja pulangkan **tarikh sahaja** — nama dan telefon pelanggan
tidak pernah sampai ke pelayar orang awam.

### Keselamatan

- `alunara_bookings`, `alunara_clients`, `alunara_leads` — RLS, admin sahaja.
  `anon` tiada grant SELECT langsung.
- RPC awam: `alunara_public_booked_dates()` (tarikh sahaja) dan
  `alunara_public_lead()` (berhad: had bilangan + had 5 lead / 24 jam per nombor).
- **2FA belum dipasang** — Supabase MFA ialah ciri pro berbayar. Kekuatan
  password admin ialah pertahanan sebenar. Tukar dari password lalai.
- Sesi disimpan dalam `localStorage`, bukan cookie HttpOnly.

### Ujian

```bash
npm run preview                                  # port 4173/4188
ALUNARA_ADMIN_PASS='...' node scripts/uji-admin.cjs
ALUNARA_BASE=https://alunara.my ALUNARA_ADMIN_PASS='...' node scripts/uji-admin.cjs
```

Ujian cipta satu tempahan bernama `UJIAN HERMES ADMIN` — **padam selepas ujian**.

```bash
cd ~/gold-plan-web && node -e "..."   # atau padam ikut event_date di /admin
```


## Deploy

```bash
npm run deploy
```

Itu sahaja. Ia buat tiga benda berurutan:

1. `vercel build --prod` — build + **prerender** setiap laluan jadi HTML statik.
2. `node scripts/patch-vercel-config.mjs` — tulis semula routes: laluan sah,
   308 redirect untuk URL lama, dan **404 betul** untuk URL sampah.
3. `vercel deploy --prebuilt --prod` — hantar output yang dah siap.

### Kenapa `--prebuilt`, bukan `vercel --prod`

Vercel build image **tiada chromium**. Kalau deploy biasa, `scripts/prerender.mjs`
auto-skip dan laman jadi SPA kosong semula (Googlebot nampak `<div id="root">`).
`--prebuilt` hantar HTML yang dah diprerender dari mesin ni.

Jangan guna `vercel --prod` untuk laman ni.

### Kalau chromium hilang

Prerender perlukan chromium. Kalau takde:

```bash
sudo snap install chromium
```

Skrip auto-cari `chromium`, `chromium-browser`, `google-chrome`, atau
`CHROME_PATH`. Kalau tak jumpa, ia **skip** dengan amaran (build tak gagal,
tapi SEO rosak).

## SEO

- `public/robots.txt` — allow semua, disallow `/tempah` + `/api/`, tunjuk sitemap
- `public/sitemap.xml` — 10 URL awam
- `public/404.html` — halaman 404 sebenar (status 404, bukan soft-404)
- `public/115d00dfb7319c7ff612f00d91df0ee9.txt` — kunci IndexNow (jangan padam)
- IndexNow dihantar bila deploy → Bing/Yandex. **Google tak guna IndexNow.**

### Submit ke Google (manual, sekali sahaja)

1. https://search.google.com/search-console → tambah property `alunara.my`
2. Verify (guna DNS TXT di Porkbun, atau HTML tag)
3. Sitemaps → submit `https://alunara.my/sitemap.xml`
4. URL Inspection → minta index `https://alunara.my/`

Tanpa langkah ni, Google mungkin ambil minggu/bulan untuk jumpa laman ini.

## Supabase — DIPAKAI SEMULA (2026-09-23)

Panel `/admin` guna project Supabase **Gold Plan** (`gtblmwijohoetczqngpr`) —
bukan project ALUNARA lama yang dah mati (`sdzjlekydkwtxjjtrwrh`).

- Jadual ALUNARA: `alunara_bookings`, `alunara_clients`, `alunara_leads`,
  `alunara_gallery`, `alunara_settings`
- Skema penuh: `supabase/alunara_admin.sql` (idempotent, boleh jalankan semula)
- Admin guna `public.profiles.role = 'admin'` (kongsi dengan Gold Plan)
- Lead → `api/lead.js` → Telegram **dan** jadual `alunara_leads`
- Tarikh lock → DB (`alunara_bookings`) + `TARIKH_LOCK` (manual, digabung)

### GOTCHA — env Vercel vs `.vercel/.env.production.local`

`vercel build` membaca **fail cache** `.vercel/.env.production.local` dan ia
**menang** atas nilai yang diset di dashboard Vercel. Kalau fail ini basi,
bundle produksi akan guna project Supabase lama dan `/admin` akan tersangkut
pada "Menyemak…" (cuba sambung ke host yang dah mati).

Kalau env berubah: **padam `.vercel/.env.production.local` dan `dist/`**,
barulah `npm run deploy`. Sahkan selepas deploy:

```bash
curl -s https://alunara.my/admin | grep -o 'assets/index-[^"]*\.js'
curl -s https://alunara.my/assets/index-XXXX.js | grep -c 'gtblmwijohoetczqngpr'
```

## Dev

```bash
npm run dev     # vite dev server
npm run build   # build + prerender (tempatan)
npm run lint    # oxlint
```
