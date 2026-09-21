/**
 * Prerender — tukar SPA React jadi HTML statik untuk setiap laluan awam.
 *
 * Kenapa: laman ni React SPA. Tanpa prerender, bot (Googlebot, Bingbot,
 * WhatsApp/IG preview scraper) dapat <div id="root"></div> kosong sahaja.
 * Google memang boleh render JS, tapi untuk domain baru ia lambat & tak
 * dijamin. Dengan fail HTML sebenar, kandungan terus nampak.
 *
 * Cara: serve dist/ guna http server tempatan, buka setiap laluan dengan
 * chromium headless, dump DOM, tulis ke dist/<laluan>/index.html.
 *
 * Jalankan: npm run build  (build script sudah panggil ini)
 * Skip: PRERENDER=0 npm run build
 */
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { extname, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url)) + '/..'
const DIST = join(ROOT, 'dist')

/** Laluan awam sahaja. /admin & /tempah sengaja di-skip (borang, tiada nilai SEO). */
const ROUTES = [
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
  // /tempah di-prerender supaya deep-link & refresh berfungsi, tapi
  // ia noindex (lihat public/robots.txt) — halaman borang, tiada nilai SEO.
  '/tempah',
]

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

function chromiumBin() {
  for (const c of [
    process.env.CHROME_BIN,
    '/snap/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ]) {
    if (c && existsSync(c)) return c
  }
  return null
}

/** Serve DIST sebagai static + SPA fallback ke index.html. */
function serve() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0])
      let file = join(DIST, urlPath)
      try {
        const s = await stat(file)
        if (s.isDirectory()) file = join(file, 'index.html')
      } catch {
        file = join(DIST, 'index.html')
      }
      try {
        const buf = await readFile(file)
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' })
        res.end(buf)
      } catch {
        res.writeHead(404).end('not found')
      }
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

function dumpDom(bin, url) {
  return new Promise((resolve) => {
    const args = [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--virtual-time-budget=8000',
      '--dump-dom',
      url,
    ]
    const p = spawn(bin, args, { stdio: ['ignore', 'pipe', 'ignore'] })
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    p.on('close', (code) => resolve(code === 0 ? out : null))
    p.on('error', () => resolve(null))
  })
}

async function main() {
  if (process.env.PRERENDER === '0') {
    console.log('[prerender] dilangkau (PRERENDER=0)')
    return
  }
  if (!existsSync(DIST)) {
    console.error('[prerender] dist/ tak ada — jalankan vite build dulu')
    process.exit(1)
  }
  const bin = chromiumBin()
  if (!bin) {
    console.warn('[prerender] chromium tak jumpa — langkau prerender (SPA kekal)')
    return
  }

  const server = await serve()
  const port = server.address().port
  console.log(`[prerender] chromium=${bin} port=${port}`)

  let ok = 0
  for (const route of ROUTES) {
    const url = `http://127.0.0.1:${port}${route}`
    const html = await dumpDom(bin, url)
    if (!html || html.length < 500) {
      console.warn(`[prerender] GAGAL ${route} — kekal SPA`)
      continue
    }
    const outDir = route === '/' ? DIST : join(DIST, route)
    await mkdir(outDir, { recursive: true })
    await writeFile(join(outDir, 'index.html'), html, 'utf8')
    console.log(`[prerender] ok ${route} (${(html.length / 1024).toFixed(1)} kB)`)
    ok++
  }

  server.close()
  console.log(`[prerender] siap — ${ok}/${ROUTES.length} laluan`)
}

main().catch((e) => {
  console.error('[prerender] ralat:', e.message)
  process.exit(1)
})
