/**
 * uji-had-video.mjs — sahkan had durasi video 60 saat dikuatkuasa.
 *
 * KENAPA SKRIP INI WUJUD
 *   Had durasi ada di DUA tempat (UI + RPC). Ujian ini sahkan kedua-duanya:
 *   video 75s mesti DITOLAK dengan mesej jelas, video 30s mesti DITERIMA.
 *   Tanpa ujian, had boleh rosak senyap bila kod UI ditulis semula.
 *
 * CARA JALAN
 *   cd /tmp && ffmpeg -y -f lavfi -i testsrc=size=320x240:rate=15 -t 75 \
 *     -c:v libx264 -pix_fmt yuv420p -preset ultrafast /tmp/video75s.mp4
 *   ffmpeg -y -f lavfi -i testsrc=size=320x240:rate=15 -t 30 \
 *     -c:v libx264 -pix_fmt yuv420p -preset ultrafast /tmp/video30s.mp4
 *
 *   cd ~/alunara-web
 *   node scripts/uji-had-video.mjs https://alunara.my/buku-tamu/CUBA24
 *
 * Guna majlis BUANGAN — skrip TIDAK tekan "Kongsi video", jadi tiada apa
 * dimuat naik. Ia hanya semak sama ada borang menerima fail itu.
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const PANJANG = process.env.UJI_VIDEO_PANJANG || '/tmp/video75s.mp4'
const PENDEK = process.env.UJI_VIDEO_PENDEK || '/tmp/video30s.mp4'

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
    /* cuba calon seterusnya */
  }
}
if (!chromium) {
  console.error('Playwright tak jumpa. Pasang: cd ~/gold-plan-web && npm i playwright')
  process.exit(2)
}

const url = process.argv[2]
if (!url) {
  console.error('Guna: node scripts/uji-had-video.mjs <url>')
  process.exit(2)
}
for (const f of [PANJANG, PENDEK]) {
  if (!existsSync(f)) {
    console.error(`Video ujian tak ada: ${f} — cipta dengan ffmpeg (lihat komen kepala fail).`)
    process.exit(2)
  }
}

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 420, height: 1400 }, deviceScaleFactor: 2 })
await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
await p.waitForTimeout(2500)

const adaNama = await p.$('input[type="text"], input:not([type])')
if (adaNama) {
  await p.fill('input[type="text"], input:not([type])', 'Uji Had Video')
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
  console.error('TIADA input video — sesi tak sah atau upload ditutup?')
  console.error('badan:', (await p.innerText('body')).slice(0, 300))
  await b.close()
  process.exit(1)
}

/** Balikkan { ralat, adaButangKongsi, adaNamaFail } selepas cuba pilih fail. */
async function cuba(fail) {
  await p.evaluate(() => {
    const el = document.querySelector('input#bt-video')
    if (el) el.value = ''
  })
  await inp.setInputFiles(fail)
  // ukurDurasi() baca metadata secara async — beri masa.
  await p.waitForTimeout(4000)
  return p.evaluate(() => {
    const ralat = document.querySelector('.bt-ralat')?.textContent?.trim() || ''
    const btn = [...document.querySelectorAll('button')].find((x) =>
      x.textContent.includes('Kongsi video'),
    )
    const nama = document.querySelector('.bt-info--kecil')?.textContent?.trim() || ''
    return { ralat, adaButangKongsi: !!btn, adaNamaFail: nama }
  })
}

let gagal = false

const panjang = await cuba(PANJANG)
console.log('VIDEO 75s →', JSON.stringify(panjang))
if (!panjang.ralat || !panjang.ralat.includes('60')) {
  console.error('  ✗ patut DITOLAK dengan mesej yang sebut 60 saat')
  gagal = true
} else if (panjang.adaButangKongsi) {
  console.error('  ✗ ditolak tetapi butang "Kongsi video" masih ada — tetamu boleh hantar')
  gagal = true
} else {
  console.log('  ✓ ditolak, butang kongsi tak muncul')
}

const pendek = await cuba(PENDEK)
console.log('VIDEO 30s →', JSON.stringify(pendek))
if (pendek.ralat) {
  console.error(`  ✗ patut DITERIMA, tetapi dapat ralat: ${pendek.ralat}`)
  gagal = true
} else if (!pendek.adaButangKongsi) {
  console.error('  ✗ tiada butang "Kongsi video" — video sah tak diterima')
  gagal = true
} else {
  console.log('  ✓ diterima, butang kongsi muncul')
}

await b.close()
if (gagal) {
  console.error('GAGAL: had durasi video tak dikuatkuasa dengan betul')
  process.exit(1)
}
console.log('LULUS: 75s ditolak, 30s diterima')
