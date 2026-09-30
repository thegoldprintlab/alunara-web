/**
 * uji-orientasi-foto.mjs — sahkan pratonton foto TIDAK terbalik atas-bawah.
 *
 * KENAPA SKRIP INI WUJUD
 *   "Ada gambar" tak bermakna gambar itu betul. Bug `UNPACK_FLIP_Y_WEBGL = 0`
 *   melukis gambar songsang pada pratonton DAN pada fail yang disimpan, tetapi
 *   screenshot nampak "normal" kalau gambar ujian simetri. Skrip ini guna
 *   gambar dua warna (atas MERAH, bawah BIRU) dan BACA PIKEL canvas, jadi ia
 *   LULUS/GAGAL sendiri tanpa mata manusia.
 *
 * CARA JALAN
 *   python3 -c "
 *   from PIL import Image, ImageDraw
 *   im = Image.new('RGB', (400, 800)); d = ImageDraw.Draw(im)
 *   d.rectangle([0,0,400,400], fill=(220,30,30))    # ATAS = MERAH
 *   d.rectangle([0,400,400,800], fill=(30,60,220))  # BAWAH = BIRU
 *   im.save('/tmp/ujiorientasi.jpg', quality=95)"
 *
 *   node scripts/uji-orientasi-foto.mjs https://alunara.my/buku-tamu/CUBA24
 *
 * Guna majlis BUANGAN (cth. CUBA24) — skrip berhenti sebelum tekan
 * "Kongsi gambar", jadi tiada sampah masuk majlis sebenar.
 *
 * NOTA `readPixels`
 *   y=0 dalam readPixels ialah BAWAH canvas, jadi kita baca
 *   `height - 5` untuk hujung ATAS.
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const GAMBAR = process.env.UJI_GAMBAR || '/tmp/ujiorientasi.jpg'

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
const out = process.argv[3] || '/tmp/orientasi.png'

if (!url) {
  console.error('Guna: node scripts/uji-orientasi-foto.mjs <url> [keluar.png]')
  process.exit(2)
}
if (!existsSync(GAMBAR)) {
  console.error(`Gambar ujian tak ada: ${GAMBAR}`)
  console.error('Cipta dulu — lihat komen di atas kepala fail ini.')
  process.exit(2)
}

/** Anggap MERAH kalau R jelas lebih tinggi dari B; BIRU kalau sebaliknya. */
function warna([r, g, b]) {
  if (r > b + 40) return 'MERAH'
  if (b > r + 40) return 'BIRU'
  return `KELABU(${r},${g},${b})`
}

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 420, height: 1400 }, deviceScaleFactor: 2 })
await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
await p.waitForTimeout(2500)

const adaNama = await p.$('input[type="text"], input:not([type])')
if (adaNama) {
  await p.fill('input[type="text"], input:not([type])', 'Uji Orientasi')
  await p.click('button.bt-btn')
  await p.waitForTimeout(2500)
}

await p.evaluate(() => {
  const bt = [...document.querySelectorAll('.bt-tab-btn')].find((x) => x.textContent.includes('Foto'))
  if (bt) bt.click()
})
await p.waitForTimeout(600)

const inp = await p.$('input#bt-fail')
if (!inp) {
  console.error('TIADA input fail — sesi tak sah atau upload ditutup?')
  console.error('badan:', (await p.innerText('body')).slice(0, 300))
  await b.close()
  process.exit(1)
}
await inp.setInputFiles(GAMBAR)
await p.waitForTimeout(3500)

const orient = await p.evaluate(() => {
  const c = document.querySelector('.bt-preview canvas')
  if (!c) return { ralat: 'tiada canvas' }
  const gl = c.getContext('webgl')
  if (!gl) return { ralat: 'tiada webgl' }
  const baca = (x, y) => {
    const px = new Uint8Array(4)
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
    return Array.from(px).slice(0, 3)
  }
  const tengahX = Math.floor(c.width / 2)
  return {
    saiz: [c.width, c.height],
    // readPixels: y=0 ialah BAWAH canvas
    yAtas: baca(tengahX, c.height - 5),
    yBawah: baca(tengahX, 5),
  }
})

if (orient.ralat) {
  console.error('GAGAL:', orient.ralat)
  await b.close()
  process.exit(1)
}

const atas = warna(orient.yAtas)
const bawah = warna(orient.yBawah)
console.log('ORIENTASI', JSON.stringify(orient))
console.log(`atas=${atas} bawah=${bawah}`)

const el = await p.$('.bt-preview')
if (el) await el.screenshot({ path: out })
console.log('screenshot:', out)

// Gambar ujian: atas MERAH, bawah BIRU. Canvas yang betul mesti sama.
if (atas === 'MERAH' && bawah === 'BIRU') {
  console.log(`LULUS: orientasi betul (${orient.saiz.join('x')})`)
  await b.close()
  process.exit(0)
}
console.error(
  `GAGAL: gambar TERBALIK — jangka atas=MERAH bawah=BIRU, dapat atas=${atas} bawah=${bawah}`,
)
console.error('Semak gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, ...) dalam src/lib/filmStocks.ts')
await b.close()
process.exit(1)
