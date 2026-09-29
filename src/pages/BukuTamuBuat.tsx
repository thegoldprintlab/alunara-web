/**
 * /buku-tamu/buat — halaman self-serve: client cipta gallery sendiri.
 *
 * ALIRAN
 *   1. Client dapat UNLOCK CODE dari bos (melalui WhatsApp, lepas bayar).
 *   2. Masukkan kod → kod sahkan (RPC alunara_gb_cek_unlock).
 *   3. Isi borang (9 langkah, macam Sedetik).
 *   4. Tekan "Cipta" → RPC alunara_gb_create_gallery (kod ditandakan guna).
 *   5. Dapat link peribadi alunara.my/buku-tamu/<slug> + QR.
 *
 * KESELAMATAN
 *   Kod unlock adalah 1-GUNA. Lepas cipta, kod luput. Klien tak boleh cipta
 *   gallery tanpa kod yang bos bagi (tiada payment gateway — payment manual
 *   via WhatsApp dulu).
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
  { id: 'default', label: 'Klasik' },
  { id: 'minimalis', label: 'Minimalis' },
  { id: 'floral', label: 'Floral' },
  { id: 'rustic', label: 'Rustic' },
] as const

type InfoKod = { sah: boolean; is_pro: boolean; sebab: string }

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

  const slugRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (info?.sah) slugRef.current?.focus()
  }, [info?.sah])

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
            Ini pautan galeri anda. Kongsi dengan tetamu melalui QR atau link:
          </p>
          <p className="bt-hasil-link">
            <code>alunara.my/buku-tamu/{hasil.slug}</code>
          </p>
          <div className="bt-hero-aksi">
            <Link className="bt-btn" to={`/buku-tamu/${hasil.slug}`}>
              Buka galeri
            </Link>
            <Link className="bt-btn bt-btn--halus" to="/hubungi">
              Minta QR untuk cetak
            </Link>
          </div>
          <p className="bt-info bt-info--kecil">
            {info.is_pro
              ? 'Galeri Premium: slideshow + muat turun ZIP + 6 bulan aktif.'
              : 'Galeri aktif 90 hari selepas tarikh majlis.'}
          </p>
        </header>
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
        <div className="bt-buat-pilih">
          {TEMA.map((t) => (
            <button
              key={t.id}
              className={'bt-pilih' + (tema === t.id ? ' bt-pilih--aktif' : '')}
              onClick={() => setTema(t.id)}
            >
              {t.label}
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
