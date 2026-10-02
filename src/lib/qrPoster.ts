/**
 * qrPoster.ts — penjana poster QR Buku Tamu (PDF, saiz cetak sebenar).
 *
 * KENAPA MODUL BERASINGAN
 *   Fungsi ini asalnya duduk dalam BukuTamuBuat.tsx. Bila ia dalam fail .tsx,
 *   ia tak boleh diuji dari Node tanpa menjalankan React — jadi tiada siapa
 *   pernah sahkan poster sebenarnya betul (saiz, tema, teks muat). Sekarang ia
 *   modul biasa: `node scripts/uji-qr-poster.mjs` boleh jana + semak PDF.
 *
 * KENAPA FONT DIBENAM, BUKAN Helvetica
 *   Versi pertama guna StandardFonts (Helvetica). Helvetica ialah font
 *   pengukur dokumen — ia buat poster nampak seperti resit, bukan kad majlis.
 *   Laman ALUNARA guna Cormorant (serif) + Jost (sans); poster mesti sama
 *   supaya cetakan dan laman nampak satu jenama. Font di-subset ke ASCII dan
 *   dibenam dari src/lib/qrPosterFonts.ts (jana: scripts/bina-font-poster.py).
 *
 * PRINSIP SUSUN ATUR
 *   * PDF ditulis pada dimensi mm SEBENAR (A4 = 210×297 mm), QR dilukis pada
 *     saiz fizikal mm. Cetakan "100%" menghasilkan QR tepat — bukan skala kabur.
 *   * Kepala = jalur tema (pastel, murah dakwat) + monogram ALUNARA.
 *     Badan = bingkai garis dua, nama majlis dalam serif besar, hiasan permata,
 *     kad QR putih bertepi, kemudian blok kaki yang diikat ke tepi bawah.
 *   * QR ialah penyerap ruang: saiznya mengisi apa sahaja ruang antara teks
 *     atas dan blok kaki, jadi tiada lubang kosong pada mana-mana saiz kertas.
 *   * Setiap tema ada palet CETAK sendiri (aksen lebih dalam, jalur pastel).
 *     Warna skrin terlalu cerah untuk dakwat dan memakan toner.
 *   * Semua teks melalui `bersih()` (ASCII) kerana font di-subset ke ASCII.
 */
import QRCode from 'qrcode'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb } from 'pdf-lib'
import type { PDFFont, PDFPage } from 'pdf-lib'
import { FONT_B64, dariBase64 } from './qrPosterFonts'

const MM = 72 / 25.4 // 1 mm dalam point PDF

/** Warna rgb pdf-lib (ia tak eksport jenisnya). */
type Warna = ReturnType<typeof rgb>

export type SaizId = 'a4' | 'a5' | 'a6'

export type SaizKertas = {
  id: SaizId
  label: string
  mm: [number, number]
  /** QR MAKSIMUM (mm) — ruang sebenar yang tinggal menentukan saiz akhir. */
  qrMm: number
}

export const SAIZ: SaizKertas[] = [
  { id: 'a4', label: 'A4 — poster meja (210 × 297 mm)', mm: [210, 297], qrMm: 128 },
  { id: 'a5', label: 'A5 — kad sederhana (148 × 210 mm)', mm: [148, 210], qrMm: 84 },
  { id: 'a6', label: 'A6 — kad kecil (105 × 148 mm)', mm: [105, 148], qrMm: 52 },
]

type TemaCetak = {
  nama: string
  /** Aksen utama — garis, monogram, pautan. Ini warna yang mengesahkan tema. */
  aksen: string
  /** Jalur kepala (pastel). */
  jalur: string
  /** Garis bingkai halus. */
  bingkai: string
  /** Warna teks utama. */
  teks: string
}

/**
 * Palet cetak per tema. Kunci mesti padan dengan id tema dalam borang
 * self-serve (BukuTamuBuat.tsx) DAN atribut data-tema dalam BukuTamu.css.
 */
export const TEMA_CETAK: Record<string, TemaCetak> = {
  default: { nama: 'Klasik', aksen: '#9c7a36', jalur: '#f7f1e3', bingkai: '#ddd0b4', teks: '#241d14' },
  minimalis: { nama: 'Minimalis', aksen: '#6f6659', jalur: '#f1eee8', bingkai: '#d9d4cb', teks: '#2b2723' },
  floral: { nama: 'Floral', aksen: '#a94f6d', jalur: '#fbeef3', bingkai: '#eed2dc', teks: '#3d2029' },
  rustic: { nama: 'Rustic', aksen: '#8a5a34', jalur: '#f7ecdd', bingkai: '#e2cbb1', teks: '#33241a' },
}

const temaCetak = (id: string): TemaCetak => TEMA_CETAK[id] ?? TEMA_CETAK.default

function warna(hex: string): Warna {
  const h = hex.replace('#', '')
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  )
}

/** Buang aksara di luar ASCII (font di-subset) + kemaskan ruang. */
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
  while (baris.length > maksBaris && saiz > 6) {
    saiz -= 0.5
    baris = bungkus(teks, font, saiz, maks)
  }
  return { baris, saiz }
}

/** Lebar teks termasuk jarak huruf (dalam em). */
function lebarJarak(font: PDFFont, teks: string, saiz: number, em: number): number {
  return font.widthOfTextAtSize(teks, saiz) + em * saiz * Math.max(teks.length - 1, 0)
}

/**
 * Teks tengah dengan jarak huruf. pdf-lib tak sokong letter-spacing, jadi
 * setiap aksara dilukis sendiri — inilah yang buat label seperti "BUKU TAMU"
 * nampak seperti cetakan undangan, bukan teks lalai.
 */
function teksJarak(
  page: PDFPage,
  teks: string,
  font: PDFFont,
  saiz: number,
  em: number,
  tengahX: number,
  y: number,
  color: Warna,
) {
  const jarak = em * saiz
  let x = tengahX - lebarJarak(font, teks, saiz, em) / 2
  for (const c of teks) {
    page.drawText(c, { x, y, size: saiz, font, color })
    x += font.widthOfTextAtSize(c, saiz) + jarak
  }
}

/** Teks tengah biasa (tiada jarak huruf). */
function teksTengah(
  page: PDFPage,
  teks: string,
  font: PDFFont,
  saiz: number,
  tengahX: number,
  y: number,
  color: Warna,
) {
  page.drawText(teks, {
    x: tengahX - font.widthOfTextAtSize(teks, saiz) / 2,
    y,
    size: saiz,
    font,
    color,
  })
}

/**
 * Permata berlian (4 bucu) — hiasan pemisah gaya undangan.
 *
 * pdf-lib `drawSvgPath` melukis dalam ruang SVG (y ke BAWAH) dari titik (x, y)
 * yang diberi. Kita letak asalan di penjuru atas-kiri halaman, jadi koordinat
 * PDF (y ke atas) perlu ditukar dulu — silap tukar di sini buat permata
 * terkeluar dari bingkai.
 */
function permata(page: PDFPage, cx: number, cyPdf: number, r: number, color: Warna) {
  const cy = page.getHeight() - cyPdf
  page.drawSvgPath(
    `M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`,
    { x: 0, y: page.getHeight(), color },
  )
}

/** Garis hiasan: garis — permata — garis. */
function hiasan(
  page: PDFPage,
  tengahX: number,
  y: number,
  separuh: number,
  jurang: number,
  r: number,
  aksen: Warna,
  lembut: Warna,
) {
  page.drawLine({
    start: { x: tengahX - separuh - jurang, y },
    end: { x: tengahX - jurang, y },
    thickness: 0.7,
    color: aksen,
  })
  page.drawLine({
    start: { x: tengahX + jurang, y },
    end: { x: tengahX + separuh + jurang, y },
    thickness: 0.7,
    color: aksen,
  })
  permata(page, tengahX - separuh - jurang - r * 2.2, y, r * 0.6, lembut)
  permata(page, tengahX + separuh + jurang + r * 2.2, y, r * 0.6, lembut)
  permata(page, tengahX, y, r, aksen)
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
 * Susun atur (semua ukuran menegak dalam mm dari ATAS kertas, skala f = lebarMm/210):
 *
 *   jalur tema + monogram ALUNARA        (0 … 30f)
 *   bingkai garis dua                     (36f … tinggiMm-11f)
 *     "BUKU TAMU" berjarak huruf
 *     nama majlis (serif, auto-kecil, 2 baris)
 *     hiasan permata
 *     jenis · tarikh · venue
 *     kad QR putih bertepi dua
 *     arahan imbas · terima kasih · pautan · kaki tema
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
  pdf.registerFontkit(fontkit)
  const page = pdf.addPage([lebarMm * MM, tinggiMm * MM])

  // Setiap gaya hanya dibenam kalau dipakai — PDF yang dijana jadi lebih kecil.
  const serif = await pdf.embedFont(dariBase64(FONT_B64['cormorant-600']), { subset: true })
  const serifItalik = await pdf.embedFont(dariBase64(FONT_B64['cormorant-italic-400']), { subset: true })
  const sans = await pdf.embedFont(dariBase64(FONT_B64['jost-400']), { subset: true })
  const sansMedium = await pdf.embedFont(dariBase64(FONT_B64['jost-500']), { subset: true })
  const sansTegas = await pdf.embedFont(dariBase64(FONT_B64['jost-600']), { subset: true })

  const tajuk = bersih(meta.tajuk) || 'Majlis Kami'
  pdf.setTitle(`Buku Tamu — ${tajuk}`)
  pdf.setAuthor('ALUNARA')
  pdf.setSubject('Poster QR Buku Tamu')
  pdf.setCreator('alunara.my')

  const W = lebarMm * MM
  const H = tinggiMm * MM
  const tengah = W / 2
  /** mm dari ATAS kertas → koordinat PDF (dari bawah). */
  const Y = (mm: number) => H - mm * MM

  const aksen = warna(tema.aksen)
  const jalur = warna(tema.jalur)
  const bingkai = warna(tema.bingkai)
  const gelap = warna(tema.teks)
  const lembut = warna('#6e675c')

  // ---------------------------------------------------------------- 1. KEPALA
  const bandH = Math.max(20, 30 * f)
  page.drawRectangle({ x: 0, y: H - bandH * MM, width: W, height: bandH * MM, color: jalur })
  page.drawRectangle({
    x: 0,
    y: H - (bandH + 1.4 * f) * MM,
    width: W,
    height: 1.4 * f * MM,
    color: aksen,
  })

  // Monogram: bukti jenama pada poster, dan ia mengunci tema warna kepala.
  const saizMono = Math.max(8, 10.5 * f)
  const emMono = 0.3
  const yMono = bandH / 2 + Math.max(2.6, 3.2 * f)
  teksJarak(page, 'ALUNARA', sansTegas, saizMono, emMono, tengah, Y(yMono), aksen)
  const lebarMono = lebarJarak(sansTegas, 'ALUNARA', saizMono, emMono)
  const yPermataMono = Y(yMono) + saizMono * 0.36
  permata(page, tengah - lebarMono / 2 - 6.5 * f * MM, yPermataMono, 1.5 * f * MM, bingkai)
  permata(page, tengah + lebarMono / 2 + 6.5 * f * MM, yPermataMono, 1.5 * f * MM, bingkai)

  // --------------------------------------------------------------- 2. BINGKAI
  const margin = 13 * f
  const bingkaiAtasMm = bandH + Math.max(5, 6 * f)
  const bingkaiBawahMm = tinggiMm - 11 * f
  const mx = margin * MM
  page.drawRectangle({
    x: mx,
    y: Y(bingkaiBawahMm),
    width: W - 2 * mx,
    height: (bingkaiBawahMm - bingkaiAtasMm) * MM,
    borderColor: aksen,
    borderWidth: 0.9,
  })
  const inset = 2 * f
  page.drawRectangle({
    x: (margin + inset) * MM,
    y: Y(bingkaiBawahMm - inset),
    width: W - 2 * (margin + inset) * MM,
    height: (bingkaiBawahMm - bingkaiAtasMm - 2 * inset) * MM,
    borderColor: bingkai,
    borderWidth: 0.5,
  })

  // ------------------------------------------------------- 3. SUSUN MENEGAK
  //
  // SATU-SATUNYA SUMBER KEBENARAN: ruang yang tinggal.
  //
  // Versi awal mengunci saiz kad pada minimum (`Math.max(qrMin, …)`) supaya QR
  // tak pernah terlalu kecil. Itu SALAH: pada A6 dengan nama majlis dua baris,
  // tiada ruang untuk minimum itu, jadi kad ditolak ke bawah — menindih teks
  // arahan, dan teks itu dicetak ATAS kod QR. QR jadi tak boleh diimbas.
  // (Tangkap oleh ujian: "QR diimbas dari pixel — TIADA" pada A6.)
  //
  // Sekarang kad TIDAK PERNAH melebihi ruang yang ada. Bila ruang terlalu
  // ketat, kita longgarkan susunan dahulu (jurang → saiz nama), bukan
  // membenarkan pertindihan. Kalau masih tak cukup, kad kekal kecil —
  // lebih baik QR kecil daripada QR yang dicetak atas.
  const padKadMm = 6 * f
  const qrMin = 38 // bawah ini pengimbas telefon mula ragu-ragu
  const kunciKad = Math.min(saiz.qrMm + 12 * f, lebarMm - 2 * margin - 6 * f)
  const tinggiKadMaks = Math.min(saiz.qrMm, kunciKad - 2 * padKadMm) + 2 * padKadMm

  /**
   * Kira semua kedudukan menegak.
   * @param k     faktor kuncupan jurang (1 = irama cetak penuh)
   * @param kNama faktor saiz nama majlis — lever kedua bila kertas terlalu kecil
   */
  function susun(k: number, kNama: number) {
    const jarak = (mm: number, skala: number) => Math.max(mm * k, skala * f)
    const pad = jarak(8, 10)
    const dalamAtas = bingkaiAtasMm + pad
    const dalamBawah = bingkaiBawahMm - pad
    const lebarTeks = W - 2 * (margin + pad) * MM

    const saizEyebrow = 8.6 * f
    const yEyebrow = dalamAtas + jarak(3, 4 * f)
    const { baris: barisNama, saiz: saizNama } = muat(
      tajuk, serif, Math.max(22 * f, 40 * f * kNama), lebarTeks, 2,
    )
    const tinggiBarisNamaMm = (saizNama * 1.08) / MM
    const yNama1 = yEyebrow + jarak(8.5, 11 * f)
    const bawahNama =
      yNama1 + (barisNama.length - 1) * tinggiBarisNamaMm + (saizNama * 0.3) / MM

    const yHiasan = bawahNama + jarak(7, 9 * f)

    const bahagian = [bersih(meta.jenis ?? ''), bersih(meta.tarikh ?? ''), bersih(meta.venue ?? '')]
      .filter(Boolean)
    const sub = bahagian.join('   ·   ')
    const { baris: bSub, saiz: sSub } = muat(sub, sans, 11.5 * f, lebarTeks, 2)
    const tinggiBarisSubMm = (sSub * 1.5) / MM
    const ySub1 = yHiasan + jarak(6.5, 8.5 * f)
    const bawahTeks = bahagian.length
      ? ySub1 + (bSub.length - 1) * tinggiBarisSubMm + (sSub * 0.3) / MM
      : bawahNama

    const saizArahan = 11 * f
    const saizTerima = 12.5 * f
    const saizPautan = 10.5 * f
    const saizKaki = Math.max(6.8, 7.8 * f)
    const arahan = bersih('Imbas kod di bawah untuk kongsi gambar anda di buku tamu majlis kami.')
    const { baris: bArahan, saiz: sArahan } = muat(arahan, sansMedium, saizArahan, lebarTeks, 2)
    const tinggiBarisArahanMm = (sArahan * 1.42) / MM

    const yKaki = dalamBawah - jarak(1, 1 * f)
    const yGarisKaki = yKaki - jarak(7, 9 * f)
    const yPautan = yGarisKaki - jarak(9, 12 * f)
    const yTerima = yPautan - jarak(10, 12.5 * f)
    const yArahan1 = yTerima - jarak(11, 13.5 * f)
    const yArahanAtas = yArahan1 - (sArahan * 0.78) / MM

    const jurang = jarak(7, 9 * f)
    const ruangTengah = Math.max(0, yArahanAtas - bawahTeks - 2 * jurang)
    const kadHmm = Math.min(tinggiKadMaks, ruangTengah)
    const lebih = Math.max(0, ruangTengah - kadHmm)
    const kadAtasMm = bawahTeks + jurang + lebih * 0.5

    return {
      saizEyebrow, yEyebrow, barisNama, saizNama, yNama1,
      tinggiBarisNamaMm, yHiasan, bSub, sSub, tinggiBarisSubMm, ySub1,
      saizTerima, saizPautan, saizKaki, bArahan, sArahan,
      tinggiBarisArahanMm, yKaki, yGarisKaki, yPautan, yTerima, yArahan1,
      kadHmm, kadAtasMm, yArahanAtas,
    }
  }

  // Cuba susunan paling lapang dahulu; longgarkan hanya bila QR tak cukup besar.
  const calon: [number, number][] = [
    [1, 1], [0.75, 1], [0.6, 1], [0.5, 0.92], [0.4, 0.85], [0.35, 0.78],
  ]
  let L = susun(...calon[0])
  for (const [k, kNama] of calon) {
    L = susun(k, kNama)
    if (L.kadHmm - 2 * padKadMm >= qrMin) break
  }

  const {
    saizEyebrow, yEyebrow, barisNama, saizNama, yNama1,
    tinggiBarisNamaMm, yHiasan, bSub, sSub, tinggiBarisSubMm, ySub1,
    saizTerima, saizPautan, saizKaki, bArahan, sArahan,
    tinggiBarisArahanMm, yKaki, yGarisKaki, yPautan, yTerima, yArahan1,
    kadHmm, kadAtasMm,
  } = L

  // ------------------------------------------------------- 4. LUKIS: KEPALA TEKS
  teksJarak(page, 'BUKU TAMU', sansMedium, saizEyebrow, 0.46, tengah, Y(yEyebrow), aksen)
  barisNama.forEach((b, i) => {
    teksTengah(page, b, serif, saizNama, tengah, Y(yNama1 + i * tinggiBarisNamaMm), gelap)
  })

  // --------------------------------------------------------- 5. HIASAN PEMISAH
  hiasan(page, tengah, Y(yHiasan), 17 * f * MM, 3.4 * f * MM, 1.5 * f * MM, aksen, bingkai)

  // -------------------------------------------- 6. JENIS · TARIKH · VENUE
  bSub.forEach((b, i) => {
    teksTengah(page, b, sans, sSub, tengah, Y(ySub1 + i * tinggiBarisSubMm), lembut)
  })

  // -------------------------------------------------------------- 7. KAD QR
  const kadW = kadHmm * MM
  const padKad = padKadMm * MM
  const qrMm = kadHmm - 2 * padKadMm
  const qrPt = qrMm * MM
  const kadY = H - kadAtasMm * MM - kadW
  const kadX = tengah - kadW / 2

  // Kad putih bertepi dua: garis aksen luar + garis halus dalam.
  page.drawRectangle({ x: kadX, y: kadY, width: kadW, height: kadW, color: rgb(1, 1, 1) })
  page.drawRectangle({
    x: kadX,
    y: kadY,
    width: kadW,
    height: kadW,
    borderColor: aksen,
    borderWidth: saiz.id === 'a4' ? 1.3 : 1,
  })
  const insetKad = 2.4 * f * MM
  page.drawRectangle({
    x: kadX + insetKad,
    y: kadY + insetKad,
    width: kadW - 2 * insetKad,
    height: kadW - 2 * insetKad,
    borderColor: bingkai,
    borderWidth: 0.5,
  })

  const qrPng = await QRCode.toDataURL(pautanMajlis(slug), {
    margin: 1, // quiet zone — pengimbas perlu ruang putih di sekeliling QR
    width: Math.round(qrMm * 14),
    errorCorrectionLevel: 'M',
    color: { dark: '#1a1613', light: '#ffffff' },
  })
  const qrImg = await pdf.embedPng(qrPng)
  page.drawImage(qrImg, {
    x: tengah - qrPt / 2,
    y: kadY + padKad,
    width: qrPt,
    height: qrPt,
  })

  // -------------------------------------------------------- 8. BLOK BAWAH
  bArahan.forEach((b, i) => {
    teksTengah(page, b, sansMedium, sArahan, tengah, Y(yArahan1 + i * tinggiBarisArahanMm), gelap)
  })

  teksTengah(
    page,
    bersih('Terima kasih kerana hadir!'),
    serifItalik,
    saizTerima,
    tengah,
    Y(yTerima),
    lembut,
  )

  teksJarak(
    page,
    bersih(pautanMajlis(slug).replace('https://', '')),
    sans,
    saizPautan,
    0.06,
    tengah,
    Y(yPautan),
    aksen,
  )

  // Garis halus + kaki: nama tema (bukti ia ikut pilihan klien).
  page.drawLine({
    start: { x: (margin + 8) * MM, y: Y(yGarisKaki) },
    end: { x: W - (margin + 8) * MM, y: Y(yGarisKaki) },
    thickness: 0.5,
    color: bingkai,
  })
  teksJarak(
    page,
    bersih(`TEMA ${tema.nama.toUpperCase()}  ·  BUKU TAMU  ·  ALUNARA.MY`),
    sans,
    saizKaki,
    0.12,
    tengah,
    Y(yKaki),
    lembut,
  )

  return await pdf.save()
}
