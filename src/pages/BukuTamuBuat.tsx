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
import { janaPdfQr, SAIZ, pautanMajlis, tarikhMs } from '../lib/qrPoster'
import type { SaizKertas } from '../lib/qrPoster'
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
 * QR + PDF saiz cetak — dijana oleh `src/lib/qrPoster.ts`.
 *
 * KENAPA DIJANA DALAM PELAYAR (bukan dihantar oleh bos):
 *   * Klien dapat QR SERTA-MERTA selepas cipta galeri — tiada menunggu manusia,
 *     jadi majlis hujung minggu tak tersangkut.
 *   * PDF ditulis pada saiz FIZIKAL sebenar (mm), jadi cetakan "100%"
 *     menghasilkan QR tepat — bukan skala kabur.
 *
 * Penjana itu sendiri ada dalam `src/lib/qrPoster.ts` kerana bila ia duduk
 * dalam fail .tsx ia tak boleh diuji dari Node — dan itulah sebab poster
 * pertama (Helvetica, tiada susun atur tema) sampai ke tangan klien tanpa
 * sesiapa perasan. Ujian: `node scripts/uji-qr-poster.mjs`.
 * ------------------------------------------------------------------------- */

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
