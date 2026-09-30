/**
 * /buku-tamu/buat — halaman self-serve: client cipta gallery sendiri.
 *
 * ALIRAN
 *   1. Client dapat UNLOCK CODE dari bos (melalui WhatsApp, lepas bayar).
 *   2. Masukkan kod → kod sahkan (RPC alunara_gb_cek_unlock).
 *   3. Isi borang (9 langkah, macam Sedetik).
 *   4. Tekan "Cipta" → RPC alunara_gb_create_gallery (kod ditandakan guna).
 *   5. Dapat link peribadi alunara.my/buku-tamu/<slug> + QR siap muat turun
 *      (A4 untuk poster meja, A6/A5 untuk kad letak atas meja).
 *
 * KESELAMATAN
 *   Kod unlock adalah 1-GUNA. Lepas cipta, kod luput. Klien tak boleh cipta
 *   gallery tanpa kod yang bos bagi (tiada payment gateway — payment manual
 *   via WhatsApp dulu).
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { PDFFont, PDFPage } from 'pdf-lib'
import { waLink, MSG } from '../content'
import './BukuTamu.css'

const URL_BASE = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''

/** 6 jenis event — sama macam Sedetik. */
const JENIS_EVENT = [
  { id: 'nikah', label: 'Nikah / Akad' },
  { id: 'resepsi-lelaki', label: 'Resepsi Lelaki' },
  { id: 'resepsi-wanita', label: 'Resepsi Wanita' },
  { id: 'tunang', label: 'Pertunangan' },
  { id: 'sambutan', label: 'Sambutan / Ulang Tahun' },
  { id: 'lain', label: 'Majlis Lain' },
] as const

/*
 * Pilihan tema = warna GALERI TETAMU, bukan setup meja & kerusi.
 *
 * Bos tegur: jangan guna gambar meja di sini — ia mengelirukan (setup meja
 * dipilih masa tempah, bukan masa buat buku tamu). Jadi setiap kad melukis
 * UI sebenar halaman tetamu: kepala majlis, medan nama, butang.
 * `kad` = warna latar kad dalam mockup itu.
 */
const TEMA = [
  {
    id: 'default',
    label: 'Klasik',
    warna: '#201a15',
    kad: '#2a231c',
    aksen: '#c8a165',
    nota: 'Hitam hangat + emas',
  },
  {
    id: 'minimalis',
    label: 'Minimalis',
    warna: '#f3efe8',
    kad: '#ffffff',
    aksen: '#8a7f6d',
    nota: 'Ivory bersih, garis halus',
  },
  {
    id: 'floral',
    label: 'Floral',
    warna: '#f7ecf1',
    kad: '#ffffff',
    aksen: '#b4657f',
    nota: 'Merah jambu + bunga',
  },
  {
    id: 'rustic',
    label: 'Rustic',
    warna: '#efe3d2',
    kad: '#fffaf3',
    aksen: '#8a5a34',
    nota: 'Ton bumi, coklat terracotta',
  },
] as const

type InfoKod = { sah: boolean; is_pro: boolean; sebab: string }

/* ---------------------------------------------------------------------------
 * QR + PDF saiz cetak.
 *
 * Kenapa dijana dalam pelayar (bukan dihantar oleh bos):
 *   * Klien dapat QR SERTA-MERTA selepas cipta galeri — tiada menunggu manusia,
 *     jadi majlis hujung minggu tak tersangkut.
 *   * PDF dijana dengan pdf-lib pada saiz FIZIKAL sebenar (mm), jadi bila
 *     dicetak "100%" saiznya tepat — QR tak jadi kabur atau terpotong.
 *   * Saiz QR di atas kertas dikekalkan 60mm (A4) / 38mm (A6/A5): pengimbas
 *     telefon senang baca walau dari jauh.
 * ------------------------------------------------------------------------- */
const MM = 72 / 25.4 // 1 mm dalam point PDF

type SaizKertas = {
  id: 'a4' | 'a6' | 'a5'
  label: string
  mm: [number, number]
  qrMm: number
}

const SAIZ: SaizKertas[] = [
  { id: 'a4', label: 'A4 — poster meja (210 × 297 mm)', mm: [210, 297], qrMm: 70 },
  { id: 'a5', label: 'A5 — kad sederhana (148 × 210 mm)', mm: [148, 210], qrMm: 54 },
  { id: 'a6', label: 'A6 — kad kecil (105 × 148 mm)', mm: [105, 148], qrMm: 42 },
]

/**
 * Palet CETAK setiap tema.
 *
 * KENAPA BUKAN WARNA SKRIN TERUS
 *   Tema skrin (cth. floral #c0768f) terlalu cerah untuk dakwat atas kertas,
 *   dan jalur gelap memakan dakwat. Setiap tema di sini ada versi cetak:
 *   aksen yang lebih dalam + jalur pastel yang murah dakwat, atas kertas putih.
 *   Nama tema dicetak pada poster supaya klien nampak ia benar-benar ikut
 *   pilihan dia, bukan template generik.
 */
type TemaCetak = { nama: string; aksen: string; jalur: string; teks: string }
const TEMA_CETAK: Record<string, TemaCetak> = {
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

/**
 * Buang aksara yang font Standard (WinAnsi) tak boleh lukis.
 * pdf-lib TIDAK guna font Unicode — emoji/aksara luar set akan jadi "?" atau
 * membaling ralat. Nama majlis orang Melayu selalunya selamat, tapi tetamu
 * suka letak emoji, jadi kita bersihkan di sini.
 */
function bersih(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Pecah teks ikut lebar sebenar font. */
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

/** Lukis teks tengah dengan jarak huruf (pdf-lib tak sokong letter-spacing). */
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
  const lebar =
    font.widthOfTextAtSize(teks, saiz) + jarak * Math.max(teks.length - 1, 0)
  let x = tengahX - lebar / 2
  for (const c of teks) {
    page.drawText(c, { x, y, size: saiz, font, color })
    x += font.widthOfTextAtSize(c, saiz) + jarak
  }
}

function pautanMajlis(slug: string) {
  return `https://alunara.my/buku-tamu/${slug}`
}

/** '2026-11-22' → '22 November 2026' untuk cetakan. */
function tarikhMs(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })
}

export type QrMeta = {
  tajuk: string
  tema: string
  jenis: string
  tarikh?: string
  venue?: string
}

/**
 * Jana PDF QR pada saiz kertas yang dipilih, IKUT TEMA yang klien pilih.
 *
 * Susun atur (semua saiz skala dari lebar kertas):
 *   jalur tema di atas → "BUKU TAMU" berjarak huruf → nama majlis →
 *   jenis/tarikh/venue → kad putih QR (quiet zone dikekalkan) →
 *   arahan imbas → pautan taip-tangan → kaki ALUNARA + nama tema.
 *
 * QR dilukis pada saiz FIZIKAL (mm) dan PDF ditulis pada dimensi mm sebenar,
 * jadi cetakan "100%" menghasilkan QR yang tepat — bukan skala kabur.
 */
async function janaPdfQr(slug: string, saiz: SaizKertas, meta: QrMeta) {
  const [lebarMm, tinggiMm] = saiz.mm
  const f = lebarMm / 210 // faktor skala dari reka bentuk asas A4
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
  /** y dari atas (mm) → koordinat PDF. */
  const Y = (mm: number) => H - mm * MM

  // ---- jalur tema di atas + garis aksen ----
  const tinggiJalur = 30 * f
  page.drawRectangle({ x: 0, y: H - tinggiJalur * MM, width: W, height: tinggiJalur * MM, color: jalur })
  page.drawRectangle({ x: 0, y: H - (tinggiJalur + 1.6) * MM, width: W, height: 1.6 * MM, color: aksen })

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

  // ---- "BUKU TAMU" berjarak huruf, dalam jalur ----
  teksJarak(
    page,
    'BUKU TAMU',
    font2,
    9 * f + 2,
    2.2 * f + 0.6,
    tengah,
    Y(13 * f),
    aksen,
  )

  // ---- nama majlis (auto-kecil supaya muat 2 baris) ----
  const tajuk = bersih(meta.tajuk) || 'Majlis Kami'
  const { baris, saiz: saizTajuk } = muat(tajuk, font, 30 * f, W - 26 * MM, 2)
  baris.forEach((b, i) => {
    page.drawText(b, {
      x: tengah - font.widthOfTextAtSize(b, saizTajuk) / 2,
      y: Y(40 * f + i * saizTajuk * 0.42),
      size: saizTajuk,
      font,
      color: gelap,
    })
  })

  // ---- sub-baris: jenis majlis · tarikh · venue ----
  const bahagian = [bersih(meta.jenis), bersih(meta.tarikh ?? ''), bersih(meta.venue ?? '')]
    .filter(Boolean)
  if (bahagian.length) {
    const sub = bahagian.join('  ·  ')
    const { baris: bSub, saiz: sSub } = muat(sub, font2, 10.5 * f + 1.5, W - 30 * MM, 2)
    const ySub = Y(40 * f + baris.length * saizTajuk * 0.42 + 7 * f + 3)
    bSub.forEach((b, i) => {
      page.drawText(b, {
        x: tengah - font2.widthOfTextAtSize(b, sSub) / 2,
        y: ySub - i * (sSub + 2),
        size: sSub,
        font: font2,
        color: kelabu,
      })
    })
  }

  // ---- kad QR: kotak putih bertepi aksen, QR di tengah ----
  const qrPt = saiz.qrMm * MM
  const padKad = 5 * f * MM
  const kadW = qrPt + padKad * 2
  const kadY = Y(150 * f) - padKad // bawah kad
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
    width: Math.round(saiz.qrMm * 14),
    errorCorrectionLevel: 'M',
    color: { dark: '#1a1613', light: '#ffffff' },
  })
  const qrImg = await pdf.embedPng(qrPng)
  page.drawImage(qrImg, { x: tengah - qrPt / 2, y: kadY + padKad, width: qrPt, height: qrPt })

  // ---- arahan imbas ----
  const arahan = bersih(
    'Imbas QR ini untuk kongsi gambar anda di buku tamu majlis kami.',
  )
  const { baris: bArahan, saiz: sArahan } = muat(arahan, font2, 11 * f + 2, W - 30 * MM, 2)
  let yArahan = kadY - 9 * MM
  bArahan.forEach((b) => {
    page.drawText(b, {
      x: tengah - font2.widthOfTextAtSize(b, sArahan) / 2,
      y: yArahan,
      size: sArahan,
      font: font2,
      color: gelap,
    })
    yArahan -= sArahan + 3
  })

  page.drawText(bersih('Terima kasih kerana hadir!'), {
    x: tengah - fontMiring.widthOfTextAtSize('Terima kasih kerana hadir!', 10 * f + 1.5) / 2,
    y: yArahan - 1,
    size: 10 * f + 1.5,
    font: fontMiring,
    color: kelabu,
  })

  // ---- pautan taip-tangan (sesetengah orang lebih suka taip) ----
  const pautanKecil = bersih(pautanMajlis(slug).replace('https://', ''))
  const saizPautan = 8.5 * f + 2
  page.drawText(pautanKecil, {
    x: tengah - font2.widthOfTextAtSize(pautanKecil, saizPautan) / 2,
    y: margin * MM + 9 * MM,
    size: saizPautan,
    font: font2,
    color: aksen,
  })

  // ---- kaki: nama tema (bukti ia ikut pilihan klien) ----
  const kaki = bersih(`Tema ${tema.nama}  ·  Buku Tamu ALUNARA  ·  alunara.my`)
  page.drawText(kaki, {
    x: tengah - font2.widthOfTextAtSize(kaki, 7.5 * f + 1.5) / 2,
    y: margin * MM + 4.5 * MM,
    size: 7.5 * f + 1.5,
    font: font2,
    color: kelabu,
  })

  return await pdf.save()
}

function muatTurun(blob: Blob, nama: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nama
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

async function rpc(fn: string, body: Record<string, unknown>) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = (await r.json().catch(() => null)) as unknown
  return { ok: r.ok, status: r.status, data: j }
}

export default function BukuTamuBuat() {
  const [kod, setKod] = useState('')
  const [info, setInfo] = useState<InfoKod | null>(null)
  const [semak, setSemak] = useState(false)
  const [ralat, setRalat] = useState('')

  const [eventType, setEventType] = useState<string>('nikah')
  const [nickname, setNickname] = useState('')
  const [slug, setSlug] = useState('')
  const [tarikh, setTarikh] = useState('')
  const [venue, setVenue] = useState('')
  const [welcomeLabel, setWelcomeLabel] = useState('')
  const [welcomeMsg, setWelcomeMsg] = useState('')
  const [pecah, setPecah] = useState(false)
  const [tema, setTema] = useState('default')

  const [cipta, setCipta] = useState(false)
  const [hasil, setHasil] = useState<{ slug: string } | null>(null)
  const [hasilRalat, setHasilRalat] = useState('')
  const [qrPratonton, setQrPratonton] = useState('')
  const [saizPilih, setSaizPilih] = useState<'a4' | 'a6' | 'a5'>('a4')
  const [jana, setJana] = useState('')

  const slugRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (info?.sah) slugRef.current?.focus()
  }, [info?.sah])

  // Pratonton QR dijana sebaik sahaja galeri siap — klien terus nampak hasilnya.
  useEffect(() => {
    if (!hasil?.slug) return
    void QRCode.toDataURL(pautanMajlis(hasil.slug), {
      margin: 1,
      width: 480,
      errorCorrectionLevel: 'M',
      color: { dark: '#1a1613', light: '#ffffff' },
    })
      .then(setQrPratonton)
      .catch(() => setQrPratonton(''))
  }, [hasil?.slug])

  async function muatPdf(saiz: SaizKertas) {
    if (!hasil?.slug) return
    setJana(saiz.id)
    setHasilRalat('')
    try {
      const bytes = await janaPdfQr(hasil.slug, saiz, {
        tajuk: nickname.trim() || 'Majlis Kami',
        tema,
        jenis: JENIS_EVENT.find((j) => j.id === eventType)?.label ?? '',
        tarikh: tarikh ? tarikhMs(tarikh) : '',
        venue,
      })
      muatTurun(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `QR-BukuTamu-${hasil.slug}-${saiz.id.toUpperCase()}.pdf`)
    } catch {
      setHasilRalat('Gagal jana PDF. Cuba lagi atau minta kami hantar QR.')
    } finally {
      setJana('')
    }
  }

  async function semakKod() {
    setSemak(true)
    setRalat('')
    setInfo(null)
    const { ok, data } = await rpc('alunara_gb_cek_unlock', { p_code: kod })
    setSemak(false)
    if (!ok) {
      setRalat('Tak dapat sahkan kod. Cuba lagi.')
      return
    }
    // RPC RETURNS TABLE → pulang ARRAY. Ambil elemen pertama.
    const arr = Array.isArray(data) ? data : [data]
    const d = (arr[0] ?? null) as InfoKod | null
    if (!d || !d.sah) {
      setRalat(d?.sebab || 'Kod tak sah.')
      return
    }
    setInfo(d)
  }

  async function buatGallery() {
    setCipta(true)
    setHasilRalat('')
    const { ok, data } = await rpc('alunara_gb_create_gallery', {
      p_unlock_code: kod,
      p_nickname: nickname,
      p_title: nickname, // tajuk penuh = nickname buat masa ni (boleh ubah nanti)
      p_event_type: eventType,
      p_slug: slug || null,
      p_event_date: tarikh || null,
      p_venue: venue || null,
      p_welcome_label: welcomeLabel || null,
      p_welcome_msg: welcomeMsg || null,
      p_theme: tema,
    })
    setCipta(false)
    if (!ok) {
      const d = data as { message?: string } | null
      setHasilRalat(d?.message || 'Gagal cipta gallery. Kod mungkin dah guna.')
      return
    }
    const d = data as { slug: string }[] | null
    if (d && d.length) setHasil(d[0])
    else setHasilRalat('Gagal dapatkan link. Hubungi kami.')
  }

  // ------------------------------------------------------- LANGKAH 1: KOD
  if (!info?.sah) {
    return (
      <div className="bt-kulit bt-mula bt-buat">
        <header className="bt-hero">
          <p className="bt-eyebrow">ALUNARA · Buku Tamu</p>
          <h1>Cipta galeri majlis anda</h1>
          <p className="bt-hero-sub">
            Masukkan kod yang anda terima daripada kami untuk mula. Kod ini satu
            guna — selepas galeri dicipta, ia tak boleh dipakai lagi.
          </p>
          <div className="bt-buat-kod">
            <input
              className="bt-input bt-input--kod"
              value={kod}
              onChange={(e) => setKod(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="CONTOH: AB23CD45"
              maxLength={12}
              onKeyDown={(e) => e.key === 'Enter' && void semakKod()}
            />
            <button className="bt-btn" disabled={semak || kod.length < 4} onClick={() => void semakKod()}>
              {semak ? 'Menyemak…' : 'Sahkan kod'}
            </button>
          </div>
          {ralat && <p className="bt-ralat">{ralat}</p>}
          <p className="bt-info bt-info--kecil">
            Tiada kod?{' '}
            <Link to="/buku-tamu" className="bt-pautan">
              Tempah buku tamu di sini
            </Link>
            .
          </p>
        </header>
      </div>
    )
  }

  // ------------------------------------------------------- LANGKAH 2: FORM
  if (hasil) {
    return (
      <div className="bt-kulit bt-mula bt-buat">
        <header className="bt-hero bt-hero--jaya">
          <p className="bt-eyebrow">ALUNARA · Buku Tamu</p>
          <h1>Galeri anda siap! 🎉</h1>
          <p className="bt-hero-sub">
            Ini pautan galeri anda. Cetak QR di bawah dan letak atas meja majlis —
            tetamu imbas, terus upload gambar.
          </p>
          <p className="bt-hasil-link">
            <code>alunara.my/buku-tamu/{hasil.slug}</code>
          </p>
          <div className="bt-hero-aksi">
            <Link className="bt-btn" to={`/buku-tamu/${hasil.slug}`}>
              Buka galeri
            </Link>
            <button
              className="bt-btn bt-btn--halus"
              onClick={() => {
                const url = pautanMajlis(hasil.slug)
                if (navigator.share) void navigator.share({ title: 'Buku Tamu', url }).catch(() => {})
                else void navigator.clipboard?.writeText(url)
              }}
            >
              Kongsi pautan
            </button>
          </div>
        </header>

        <section className="bt-bahagian">
          <h2>QR untuk dicetak</h2>
          {qrPratonton ? (
            /* QR ini sendiri boleh diklik — klik untuk uji pautan majlis.
               Sebelum ini pautan di bawahnya pergi ke /hubungi, jadi orang
               yang klik QR tersasar ke halaman Hubungi. */
            <a
              className="bt-qr"
              href={pautanMajlis(hasil.slug)}
              target="_blank"
              rel="noreferrer noopener"
              title="Buka galeri majlis"
            >
              <img src={qrPratonton} alt={`QR buku tamu ${hasil.slug}`} width={220} height={220} />
              <span className="bt-qr__nota">Klik untuk uji pautan majlis</span>
            </a>
          ) : (
            <p className="bt-info bt-info--kecil">Menjana QR…</p>
          )}
          <p className="bt-info bt-info--kecil">
            Poster cetak akan ikut tema <strong>{TEMA.find((t) => t.id === tema)?.label}</strong> yang
            anda pilih, dengan nama majlis, jenis majlis, tarikh dan venue.
          </p>
          <div className="bt-buat-pilih">
            {SAIZ.map((s) => (
              <button
                key={s.id}
                className={'bt-pilih' + (saizPilih === s.id ? ' bt-pilih--aktif' : '')}
                onClick={() => setSaizPilih(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="bt-hero-aksi" style={{ marginTop: 16 }}>
            <button
              className="bt-btn"
              disabled={!!jana}
              onClick={() => void muatPdf(SAIZ.find((s) => s.id === saizPilih) ?? SAIZ[0])}
            >
              {jana ? 'Menjana…' : `Muat turun QR ${saizPilih.toUpperCase()} (PDF)`}
            </button>
          </div>
          <p className="bt-info bt-info--kecil">
            Cetak pada 100% (jangan “fit to page”). QR di atas kertas kekal 70 mm (A4) /
            54 mm (A5) / 42 mm (A6) — cukup besar untuk diimbas dari jauh.
          </p>
          {hasilRalat && <p className="bt-ralat">{hasilRalat}</p>}
          <p className="bt-info bt-info--kecil">
            Nak kami cetak &amp; hantar sekali?{' '}
            <a
              className="bt-pautan"
              href={waLink(MSG.bukuTamuQr(nickname.trim() || 'majlis saya', hasil.slug))}
              target="_blank"
              rel="noreferrer noopener"
            >
              WhatsApp kami
            </a>
            .
          </p>
        </section>

        <p className="bt-info bt-info--kecil" style={{ textAlign: 'center' }}>
          {info.is_pro
            ? 'Galeri Premium: slideshow + muat turun ZIP + 6 bulan aktif.'
            : 'Galeri aktif 90 hari selepas tarikh majlis.'}
        </p>
      </div>
    )
  }

  return (
    <div className="bt-kulit bt-mula bt-buat">
      <header className="bt-hero">
        <p className="bt-eyebrow">ALUNARA · Buku Tamu</p>
        <h1>Butiran majlis</h1>
        <p className="bt-hero-sub">
          Isi maklumat majlis anda. Semua boleh diubah kemudian melalui kami.
        </p>
      </header>

      <section className="bt-bahagian">
        <h2>1. Jenis majlis</h2>
        <div className="bt-buat-pilih">
          {JENIS_EVENT.map((j) => (
            <button
              key={j.id}
              className={'bt-pilih' + (eventType === j.id ? ' bt-pilih--aktif' : '')}
              onClick={() => setEventType(j.id)}
            >
              {j.label}
            </button>
          ))}
        </div>
      </section>

      <section className="bt-bahagian">
        <h2>2. Tajuk majlis (nickname)</h2>
        <input
          className="bt-input"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="cth. Ali & Abu"
        />
      </section>

      <section className="bt-bahagian">
        <h2>3. Pautan peribadi</h2>
        <p className="bt-info">
          <code>alunara.my/buku-tamu/</code>
        </p>
        <input
          ref={slugRef}
          className="bt-input"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          placeholder="ali-abu (kosongkan untuk auto dari tajuk)"
        />
      </section>

      <section className="bt-bahagian">
        <h2>4. Tarikh majlis</h2>
        <input className="bt-input" type="date" value={tarikh} onChange={(e) => setTarikh(e.target.value)} />
      </section>

      <section className="bt-bahagian">
        <h2>5. Venue / lokasi</h2>
        <input className="bt-input" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="cth. Dewan Melaka" />
      </section>

      <section className="bt-bahagian">
        <h2>6. Ucapan selamat datang</h2>
        <input
          className="bt-input"
          value={welcomeLabel}
          onChange={(e) => setWelcomeLabel(e.target.value)}
          placeholder="Label (kosongkan = 'Selamat Datang')"
        />
        <textarea
          className="bt-input bt-input--area"
          value={welcomeMsg}
          onChange={(e) => setWelcomeMsg(e.target.value)}
          placeholder="Ucapan custom (cth. Selamat datang! Sila kongsi gambar terbaik anda.)"
          rows={3}
        />
      </section>

      <section className="bt-bahagian">
        <h2>7. Pecah gallery untuk event</h2>
        <label className="bt-togol">
          <input type="checkbox" checked={pecah} onChange={(e) => setPecah(e.target.checked)} />
          <span>Ada lebih dari satu event (cth. nikah + resepsi)</span>
        </label>
        {pecah && (
          <p className="bt-info bt-info--kecil">
            Anda boleh tambah sub-event (nikah, resepsi lelaki, resepsi wanita)
            selepas galeri dicipta — hubungi kami untuk aktifkan.
          </p>
        )}
      </section>

      <section className="bt-bahagian">
        <h2>8. Tema</h2>
        <p className="bt-info bt-info--kecil">
          Ini warna halaman yang <strong>tetamu anda nampak</strong> masa scan QR.
          Pilih satu — boleh tukar kemudian. Setup meja &amp; kerusi dipilih masa tempah.
        </p>
        <div className="bt-tema-grid">
          {TEMA.map((t) => (
            <button
              key={t.id}
              className={'bt-tema' + (tema === t.id ? ' bt-tema--aktif' : '')}
              onClick={() => setTema(t.id)}
              aria-pressed={tema === t.id}
            >
              {/* Mockup UI halaman tetamu — bukan gambar setup meja. */}
              <span className="bt-tema__contoh" style={{ background: t.warna }} aria-hidden="true">
                <span className="bt-tema__ui">
                  <span className="bt-tema__ui-eyebrow" style={{ color: t.aksen }}>
                    Buku Tamu
                  </span>
                  <span className="bt-tema__ui-tajuk" style={{ color: t.aksen }}>
                    Ali &amp; Abu
                  </span>
                  <span className="bt-tema__ui-kad" style={{ background: t.kad }}>
                    <span className="bt-tema__ui-baris" style={{ background: t.aksen }} />
                    <span className="bt-tema__ui-baris bt-tema__ui-baris--pendek" style={{ background: t.aksen }} />
                  </span>
                  <span className="bt-tema__ui-btn" style={{ background: t.aksen }} />
                </span>
              </span>
              <span className="bt-tema__nama">{t.label}</span>
              <span className="bt-tema__nota">{t.nota}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="bt-bahagian">
        <h2>9. Cover photo</h2>
        <p className="bt-info bt-info--kecil">
          Boleh tambah kemudian melalui kami. Buat masa ini galeri guna tema
          pilihan anda.
        </p>
      </section>

      <section className="bt-bahagian bt-cta">
        {hasilRalat && <p className="bt-ralat">{hasilRalat}</p>}
        <button
          className="bt-btn bt-btn--besar"
          disabled={cipta || nickname.trim().length < 2}
          onClick={() => void buatGallery()}
        >
          {cipta ? 'Mencipta…' : 'Cipta galeri saya'}
        </button>
      </section>
    </div>
  )
}
