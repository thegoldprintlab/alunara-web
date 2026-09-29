/**
 * Patch .vercel/output/config.json selepas `vercel build`.
 *
 * Kenapa perlu: Vercel jana catch-all SPA rewrite `/(.*) -> /index.html`.
 * Akibatnya SEMUA URL tak dikenali (termasuk /admin yang dah dibuang) pulangkan
 * 200 + kandungan homepage = "soft 404". Google benci ni dan ia buang kredibiliti
 * laman. Kita ganti catch-all dengan senarai laluan yang memang wujud; selebihnya
 * pulangkan 404 betul.
 *
 * Jalankan selepas `vercel build`:
 *   npm run deploy
 */
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CFG = join(ROOT, '.vercel/output/config.json')

/** Laluan SPA yang sah (client routing). Lain semua -> 404. */
const SPA_ROUTES = [
  '/',
  '/pakej',
  '/tema',
  '/tema/rustic',
  '/tema/minimalist',
  '/tema/floral',
  '/galeri',
  '/harga-hantar',
  '/checklist',
  '/hubungi',
  '/tempah',
  // Panel dalaman. Wujud (200) tetapi noindex + Disallow dalam robots.txt.
  // Jangan keluarkan dari senarai ini tanpa sebab — kalau tiada, /admin
  // jadi 404 dan bos tak boleh log masuk.
  '/admin',
  // Self-serve: client cipta gallery sendiri guna unlock code.
  '/buku-tamu/buat',
]

/**
 * Laluan SPA BERCORAK (kod dinamik) — tak boleh masuk SPA_ROUTES sebab ia
 * padanan tepat. Tanpa ini, /buku-tamu/<kod> jatuh ke 404 betul dan tetamu
 * tak boleh buka QR langsung.
 */
const SPA_PATTERNS = [
  // Kod majlis: 6 aksara dari abjad tanpa 0/O/1/I/L. Longgar sedikit supaya
  // kod lama / huruf kecil pun sampai ke React (React yang tolak, bukan 404).
  '^/buku-tamu/[A-Za-z0-9]{4,12}/?$',
  // Slug peribadi gallery (v2) — huruf/angka/sempang, cth. ali-abu.
  '^/buku-tamu/[a-z0-9][a-z0-9-]{1,40}/?$',
  // Tanpa kod — halaman KodTiada (QR rosak / kod tercicir). Sengaja di sini,
  // bukan dalam SPA_ROUTES, supaya senarai tepat kekal bersih.
  '^/buku-tamu/?$',
]

/** Route lama — redirect 308 ke laluan baru (link/bio lama tak mati). */
const REDIRECTS = [
  { src: '^/book/?$', dest: '/tempah' },
  { src: '^/gallery/?$', dest: '/galeri' },
  { src: '^/contact/?$', dest: '/hubungi' },
  { src: '^/payment/?$', dest: '/hubungi' },
]

if (!existsSync(CFG)) {
  console.error('[patch-config] .vercel/output/config.json tak ada — jalankan `vercel build` dulu')
  process.exit(1)
}

const cfg = JSON.parse(await readFile(CFG, 'utf8'))

// Buang catch-all SPA + blok 404 lama; kita bina semula.
// Peraturan /api/* Vercel DIBIARKAN (fungsi serverless mesti sampai).
const routes = (cfg.routes ?? []).filter(
  (r) =>
    !(r.handle === 'error' || r.handle === 'miss' || r.src === '^(?:/(.*))$') &&
    !(r.status === 404 && String(r.src).startsWith('^(?!/api)')) &&
    !(r.src === '^/api(/.*)?$' && r.status === 404),
)

// Cari kedudukan handle filesystem; letak peraturan kita selepasnya.
const fsIdx = routes.findIndex((r) => r.handle === 'filesystem')
const tail = fsIdx >= 0 ? routes.slice(fsIdx + 1) : routes

const ours = [
  ...REDIRECTS.map((r) => ({ ...r, status: 308 })),
  ...SPA_ROUTES.map((p) => ({ src: `^${p === '/' ? '/' : p}/?$`, dest: '/index.html' })),
  ...SPA_PATTERNS.map((src) => ({ src, dest: '/index.html' })),
  { status: 404, src: '^(?!/api).*$', dest: '/404.html' },
  { handle: 'error' },
]

const head = fsIdx >= 0 ? routes.slice(0, fsIdx + 1) : [{ handle: 'filesystem' }]
cfg.routes = [...head, ...ours, ...tail]

await writeFile(CFG, JSON.stringify(cfg, null, 2) + '\n', 'utf8')
console.log(
  `[patch-config] routes ditulis semula — ${SPA_ROUTES.length} laluan sah, ${SPA_PATTERNS.length} corak, ${REDIRECTS.length} redirect, 404 betul`,
)
