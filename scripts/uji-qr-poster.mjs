/**
 * uji-qr-poster.mjs — uji poster QR Buku Tamu secara END-TO-END.
 *
 * KENAPA UJIAN INI WUJUD
 *   Sebelum ini poster QR hanya boleh dilihat dengan mata di pelayar, jadi
 *   tiada siapa pernah sahkan (a) saiz kertas betul, (b) tema betul-betul
 *   berubah, (c) QR boleh diimbas. Ujian ini menjana PDF, render ke pixel
 *   dengan pdftoppm (enjin cetak sebenar, bukan pelukis pdfjs yang mudah
 *   tersasar), dan mengimbas QR dari PIXEL — supaya kita tahu poster yang
 *   akan dicetak benar-benar berfungsi.
 *
 * CARA GUNA
 *   cd ~/alunara-web
 *   node scripts/uji-qr-poster.mjs            # uji 4 tema × 3 saiz
 *   node scripts/uji-qr-poster.mjs --simpan   # simpan PNG ke /tmp untuk mata
 *
 * LULUS = saiz kertas tepat (mm) + QR terbaca = pautan majlis yang betul +
 *         QR ≥ 35 mm di atas kertas + tiada jalur kosong + aksen tema hadir.
 *
 * JANGAN PERCAYA MATA SAHAJA: pemeriksa visual (model) dua kali mendakwa teks
 * "menindih QR" pada kad A6. Kiraan pixel menunjukkan hanya 13 pixel gelap di
 * dalam zon senyap, dan semuanya modul QR sendiri — kad itu bersih. Ujian di
 * sini ialah kebenaran; pemeriksa visual hanya berguna untuk irama dan jurang.
 *
 * BERGANTUNG PADA: poppler-utils (pdftoppm). Kalau tiada:
 *   sudo apt-get install -y poppler-utils
 *
 * NOTA: src/lib/qrPoster.ts ditranspile ke .uji/ dahulu, supaya yang diuji
 * ialah kod SEBENAR yang dihantar ke pelayar — bukan salinan.
 */
import { mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

const SIMPAN = process.argv.includes('--simpan')
const KELUAR = '/tmp/uji-qr-poster'
const DPI = 300
const SLUG = 'aliabby'
const JANGKA = `https://alunara.my/buku-tamu/${SLUG}`
const TEMA_UJIAN = ['default', 'minimalis', 'floral', 'rustic']

// ---------------------------------------------------------------- transpile
//
// SELALU transpile semula (bukan simpan cache): poster ini pernah lulus ujian
// dari .uji/ yang basi. Kod yang diuji mesti kod yang dihantar ke pelayar.
//
// Node ESM perlukan sambungan fail eksplisit, tetapi kod sumber import
// `'./qrPosterFonts'` (gaya bundler Vite). Jadi selepas transpile, import
// relatif dalam .uji/ ditambah `.js`.
console.log('[persediaan] transpile src/lib/*.ts → .uji/')
rmSync('.uji', { recursive: true, force: true })
execFileSync('npx', [
  'tsc', 'src/lib/qrPoster.ts', 'src/lib/qrPosterFonts.ts', '--ignoreConfig', '--outDir', '.uji',
  '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler',
  '--skipLibCheck', '--esModuleInterop',
], { stdio: 'inherit' })
for (const f of readdirSync('.uji')) {
  const p = `.uji/${f}`
  writeFileSync(p, readFileSync(p, 'utf8').replace(/(from '\.[^']*)'/g, "$1.js'"))
}
const { janaPdfQr, SAIZ, TEMA_CETAK } = await import('../.uji/qrPoster.js')

let gagal = 0
const rekod = []
const semak = (nama, syarat, butiran = '') => {
  if (!syarat) gagal++
  console.log(`  [${syarat ? 'LULUS' : 'GAGAL'}] ${nama}${butiran ? ` — ${butiran}` : ''}`)
}

/** Render PDF → RGBA pixel guna pdftoppm (enjin poppler, bukan pelukis pdfjs). */
function renderPdf(bytes, nama) {
  const pdfPath = `${KELUAR}/${nama}.pdf`
  writeFileSync(pdfPath, bytes)
  execFileSync('pdftoppm', ['-r', String(DPI), '-png', '-singlefile', pdfPath, `${KELUAR}/${nama}`])
  const png = PNG.sync.read(readFileSync(`${KELUAR}/${nama}.png`))
  return { data: png.data, width: png.width, height: png.height }
}

/** Imbas QR dari pixel; pulangkan teks + sudut sebenar QR. */
function imbasQr({ data, width, height }) {
  const hasil = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width, height, {
    inversionAttempts: 'dontInvert',
  })
  if (!hasil) return { teks: null, lokasi: null }
  return { teks: hasil.data, lokasi: hasil.location }
}

/**
 * Saiz QR (mm) dari SUDUT yang jsQR jumpa — bukan dari bounding box pixel
 * gelap, sebab teks juga gelap dan akan membesarkan ukuran secara palsu.
 */
function saizQrMm(lokasi, lebarKertasMm, lebarPx) {
  if (!lokasi) return 0
  const { topLeftCorner: a, topRightCorner: b, bottomLeftCorner: c } = lokasi
  const sisiX = Math.hypot(b.x - a.x, b.y - a.y)
  const sisiY = Math.hypot(c.x - a.x, c.y - a.y)
  return (((sisiX + sisiY) / 2) / lebarPx) * lebarKertasMm
}

/**
 * Jalur kosong terpanjang (mm) — baris piksel yang hampir tiada isi langsung.
 *
 * KENAPA: poster pertama kami lulus semua ujian teknikal tapi nampak rosak —
 * ada lubang kosong ~10 cm antara butiran majlis dan kad QR, kerana kad itu
 * sentiasa diletak terus di bawah teks. Ujian ini menangkap "poster kosong"
 * secara automatik, bukan bergantung pada mata.
 */
function jalurKosongMm({ data, width, height }, tinggiKertasMm) {
  const mmPerPx = tinggiKertasMm / height
  // Hanya periksa 10%–90% lebar: bingkai halaman ada di tepi, dan tanpa
  // pengecualian ini setiap baris nampak "berisi" (2 garis tepi) lalu lubang
  // kosong sebenar tak pernah dikesan.
  const x0 = Math.floor(width * 0.1)
  const x1 = Math.ceil(width * 0.9)
  let terbaik = 0, semasa = 0
  for (let y = 0; y < height; y++) {
    const kira = new Map()
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4
      const kunci = `${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`
      kira.set(kunci, (kira.get(kunci) ?? 0) + 1)
    }
    let modal = 0
    for (const v of kira.values()) if (v > modal) modal = v
    const berisi = 1 - modal / (x1 - x0)
    if (berisi < 0.002) {
      semasa++
      if (semasa > terbaik) terbaik = semasa
    } else semasa = 0
  }
  return terbaik * mmPerPx
}

/**
 * Warna paling hampir dengan aksen tema, dikira dari SEMUA pixel yang cukup
 * tepu — bukan dari pixel PALING tepu.
 *
 * KENAPA BUKAN "paling tepu": tema Minimalis aksennya kelabu hangat
 * (#6f6659, tepu rendah) dan ia dilitupi oleh teks. Versi lama menapis tepu
 * ≥25 lalu mengambil pixel tepu terbanyak — ia dapat warna jalur tema
 * (#f1eee8 tidak, tapi bingkai #d9d4cb ya) dan ujian gagal walaupun poster
 * betul. Sekarang: kumpul pixel yang dekat dengan aksen jangka (±30) dan
 * pastikan ada cukup banyak — itu bukti tema betul-betul dicetak.
 */
function kiraAksen(data, hex) {
  const t = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  let dekat = 0
  for (let i = 0; i < data.length; i += 4) {
    const p = [data[i], data[i + 1], data[i + 2]]
    if (Math.max(...p.map((v, j) => Math.abs(v - t[j]))) <= 30) dekat++
  }
  return { dekat, jumlah: data.length / 4 }
}

mkdirSync(KELUAR, { recursive: true })

for (const saiz of SAIZ) {
  for (const tema of TEMA_UJIAN) {
    const nama = `${saiz.id}-${tema}`
    console.log(`\n${saiz.id.toUpperCase()} · tema ${tema}`)
    // Nama majlis panjang sengaja diuji pada setiap saiz: `muat()` mengecilkan
    // teks, dan pada A6 nama 2 baris boleh menolak kad QR keluar dari bingkai.
    // Poster sebenar klien selalunya begini (nama penuh + bin/binti).
    const tajuk = saiz.id === 'a6' ? 'Nurul Aisyah binti Abdullah' : 'Ali & Abu'
    const bytes = await janaPdfQr(SLUG, saiz, {
      tajuk,
      tema,
      jenis: 'Nikah / Akad',
      tarikh: '22 November 2026',
      venue: 'Dewan Melaka',
    })

    // 1. Dimensi halaman mesti tepat (mm → point).
    const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise
    const vp = (await doc.getPage(1)).getViewport({ scale: 1 })
    const lebarMm = (vp.width / 72) * 25.4
    const tinggiMm = (vp.height / 72) * 25.4
    semak(
      'saiz kertas tepat',
      Math.abs(lebarMm - saiz.mm[0]) < 0.5 && Math.abs(tinggiMm - saiz.mm[1]) < 0.5,
      `${lebarMm.toFixed(1)} × ${tinggiMm.toFixed(1)} mm`,
    )

    // 2. QR mesti boleh diimbas dan menunjuk ke pautan majlis yang betul.
    const px = renderPdf(bytes, nama)
    const { teks: dibaca, lokasi } = imbasQr(px)
    semak('QR diimbas dari pixel', dibaca === JANGKA, dibaca ?? 'TIADA')

    // 3. QR cukup besar di atas kertas.
    const qrMm = saizQrMm(lokasi, saiz.mm[0], px.width)
    semak('QR ≥ 35 mm di atas kertas', qrMm >= 35, `${qrMm.toFixed(1)} mm`)
    // Kad mesti berada DI ATAS blok bawah. Kalau kad melimpah ke bawah, teks
    // arahan akan dilukis atas kod QR dan ia jadi tak boleh diimbas — ini
    // pepijat sebenar yang pernah berlaku pada A6 dengan nama dua baris.
    const qrBawahMm = lokasi
      ? (Math.max(lokasi.bottomLeftCorner.y, lokasi.bottomRightCorner.y) / px.height) * saiz.mm[1]
      : saiz.mm[1]
    semak(
      'kad QR di atas blok bawah',
      qrBawahMm < saiz.mm[1] - 30,
      `QR tamat pada ${qrBawahMm.toFixed(1)} / ${saiz.mm[1]} mm`,
    )

    // 4. Tiada lubang kosong besar — poster tak nampak "belum siap".
    const kosong = jalurKosongMm(px, saiz.mm[1])
    semak('tiada jalur kosong > 32 mm', kosong <= 32, `${kosong.toFixed(1)} mm`)

    // 5. Aksen tema mesti hadir dalam kuantiti yang munasabah (bukti tema
    //    betul-betul dicetak, bukan cuma dinyatakan dalam metadata).
    const hex = TEMA_CETAK[tema].aksen
    const { dekat, jumlah } = kiraAksen(px.data, hex)
    const nisbah = (dekat / jumlah) * 100
    semak(
      'aksen tema hadir di atas kertas',
      nisbah >= 0.05,
      `${nisbah.toFixed(2)}% pixel ≈ ${hex}`,
    )

    rekod.push({ saiz: saiz.id, tema, qrMm: +qrMm.toFixed(1) })
    if (!SIMPAN) rmSync(`${KELUAR}/${nama}.png`, { force: true })
  }
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : `${gagal} GAGAL`}`)
console.log(JSON.stringify(rekod))
if (SIMPAN) console.log(`PNG + PDF: ${KELUAR}/`)
process.exit(gagal === 0 ? 0 : 1)
