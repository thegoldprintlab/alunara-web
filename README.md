# ALUNARA — laman web (alunara.my)

Sewa meja & kerusi bertema, Melaka. Tagline: **1 Tarikh, 1 Majlis**.
Laman statik sepenuhnya — React + Vite SPA yang **di-prerender** jadi HTML statik.

## Struktur penting

| Perkara | Di mana |
|---|---|
| Semua harga/teks bisnes | `src/content.ts` (satu fail sahaja) |
| Tarikh yang di-lock | `TARIKH_LOCK` dalam `src/content.ts` |
| Nombor WhatsApp | `WA` / `WA_DISPLAY` dalam `src/content.ts` |
| Title + meta ikut laluan | `src/components/Seo.tsx` |
| SEO statik + JSON-LD | `index.html` |
| Lead → Telegram | `api/lead.js` (env Vercel) |

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

## Supabase — DAH TAK DIPAKAI

Project lama (`sdzjlekydkwtxjjtrwrh.supabase.co`) **tak resolve** — dah mati.
Semua kod Supabase (admin panel, booking DB) dah dibuang.

- Lead sekarang → `api/lead.js` → Telegram bot
- Tarikh lock → `TARIKH_LOCK` dalam `src/content.ts`, bukan DB
- `/admin` dah tiada (404)

Kalau nak DB semula, buat project baru dan set `VITE_SUPABASE_*` di Vercel.
Jangan hidupkan balik project lama.

## Dev

```bash
npm run dev     # vite dev server
npm run build   # build + prerender (tempatan)
npm run lint    # oxlint
```
