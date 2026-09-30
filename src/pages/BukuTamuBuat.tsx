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

const TEMA = [
  { id: 'default', label: 'Klasik', warna: '#201a15', aksen: '#c8a165', nota: 'Hitam hangat + emas' },
  { id: 'minimalis', label: 'Minimalis', warna: '#f3efe8', aksen: '#8a7f6d', nota: 'Ivory bersih, garis halus' },
  { id: 'floral', label: 'Floral', warna: '#f7ecf1', aksen: '#b4657f', nota: 'Merah jambu + bunga' },
  { id: 'rustic', label: 'Rustic', warna: '#efe3d2', aksen: '#8a5a34', nota: 'Ton bumi, coklat terracotta' },
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
  tajukMm: number
  teksMm: number
}

const SAIZ: SaizKertas[] = [
  { id: 'a4', label: 'A4 — poster meja (210 × 297 mm)', mm: [210, 297], qrMm: 62, tajukMm: 26, teksMm: 13 },
  { id: 'a6', label: 'A6 — kad kecil (105 × 148 mm)', mm: [105, 148], qrMm: 38, tajukMm: 12, teksMm: 8 },
  { id: 'a5', label: 'A5 — kad sederhana (148 × 210 mm)', mm: [148, 210], qrMm: 48, tajukMm: 15, teksMm: 9.5 },
]

function pautanMajlis(slug: string) {
  return `https://alunara.my/buku-tamu/${slug}`
}

/**
 * Jana PDF QR pada saiz kertas yang dipilih.
 * Teks dipecah baris secara manual — pdf-lib tiada word-wrap automatik, dan
 * teks Melayu yang panjang mesti muat dalam margin kad kecil.
 */
async function janaPdfQr(slug: string, saiz: SaizKertas, tajuk: string) {
  const [lebarMm, tinggiMm] = saiz.mm
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([lebarMm * MM, tinggiMm * MM])
  const font = await pdf.embedFont(StandardFonts.HelveticaBold)
  const font2 = await pdf.embedFont(StandardFonts.Helvetica)
  const emas = rgb(0.784, 0.631, 0.396)
  const gelap = rgb(0.125, 0.102, 0.082)

  const qrPng = await QRCode.toDataURL(pautanMajlis(slug), {
    margin: 1,
    width: Math.round(saiz.qrMm * 12),
    errorCorrectionLevel: 'M',
    color: { dark: '#1a1613', light: '#ffffff' },
  })
  const qrImg = await pdf.embedPng(qrPng)
  const qrPt = saiz.qrMm * MM
  const x = (lebarMm * MM - qrPt) / 2

  // Bingkai emas halus + tajuk di atas, arahan di bawah.
  page.drawRectangle({
    x: 5 * MM,
    y: 5 * MM,
    width: lebarMm * MM - 10 * MM,
    height: tinggiMm * MM - 10 * MM,
    borderColor: emas,
    borderWidth: saiz.id === 'a4' ? 1.6 : 0.9,
  })

  const tajukY = tinggiMm * MM - 22 * MM
  page.drawText('BUKU TAMU', {
    x: (lebarMm * MM - font2.widthOfTextAtSize('BUKU TAMU', saiz.teksMm * 0.8 * MM)) / 2,
    y: tajukY,
    size: saiz.teksMm * 0.8 * MM,
    font: font2,
    color: gelap,
  })
  const nama = tajuk.length > 40 ? tajuk.slice(0, 39) + '…' : tajuk
  page.drawText(nama, {
    x: (lebarMm * MM - font.widthOfTextAtSize(nama, saiz.tajukMm)) / 2,
    y: tajukY - saiz.tajukMm * 1.15,
    size: saiz.tajukMm,
    font,
    color: gelap,
  })

  page.drawImage(qrImg, { x, y: (tinggiMm * MM - qrPt) / 2 - (saiz.id === 'a4' ? 12 * MM : 5 * MM), width: qrPt, height: qrPt })

  const baris =
    saiz.id === 'a4'
      ? ['Imbas QR ini, kongsi gambar anda di buku tamu kami.', 'Terima kasih kerana hadir!']
      : ['Imbas QR, kongsi gambar anda.', 'Terima kasih kerana hadir!']
  const saizTeks = saiz.id === 'a4' ? 12 : 8.5
  baris.forEach((b, i) => {
    page.drawText(b, {
      x: (lebarMm * MM - font2.widthOfTextAtSize(b, saizTeks)) / 2,
      y: 14 * MM - i * (saizTeks + 4),
      size: saizTeks,
      font: font2,
      color: gelap,
    })
  })
  // Link kecil di bawah — sesetengah orang lebih suka taip.
  const kecil = pautanMajlis(slug).replace('https://', '')
  page.drawText(kecil, {
    x: (lebarMm * MM - font2.widthOfTextAtSize(kecil, saiz.id === 'a4' ? 9 : 6)) / 2,
    y: 8 * MM,
    size: saiz.id === 'a4' ? 9 : 6,
    font: font2,
    color: emas,
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
    try {
      const bytes = await janaPdfQr(hasil.slug, saiz, nickname.trim() || 'Majlis Kami')
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
            <div className="bt-qr">
              <img src={qrPratonton} alt={`QR buku tamu ${hasil.slug}`} width={220} height={220} />
            </div>
          ) : (
            <p className="bt-info bt-info--kecil">Menjana QR…</p>
          )}
          <p className="bt-info bt-info--kecil">
            Pilih saiz kertas. Cetak pada 100% (jangan “fit to page”) supaya QR kekal tajam.
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
            <button className="bt-btn bt-btn--halus" disabled={!!jana} onClick={() => void muatPdf(SAIZ[0])}>
              Muat turun A4
            </button>
            <button className="bt-btn bt-btn--halus" disabled={!!jana} onClick={() => void muatPdf(SAIZ[1])}>
              Muat turun A6
            </button>
          </div>
          {hasilRalat && <p className="bt-ralat">{hasilRalat}</p>}
          <p className="bt-info bt-info--kecil">
            Nak kami cetak & hantar sekali? <Link to="/hubungi" className="bt-pautan">Beritahu kami</Link>.
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
          Ini warna galeri yang tetamu anda akan nampak. Pilih satu — boleh tukar kemudian.
        </p>
        <div className="bt-tema-grid">
          {TEMA.map((t) => (
            <button
              key={t.id}
              className={'bt-tema' + (tema === t.id ? ' bt-tema--aktif' : '')}
              onClick={() => setTema(t.id)}
              aria-pressed={tema === t.id}
            >
              <span className="bt-tema__contoh" style={{ background: t.warna }}>
                <span className="bt-tema__tajuk" style={{ color: t.aksen }}>
                  Ali &amp; Abu
                </span>
                <span className="bt-tema__bar" style={{ background: t.aksen }} />
                <span className="bt-tema__bar bt-tema__bar--pendek" style={{ background: t.aksen }} />
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
