/**
 * uji-muatnaik-video.mjs — uji aliran upload video HUJUNG-KE-HUJUNG.
 *
 * KENAPA: had durasi di UI boleh lulus tetapi upload masih gagal (mime_type,
 * content_type header, laluan R2). Skrip ini tekan "Kongsi video" betul-betul
 * dan semak video muncul dalam galeri.
 *
 * AMARAN: ini MENINGGALKAN satu video dalam majlis ujian. Guna majlis buangan
 * (cth. CUBA24) dan padam kemudian di /admin.
 *
 * CARA GUNA:
 *   node scripts/uji-muatnaik-video.mjs https://alunara.my/buku-tamu/CUBA24 /tmp/video30s.mp4
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const require_ = createRequire(import.meta.url)
const CALON = [
  'playwright',
  '/home/mozacsuck48/gold-plan-web/node_modules/playwright',
  '/home/mozacsuck48/vault-web/node_modules/playwright',
]
let chromium = null
for (const c of CALON) {
  try {
    chromium = (c === 'playwright' ? require_('playwright') : require_(c)).chromium
    if (chromium) break
  } catch {
    /* cuba seterusnya */
  }
}
if (!chromium) {
  console.error('Playwright tak jumpa.')
  process.exit(2)
}

const url = process.argv[2]
const video = process.argv[3] || '/tmp/video30s.mp4'
if (!url || !existsSync(video)) {
  console.error('Guna: node scripts/uji-muatnaik-video.mjs <url> <video.mp4>')
  process.exit(2)
}

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 420, height: 1400 } })
const resp = []
p.on('response', (r) => {
  const u = r.url()
  if (u.includes('/api/') || u.includes('r2.cloudflarestorage') || u.includes('/rest/v1/rpc/')) {
    resp.push(`${r.status()} ${r.request().method()} ${u.split('?')[0].split('/').slice(-1)[0].slice(0, 40)}`)
  }
})

await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
await p.waitForTimeout(2500)

const adaNama = await p.$('input[type="text"], input:not([type])')
if (adaNama) {
  await p.fill('input[type="text"], input:not([type])', 'Uji Upload Video')
  await p.click('button.bt-btn')
  await p.waitForTimeout(2500)
}

await p.evaluate(() => {
  const bt = [...document.querySelectorAll('.bt-tab-btn')].find((x) => x.textContent.includes('Video'))
  if (bt) bt.click()
})
await p.waitForTimeout(600)

const inp = await p.$('input#bt-video')
if (!inp) {
  console.error('TIADA input video')
  await b.close()
  process.exit(1)
}
await inp.setInputFiles(video)
await p.waitForTimeout(4000)

const sebelum = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Kongsi video'))
  return { ada: !!btn, ralat: document.querySelector('.bt-ralat')?.textContent?.trim() || '' }
})
console.log('sebelum hantar:', JSON.stringify(sebelum))
if (!sebelum.ada) {
  console.error('GAGAL: butang "Kongsi video" tak muncul')
  await b.close()
  process.exit(1)
}

await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Kongsi video'))
  if (btn) btn.click()
})
// muat naik + daftar RPC + muat semula galeri
await p.waitForTimeout(18000)

const selepas = await p.evaluate(() => {
  const ralat = document.querySelector('.bt-ralat')?.textContent?.trim() || ''
  const vids = [...document.querySelectorAll('.bt-grid video')].length
  const audios = [...document.querySelectorAll('.bt-grid audio')].length
  const imgs = [...document.querySelectorAll('.bt-grid img')].length
  return { ralat, vids, audios, imgs }
})
console.log('selepas hantar:', JSON.stringify(selepas))
console.log('RESP:', JSON.stringify(resp, null, 1))

await b.close()
if (selepas.ralat) {
  console.error('GAGAL: ralat selepas hantar —', selepas.ralat)
  process.exit(1)
}
if (selepas.vids < 1) {
  console.error('GAGAL: tiada <video> dalam galeri selepas upload')
  process.exit(1)
}
console.log('LULUS: video naik dan muncul dalam galeri')
