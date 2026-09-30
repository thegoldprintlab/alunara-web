/**
 * qrPoster.ts — penjana poster QR Buku Tamu (PDF, saiz cetak sebenar).
 *
 * KENAPA MODUL BERASINGAN
 *   Fungsi ini asalnya duduk dalam BukuTamuBuat.tsx. Bila ia dalam fail .tsx,
 *   ia tak boleh diuji dari Node tanpa menjalankan React — jadi tiada siapa
 *   pernah sahkan poster sebenarnya betul (saiz, tema, teks muat). Sekarang ia
 *   modul biasa: `node scripts/uji-qr-poster.mjs` boleh jana + semak PDF.
 *
 * PRINSIP
 *   * PDF ditulis pada dimensi mm SEBENAR (A4 = 210×297 mm), QR dilukis pada
 *     saiz fizikal mm. Cetakan "100%" menghasilkan QR tepat — bukan skala kabur.
 *   * Setiap tema ada palet CETAK sendiri (aksen lebih dalam, jalur pastel).
 *     Warna skrin terlalu cerah untuk dakwat dan memakan toner.
 *   * pdf-lib guna font Standard (WinAnsi, bukan Unicode) — semua teks melalui
 *     `bersih()` dulu supaya emoji/aksara luar set tak jadi "?" atau membaling.
 */
import QRCode from 'qrcode'
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import type { PDFFont, PDFPage } from 'pdf-lib'

const MM = 72 / 25.4 // 1 mm dalam point PDF

export type SaizId = 'a4' | 'a5' | 'a6'

export type SaizKertas = {
  id: SaizId
  label: string
  mm: [number, number]
  qrMm: number
}

export const SAIZ: SaizKertas[] = [
  { id: 'a4', label: 'A4 — poster meja (210 × 297 mm)', mm: [210, 297], qrMm: 118 },
  { id: 'a5', label: 'A5 — kad sederhana (148 × 210 mm)', mm: [148, 210], qrMm: 74 },
  { id: 'a6', label: 'A6 — kad kecil (105 × 148 mm)', mm: [105, 148], qrMm: 44 },
]

type TemaCetak = { nama: string; aksen: string; jalur: string; teks: string }

/**
 * Palet cetak per tema. Kunci mesti padan dengan id tema dalam borang
 * self-serve (BukuTamuBuat.tsx) DAN atribut data-tema dalam BukuTamu.css.
 */
export const TEMA_CETAK: Record<string, TemaCetak> = {
  default: { nama: 'Klasik', aksen: '#9c7a36', jalur: '#f8f3e9', teks: '#1a1613' },
  minimalis: { nama: 'Minimalis', aksen: '#7d7263', jalur: '#f2eee7', teks: '#2b2723' },
  floral: { nama: 'Floral', aksen: '#a94f6d', jalur: '#fbeef3', teks: '#3d2029' },
  rustic: { nama: 'Rustic', aksen: '#8a5a34', jalur: '#f7ecdd', teks: '#33241a' },
}

const temaCetak = (id: string): TemaCetak => TEMA_CETAK[id] ?? TEMA_CETAK.default

function warna(hex: string) {
  const h = hex.replace('#', '')
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  )
}

/** Buang aksara yang font Standard tak boleh lukis + kemaskan ruang. */
export function bersih(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Pecah teks ikut lebar sebenar font (pdf-lib tiada word-wrap). */
function bungkus(teks: string, font: PDFFont, saiz: number, maks: number): string[] {
  const kata = teks.split(/\s+/).filter(Boolean)
  const baris: string[] = []
  let semasa = ''
  for (const k of kata) {
    const cuba = semasa ? `${semasa} ${k}` : k
    if (!semasa || font.widthOfTextAtSize(cuba, saiz) <= maks) semasa = cuba
    else {
      baris.push(semasa)
      semasa = k
    }
  }
  if (semasa) baris.push(semasa)
  return baris
}

/** Kecilkan saiz sehingga teks muat dalam `maksBaris` baris. */
function muat(
  teks: string,
  font: PDFFont,
  saizMula: number,
  maks: number,
  maksBaris: number,
): { baris: string[]; saiz: number } {
  let saiz = saizMula
  let baris = bungkus(teks, font, saiz, maks)
  while (baris.length > maksBaris && saiz > 7) {
    saiz -= 0.5
    baris = bungkus(teks, font, saiz, maks)
  }
  return { baris, saiz }
}

/** Teks tengah dengan jarak huruf (pdf-lib tak sokong letter-spacing). */
function teksJarak(
  page: PDFPage,
  teks: string,
  font: PDFFont,
  saiz: number,
  jarak: number,
  tengahX: number,
  y: number,
  color: ReturnType<typeof rgb>,
) {
  const lebar = font.widthOfTextAtSize(teks, saiz) + jarak * Math.max(teks.length - 1, 0)
  let x = tengahX - lebar / 2
  for (const c of teks) {
    page.drawText(c, { x, y, size: saiz, font, color })
    x += font.widthOfTextAtSize(c, saiz) + jarak
  }
}

export function pautanMajlis(slug: string) {
  return `https://alunara.my/buku-tamu/${slug}`
}

/** '2026-11-22' → '22 November 2026' untuk cetakan. */
export function tarikhMs(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })
}

export type QrMeta = {
  tajuk: string
  tema: string
  jenis?: string
  tarikh?: string
  venue?: string
}

/**
 * Susun atur (semua saiz skala dari lebar kertas, f = lebarMm / 210):
 *   jalur tema → "BUKU TAMU" berjarak → nama majlis (auto-kecil) →
 *   jenis · tarikh · venue → kad putih QR → arahan imbas →
 *   pautan taip-tangan → kaki ALUNARA + nama tema.
 */
export async function janaPdfQr(
  slug: string,
  saiz: SaizKertas,
  meta: QrMeta,
): Promise<Uint8Array> {
  const [lebarMm, tinggiMm] = saiz.mm
  const f = lebarMm / 210
  const tema = temaCetak(meta.tema)

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([lebarMm * MM, tinggiMm * MM])
  const font = await pdf.embedFont(StandardFonts.HelveticaBold)
  const font2 = await pdf.embedFont(StandardFonts.Helvetica)
  const fontMiring = await pdf.embedFont(StandardFonts.HelveticaOblique)

  const W = lebarMm * MM
  const H = tinggiMm * MM
  const aksen = warna(tema.aksen)
  const gelap = warna(tema.teks)
  const jalur = warna(tema.jalur)
  const kelabu = warna('#6f675c')

  const tengah = W / 2
  /** Jarak dari ATAS kertas (mm) → koordinat PDF (dari bawah). */
  const Y = (mm: number) => H - mm * MM

  // ---- jalur tema di atas + garis aksen ----
  const tinggiJalur = 30 * f
  page.drawRectangle({
    x: 0,
    y: H - tinggiJalur * MM,
    width: W,
    height: tinggiJalur * MM,
    color: jalur,
  })
  page.drawRectangle({
    x: 0,
    y: H - (tinggiJalur + 1.6) * MM,
    width: W,
    height: 1.6 * MM,
    color: aksen,
  })

  // ---- bingkai halus ----
  const margin = 6 * f
  page.drawRectangle({
    x: margin * MM,
    y: margin * MM,
    width: W - 2 * margin * MM,
    height: H - 2 * margin * MM,
    borderColor: warna('#e2dbcd'),
    borderWidth: 0.6,
  })

  // ---- "BUKU TAMU" berjarak huruf ----
  teksJarak(page, 'BUKU TAMU', font2, 9 * f + 2, 2.2 * f + 0.6, tengah, Y(13 * f), aksen)

  // ---- nama majlis ----
  const tajuk = bersih(meta.tajuk) || 'Majlis Kami'
  const { baris, saiz: saizTajuk } = muat(tajuk, font, 34 * f, W - 26 * MM, 2)
  // Tinggi baris dalam mm. JANGAN guna faktor 0.72 sebagai "penukar" pt→mm —
  // 1 mm = 2.835 pt, jadi pekali itu meletakkan sub-baris ~15 mm terlalu jauh
  // dan meninggalkan lubang kosong di bawah nama majlis.
  const tinggiBarisTajukMm = (saizTajuk * 1.25) / MM
  baris.forEach((b, i) => {
    page.drawText(b, {
      x: tengah - font.widthOfTextAtSize(b, saizTajuk) / 2,
      y: Y(40 * f + i * tinggiBarisTajukMm),
      size: saizTajuk,
      font,
      color: gelap,
    })
  })

  // ---- sub-baris: jenis majlis · tarikh · venue ----
  const bahagian = [bersih(meta.jenis ?? ''), bersih(meta.tarikh ?? ''), bersih(meta.venue ?? '')]
    .filter(Boolean)
  // Dasar baris terakhir + turunan (descender) font.
  let bawahTeks =
    40 * f + (baris.length - 1) * tinggiBarisTajukMm + (saizTajuk * 0.32) / MM
  if (bahagian.length) {
    const sub = bahagian.join('  ·  ')
    const { baris: bSub, saiz: sSub } = muat(sub, font2, 10.5 * f + 1.5, W - 30 * MM, 2)
    const tinggiBarisMm = (sSub + 2) / MM
    const atasSub = bawahTeks + 5 * f
    bSub.forEach((b, i) => {
      page.drawText(b, {
        x: tengah - font2.widthOfTextAtSize(b, sSub) / 2,
        y: Y(atasSub + i * tinggiBarisMm),
        size: sSub,
        font: font2,
        color: kelabu,
      })
    })
    bawahTeks = atasSub + (bSub.length - 1) * tinggiBarisMm + (sSub * 0.32) / MM
  }

  // ---- ukur blok dulu, baru letak ----
  //
  // KENAPA BUKAN SAIZ TETAP: poster versi awal mengunci saiz QR, jadi pada A4
  // ia tinggal lubang ~36 mm di tengah (kandungan cuma ~217 mm dari 297 mm)
  // dan pada A5 kad pula tenggelam. Sekarang QR diJADIKAN penyerap ruang:
  // blok tengah (hiasan + kad) mengisi semua ruang antara sub-baris dan blok
  // bawah, jadi poster sentiasa penuh tanpa lubang.
  const padKadMm = 5 * f
  const minQrMm = 38 // bawah ini pengimbas telefon mula ragu-ragu
  const maxQrMm = Math.min(saiz.qrMm, lebarMm - 40)

  const arahan = bersih('Imbas QR ini untuk kongsi gambar anda di buku tamu majlis kami.')
  const { baris: bArahan, saiz: sArahan } = muat(arahan, font2, 11 * f + 2, W - 30 * MM, 2)
  const saizTerima = 10 * f + 1.5
  const saizPautan = 8.5 * f + 2

  // Blok bawah: semua dikira dalam mm dari TEPI BAWAH kertas, kemudian
  // ditukar ke "mm dari atas" sekali sahaja. (Versi sebelum ini mencampur
  // kedua-dua arah, jadi blok bawah tersasar ke atas dan QR mengecil sendiri.)
  //
  // Jarak guna `max(minimum mm, skala f)` — pada A6 skala f jadi terlalu
  // kecil, dan URL + kaki nampak bertindih (ditegur selepas semakan visual kad).
  const jarak = (mm: number, skala: number) => Math.max(mm, skala * f)
  const yKakiB = Math.max(9, margin + 4.5) // mm dari bawah — beri margin cetak selamat
  const yPautanB = yKakiB + (7.5 * f + 1.5) / MM + jarak(4, 3)
  const yTerimaB = yPautanB + saizPautan / MM + jarak(6, 6)
  const yArahanB = yTerimaB + saizTerima / MM + jarak(5, 5)
  const yArahanAtasMm = tinggiMm - yArahanB // mm dari atas

  // Semua ukuran dalam mm dari ATAS kertas, supaya mudah dibandingkan.
  const tinggiHiasanMm = 1.5 * f
  const gapAsasA = 9 * f // teks → hiasan
  const gapAsasB = 9 * f // hiasan → kad
  const gapAsasC = 9 * f // kad → arahan

  const tengahMm = yArahanAtasMm - bawahTeks
  const kadHmm = Math.min(
    maxQrMm + padKadMm * 2,
    Math.max(minQrMm + padKadMm * 2, tengahMm - gapAsasA - tinggiHiasanMm - gapAsasB - gapAsasC),
  )
  const qrMm = kadHmm - padKadMm * 2

  // Lebihan dikongsi RATA antara tiga jurang sebenar: teks→hiasan,
  // hiasan→kad, kad→arahan. (Versi sebelum ini memberi dua bahagian kepada
  // satu jurang, jadi lubang 48 mm terkumpul di bawah nama majlis.)
  const lebih = Math.max(0, tengahMm - kadHmm - gapAsasA - tinggiHiasanMm - gapAsasB - gapAsasC)
  const kongsi = lebih / 3

  const yHiasan = bawahTeks + gapAsasA + kongsi
  const kadAtasMm = yHiasan + tinggiHiasanMm + gapAsasB + kongsi
  const kadW = kadHmm * MM
  const qrPt = qrMm * MM
  const padKad = padKadMm * MM
  const kadY = H - kadAtasMm * MM - kadW

  // ---- hiasan pemisah: dua garis pendek + permata kecil ----
  const separuh = 16 * f * MM
  const jarakOrn = 3 * f * MM
  page.drawLine({
    start: { x: tengah - separuh - jarakOrn, y: Y(yHiasan) },
    end: { x: tengah - jarakOrn, y: Y(yHiasan) },
    thickness: 0.7,
    color: aksen,
  })
  page.drawLine({
    start: { x: tengah + jarakOrn, y: Y(yHiasan) },
    end: { x: tengah + separuh + jarakOrn, y: Y(yHiasan) },
    thickness: 0.7,
    color: aksen,
  })
  const rD = 1.5 * f * MM
  page.drawRectangle({
    x: tengah - rD / 2,
    y: Y(yHiasan) - rD / 2,
    width: rD,
    height: rD,
    color: aksen,
    rotate: degrees(45),
  })

  page.drawRectangle({
    x: tengah - kadW / 2,
    y: kadY,
    width: kadW,
    height: kadW,
    color: rgb(1, 1, 1),
    borderColor: aksen,
    borderWidth: saiz.id === 'a4' ? 1.4 : 1,
  })

  const qrPng = await QRCode.toDataURL(pautanMajlis(slug), {
    margin: 1, // quiet zone — pengimbas perlu ruang putih di sekeliling QR
    width: Math.round(qrMm * 14),
    errorCorrectionLevel: 'M',
    color: { dark: '#1a1613', light: '#ffffff' },
  })
  const qrImg = await pdf.embedPng(qrPng)
  page.drawImage(qrImg, { x: tengah - qrPt / 2, y: kadY + padKad, width: qrPt, height: qrPt })

  // ---- arahan imbas (blok bawah, diikat ke tepi bawah) ----
  bArahan.forEach((b, i) => {
    page.drawText(b, {
      x: tengah - font2.widthOfTextAtSize(b, sArahan) / 2,
      y: Y(yArahanAtasMm) - i * (sArahan + 3),
      size: sArahan,
      font: font2,
      color: gelap,
    })
  })

  const terima = bersih('Terima kasih kerana hadir!')
  page.drawText(terima, {
    x: tengah - fontMiring.widthOfTextAtSize(terima, saizTerima) / 2,
    y: yTerimaB,
    size: saizTerima,
    font: fontMiring,
    color: kelabu,
  })

  // ---- pautan taip-tangan ----
  const pautanKecil = bersih(pautanMajlis(slug).replace('https://', ''))
  page.drawText(pautanKecil, {
    x: tengah - font2.widthOfTextAtSize(pautanKecil, saizPautan) / 2,
    y: yPautanB,
    size: saizPautan,
    font: font2,
    color: aksen,
  })

  // ---- kaki: nama tema (bukti ia ikut pilihan klien) ----
  const kaki = bersih(`Tema ${tema.nama}  ·  Buku Tamu ALUNARA  ·  alunara.my`)
  page.drawText(kaki, {
    x: tengah - font2.widthOfTextAtSize(kaki, 7.5 * f + 1.5) / 2,
    y: yKakiB,
    size: 7.5 * f + 1.5,
    font: font2,
    color: kelabu,
  })

  return await pdf.save()
}
