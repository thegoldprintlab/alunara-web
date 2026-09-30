/**
 * uji-pratonton-foto.mjs — sahkan pratonton foto buku tamu MELUKIS gambar.
 *
 * KENAPA SKRIP INI WUJUD
 *   Bug "kotak hitam" tak dapat dikesan dengan tengok screenshot sahaja, dan
 *   tak dapat dikesan dengan semak DOM sahaja — canvas WUJUD dan CSS betul.
 *   Yang rosak ialah canvas kekal pada saiz lalai 300x150 dengan 0 piksel
 *   dilukis (renderer WebGL terikat pada canvas lama). Jadi skrip ini mengukur
 *   saiz canvas + jenis konteks, dan mengesahkan saiz itu ikut saiz gambar.
 *
 * CARA JALAN
 *   node scripts/uji-pratonton-foto.mjs <url> [gambar-keluar.png]
 *
 *   Guna majlis BUANGAN (cth. CUBA24). Skrip berhenti SEBELUM tekan
 *   "Kongsi gambar", jadi tiada sampah masuk majlis sebenar.
 *
 * BACAAN
 *   ROSAK: canvasW 300, canvasH 150, ctxJenis "webgl", gambar 0 piksel
 *   PULIH: canvasW/H ikut saiz gambar (cth. 1200x900), ctxJenis "webgl"
 *
 *   Kalau ctxJenis null → WebGL memang tak disokong pelayar itu; itu kes
 *   berbeza (fallback "Telefon ini tak sokong pratonton warna" yang betul).
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const GAMBAR = process.env.UJI_GAMBAR || '/tmp/ujifoto.jpg'

/**
 * Cari Playwright. Kesan chromium snap AppArmor — guna chromium Playwright.
 * Path calon disenaraikan supaya skrip ni jalan dari repo mana pun.
 */
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
const out = process.argv[3] || '/tmp/pratonton-foto.png'

if (!url) {
  console.error('Guna: node scripts/uji-pratonton-foto.mjs <url> [keluar.png]')
  process.exit(2)
}
if (!existsSync(GAMBAR)) {
  console.error(`Gambar ujian tak ada: ${GAMBAR}`)
  console.error('Cipta dulu: python3 -c "from PIL import Image; Image.new(\'RGB\',(1200,900),(80,140,90)).save(\'/tmp/ujifoto.jpg\')"')
  process.exit(2)
}

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 420, height: 1200 }, deviceScaleFactor: 2 })
const log = []
p.on('response', (r) => {
  const u = r.url()
  if (u.includes('/api/') || u.includes('r2.cloudflarestorage')) {
    log.push(`${r.status()} ${r.request().method()} ${u.split('?')[0].slice(-60)}`)
  }
})

await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
await p.waitForTimeout(2000)

// daftar tetamu (kalau borang nama masih ada)
const adaNama = await p.$('input[type="text"], input:not([type])')
if (adaNama) {
  await p.fill('input[type="text"], input:not([type])', 'Uji Pratonton')
  await p.click('button.bt-btn')
  await p.waitForTimeout(2500)
}

// pilih tab Foto
await p.evaluate(() => {
  const bt = [...document.querySelectorAll('.bt-tab-btn')].find((x) => x.textContent.includes('Foto'))
  if (bt) bt.click()
})
await p.waitForTimeout(600)

const inp = await p.$('input#bt-fail')
if (!inp) {
  console.log('TIADA input fail. url=', p.url())
  console.log('badan:', (await p.innerText('body')).slice(0, 400))
  await b.close()
  process.exit(1)
}
await inp.setInputFiles(GAMBAR)
await p.waitForTimeout(3500)

const hasil = await p.evaluate(() => {
  const c = document.querySelector('.bt-preview canvas')
  const kotak = document.querySelector('.bt-preview')
  const cs = kotak ? getComputedStyle(kotak) : null
  let ctxJenis = null
  let piksel = null
  if (c) {
    ctxJenis = c.getContext('webgl') ? 'webgl' : c.getContext('2d') ? '2d' : 'tiada'
    // baca piksel tengah — kalau semua sifar, memang tak dilukis
    try {
      const gl = c.getContext('webgl')
      if (gl) {
        const px = new Uint8Array(4)
        gl.readPixels(
          Math.floor(c.width / 2), Math.floor(c.height / 2),
          1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px
        )
        piksel = Array.from(px)
      }
    } catch {
      piksel = 'gagal baca'
    }
  }
  return {
    adaPreview: !!kotak,
    canvasW: c?.width ?? null,
    canvasH: c?.height ?? null,
    kotakW: kotak ? Math.round(kotak.getBoundingClientRect().width) : null,
    kotakH: kotak ? Math.round(kotak.getBoundingClientRect().height) : null,
    latarPreview: cs?.backgroundColor ?? null,
    ctxJenis,
    piksel,
    adaChips: document.querySelectorAll('.bt-chip').length,
    html: kotak ? kotak.outerHTML.slice(0, 300) : null,
  }
})

console.log('HASIL', JSON.stringify(hasil, null, 2))
console.log('RESP', JSON.stringify(log, null, 2))

const el = await p.$('.bt-preview')
if (el) await el.screenshot({ path: out })
else await p.screenshot({ path: out })
console.log('screenshot:', out)

// ---- penilaian ----
const lalai = hasil.canvasW === 300 && hasil.canvasH === 150
if (hasil.ctxJenis === 'webgl' && lalai) {
  console.log('GAGAL: canvas kekal saiz lalai 300x150 — renderer terikat pada canvas lama')
  process.exitCode = 1
} else if (hasil.ctxJenis === 'webgl' && hasil.piksel && hasil.piksel.every((v) => v === 0)) {
  console.log('GAGAL: piksel tengah semua sifar — tiada apa dilukis')
  process.exitCode = 1
} else if (hasil.ctxJenis === 'webgl') {
  console.log(`LULUS: pratonton melukis (${hasil.canvasW}x${hasil.canvasH})`)
}

await b.close()
