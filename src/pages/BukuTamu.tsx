/**
 * Buku Tamu ALUNARA — halaman tetamu (v2).
 *
 * Aliran:
 *   1. Buka /buku-tamu/:slug (slug gallery) ATAU /buku-tamu/:kod (kod lama).
 *   2. Isi nama (+ ucapan) → dapat sesi.
 *   3. Kongsi media: FOTO (dengan filter film stock), VIDEO, atau VOICE NOTE.
 *   4. Galeri dikongsi — boleh filter ikut jenis media & jenis event.
 *
 * MEDIA
 *   * Foto    — WebGL filter film stock (macam v1).
 *   * Video   — fail dari kamera/gallery (max 3 minit).
 *   * Voice   — rakam terus dari browser (MediaRecorder, max 30 saat).
 *
 * KESELAMATAN
 *   * Tiada log masuk. Sesi dalam localStorage.
 *   * Semua RPC security definer — anon tak sentuh jadual langsung.
 *   * Signed URL server-side untuk upload & baca media.
 *   * Kalau slug v2 tak jumpa, fallback automatik ke kod v1 (tak pecah).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  STOCKS,
  STOCK_DEFAULT,
  cariStock,
  ciptaRenderer,
  muatImej,
  saizMuatTurun,
  canvasKeBlob,
  type FilmRenderer,
} from '../lib/filmStocks'
import './BukuTamu.css'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''

const VOICE_MAX_SAAT = 30
const UCAPAN_MAX = 1000

async function rpc(nama: string, args: Record<string, unknown>) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nama}`, {
    method: 'POST',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  })
  const teks = await r.text()
  let data: unknown = null
  try {
    data = teks ? JSON.parse(teks) : null
  } catch {
    data = teks
  }
  if (!r.ok) {
    const m = (data as { message?: string })?.message
    throw new Error(m || 'Ralat rangkaian')
  }
  return data
}

/* ------------------------------ v2 types ------------------------------ */
type InfoGallery = {
  gallery_id: string
  nickname: string
  title: string
  event_type: string
  event_date: string | null
  venue: string | null
  welcome_label: string | null
  welcome_message: string | null
  theme: string
  is_pro: boolean
  boleh_upload: boolean
}

type SubEvent = {
  event_id: string
  event_type: string
  label: string | null
  event_date: string | null
  venue: string | null
}

type Media = {
  id: string
  storage_path: string
  media_type: 'photo' | 'video' | 'voice'
  stock: string
  duration_sec: number | null
  nama_awal: string
  wish: string | null
  created_at: string
}

/* ------------------------------ v1 types (fallback) ------------------- */
type MaklumatV1 = {
  event_title: string
  host_name: string | null
  event_date: string | null
  boleh_upload: boolean
  jumlah_gambar: number
  stocks: string[] | null
}

type GambarV1 = {
  id: string
  storage_path: string
  stock: string
  nama_awal: string
  wish: string | null
  created_at: string
}

const SESI_KEY = 'alunara_bukutamu_sesi_v1'
const MEDIA_FILTER = ['semua', 'photo', 'video', 'voice'] as const
type MediaFilter = (typeof MEDIA_FILTER)[number]
const LABEL_MEDIA: Record<MediaFilter, string> = {
  semua: 'Semua',
  photo: 'Foto',
  video: 'Video',
  voice: 'Suara',
}

export default function BukuTamu() {
  const { kod = '' } = useParams()
  const kodAtas = kod.toUpperCase()

  // v2
  const [info, setInfo] = useState<InfoGallery | null>(null)
  const [subEvents, setSubEvents] = useState<SubEvent[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [urlPeta, setUrlPeta] = useState<Record<string, string>>({})
  const [filterMedia, setFilterMedia] = useState<MediaFilter>('semua')
  const [filterEvent, setFilterEvent] = useState<string>('semua')
  const [isV2, setIsV2] = useState(false)

  // v1 fallback
  const [maklumatV1, setMaklumatV1] = useState<MaklumatV1 | null>(null)
  const [gambarV1, setGambarV1] = useState<GambarV1[]>([])

  // shared
  const [nama, setNama] = useState('')
  const [ucapan, setUcapan] = useState('')
  const [sesi, setSesi] = useState<string | null>(null)
  const [stockPilih, setStockPilih] = useState(STOCK_DEFAULT)
  const [keamatan, setKeamatan] = useState(1)
  const [sibuk, setSibuk] = useState(false)
  const [ralat, setRalat] = useState('')
  const [mula, setMula] = useState(true)

  // foto
  const [imej, setImej] = useState<HTMLImageElement | null>(null)
  const [webglSedia, setWebglSedia] = useState(true)
  const [zoom, setZoom] = useState<GambarV1 | null>(null)

  // tab media
  const [tab, setTab] = useState<'foto' | 'video' | 'voice'>('foto')
  const [videoFail, setVideoFail] = useState<File | null>(null)

  // voice
  const [rakam, setRakam] = useState(false)
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null)
  const [voiceSaat, setVoiceSaat] = useState(0)

  // slideshow + realtime (polling)
  const [slaid, setSlaid] = useState(false)
  const [slaidIdx, setSlaidIdx] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<FilmRenderer | null>(null)
  const failRef = useRef<File | null>(null)
  const mediaRecRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const voiceTimerRef = useRef<number | null>(null)
  const voiceStartRef = useRef<number>(0)

  // ---- sesi tersimpan ----
  useEffect(() => {
    try {
      const simpan = localStorage.getItem(SESI_KEY)
      if (simpan) {
        const p = JSON.parse(simpan) as { kod: string; sesi: string; nama: string }
        if (p.kod === kodAtas) {
          setSesi(p.sesi)
          setNama(p.nama)
        }
      }
    } catch {
      /* abaikan */
    }
  }, [kodAtas])

  // ---- ambil signed URL ----
  async function ambilUrl(laluan: string[]) {
    if (!laluan.length) return
    try {
      const r = await fetch('/api/guestbook-sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'read', laluan }),
      })
      if (r.ok) {
        const j = await r.json()
        setUrlPeta((p) => ({ ...p, ...(j.urls || {}) }))
      }
    } catch {
      /* abaikan */
    }
  }

  async function muatMediaV2() {
    try {
      const m = (await rpc('alunara_gb_media', {
        p_slug: kod,
        p_media_type: filterMedia === 'semua' ? null : filterMedia,
        p_event_type: filterEvent === 'semua' ? null : filterEvent,
        p_limit: 500,
      })) as Media[]
      setMedia(m || [])
      await ambilUrl((m || []).map((x) => x.storage_path))
    } catch {
      /* jangan halang upload */
    }
  }

  async function muatGaleriV1() {
    try {
      const g = (await rpc('alunara_guestbook_gallery', {
        p_code: kodAtas,
        p_limit: 300,
      })) as GambarV1[]
      setGambarV1(g || [])
      await ambilUrl((g || []).map((x) => x.storage_path))
    } catch {
      /* jangan halang upload */
    }
  }

  const muatGaleri = useCallback(async () => {
    // Cuba v2 dulu (slug), fallback v1 (kod).
    try {
      const g = (await rpc('alunara_gb_gallery_info', { p_slug: kod })) as InfoGallery[]
      if (g?.length) {
        setIsV2(true)
        setInfo(g[0])
        const ev = (await rpc('alunara_gb_events', { p_slug: kod })) as SubEvent[]
        setSubEvents(ev || [])
        await muatMediaV2()
        return
      }
    } catch {
      /* bukan v2 */
    }
    setIsV2(false)
    await muatGaleriV1()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kod, kodAtas])

  // ---- muat info v1 (fallback) ----
  useEffect(() => {
    let batal = false
    ;(async () => {
      try {
        const m = (await rpc('alunara_guestbook_info', { p_code: kodAtas })) as MaklumatV1[]
        if (batal) return
        if (m?.length) setMaklumatV1(m[0])
      } catch {
        /* v1 info gagal tak kritikal */
      } finally {
        if (!batal) setMula(false)
      }
    })()
    void muatGaleri()
    return () => {
      batal = true
    }
  }, [kodAtas, muatGaleri])

  // ---- muat media bila filter berubah ----
  useEffect(() => {
    if (isV2) void muatMediaV2()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMedia, filterEvent, isV2])

  // ---- realtime (polling 5 saat) — galeri auto-refresh masa majlis ----
  useEffect(() => {
    if (!isV2) return
    const id = window.setInterval(() => {
      void muatMediaV2()
    }, 5000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isV2, filterMedia, filterEvent])

  // ---- slideshow auto-gerak ----
  useEffect(() => {
    if (!slaid) return
    const senarai = media.filter((m) => m.media_type === 'photo')
    if (!senarai.length) return
    const id = window.setInterval(() => {
      setSlaidIdx((i) => (i + 1) % senarai.length)
    }, 3000)
    return () => window.clearInterval(id)
  }, [slaid, media])

  // ---- renderer WebGL ----
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    try {
      const r = ciptaRenderer(cv)
      if (!r) {
        setWebglSedia(false)
        return
      }
      rendererRef.current = r
      return () => {
        r.buang()
        rendererRef.current = null
      }
    } catch {
      setWebglSedia(false)
    }
  }, [])

  useEffect(() => {
    const r = rendererRef.current
    if (!r || !imej) return
    r.lukis(imej, cariStock(stockPilih), keamatan)
  }, [imej, stockPilih, keamatan, webglSedia])

  const stockTersedia = useMemo(() => {
    if (isV2) return STOCKS
    const dibenar = maklumatV1?.stocks
    if (!dibenar?.length) return STOCKS
    return STOCKS.filter((s) => dibenar.includes(s.id))
  }, [maklumatV1, isV2])

  // ---- foto ----
  async function pilihFail(f: File | null) {
    if (!f) return
    setRalat('')
    failRef.current = f
    try {
      const im = await muatImej(f)
      setImej(im)
    } catch {
      setRalat('Gagal baca gambar itu. Cuba gambar lain.')
    }
  }

  // ---- video ----
  function pilihVideo(f: File | null) {
    if (!f) return
    setRalat('')
    if (f.size > 200 * 1024 * 1024) {
      setRalat('Video terlalu besar (max 200MB).')
      return
    }
    setVideoFail(f)
  }

  // ---- voice ----
  async function mulaRakam() {
    setRalat('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        setVoiceBlob(blob)
        setRakam(false)
        stream.getTracks().forEach((t) => t.stop())
      }
      mediaRecRef.current = rec
      voiceStartRef.current = Date.now()
      rec.start()
      setRakam(true)
      setVoiceBlob(null)
      setVoiceSaat(0)
      voiceTimerRef.current = window.setInterval(() => {
        const el = Math.floor((Date.now() - voiceStartRef.current) / 1000)
        setVoiceSaat(el)
        if (el >= VOICE_MAX_SAAT) berhentiRakam()
      }, 200)
    } catch {
      setRalat('Mikrofon tak boleh diakses. Benarkan akses mikrofon dulu.')
    }
  }

  function berhentiRakam() {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current)
      voiceTimerRef.current = null
    }
    const rec = mediaRecRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }

  // ---- daftar tetamu ----
  async function masuk() {
    if (nama.trim().length < 2) {
      setRalat('Isi nama dulu ya.')
      return
    }
    setSibuk(true)
    setRalat('')
    try {
      const s = (await rpc('alunara_guestbook_join', {
        p_code: kodAtas,
        p_name: nama.trim(),
        p_wish: ucapan.trim() || null,
      })) as string
      setSesi(s)
      try {
        localStorage.setItem(SESI_KEY, JSON.stringify({ kod: kodAtas, sesi: s, nama: nama.trim() }))
      } catch {
        /* mode private */
      }
    } catch (e) {
      setRalat(e instanceof Error ? e.message : 'Gagal masuk')
    } finally {
      setSibuk(false)
    }
  }

  // ---- simpan foto ----
  async function simpanFoto() {
    const f = failRef.current
    if (!f || !sesi) return
    setSibuk(true)
    setRalat('')
    try {
      const r1 = await fetch('/api/guestbook-sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'upload', session: sesi, nama: f.name }),
      })
      const j1 = await r1.json()
      if (!r1.ok) throw new Error(j1.ralat || 'Gagal minta kebenaran')

      let blob: Blob
      if (webglSedia && imej && rendererRef.current) {
        const { w, h } = saizMuatTurun(imej.naturalWidth, imej.naturalHeight)
        const out = document.createElement('canvas')
        out.width = w
        out.height = h
        const or = ciptaRenderer(out)
        if (or) {
          or.lukis(imej, cariStock(stockPilih), keamatan)
          blob = await canvasKeBlob(out)
          or.buang()
        } else {
          blob = f
        }
      } else {
        blob = f
      }

      const r2 = await fetch(j1.url, {
        method: 'PUT',
        headers: { 'content-type': 'image/jpeg', 'x-upsert': 'false' },
        body: blob,
      })
      if (!r2.ok) throw new Error('Muat naik gagal. Periksa internet, cuba lagi.')

      if (isV2) {
        await rpc('alunara_gb_add_media', {
          p_session: sesi,
          p_storage_path: j1.laluan,
          p_media_type: 'photo',
          p_mime_type: 'image/jpeg',
          p_width: webglSedia ? saizMuatTurun(imej?.naturalWidth ?? 0, imej?.naturalHeight ?? 0).w : null,
          p_height: webglSedia ? saizMuatTurun(imej?.naturalWidth ?? 0, imej?.naturalHeight ?? 0).h : null,
          p_bytes: blob.size,
          p_stock: webglSedia ? stockPilih : 'none',
          p_strength: webglSedia ? keamatan : 1,
        })
      } else {
        await rpc('alunara_guestbook_add_photo', {
          p_session: sesi,
          p_storage_path: j1.laluan,
          p_width: webglSedia ? saizMuatTurun(imej?.naturalWidth ?? 0, imej?.naturalHeight ?? 0).w : null,
          p_height: webglSedia ? saizMuatTurun(imej?.naturalWidth ?? 0, imej?.naturalHeight ?? 0).h : null,
          p_bytes: blob.size,
          p_stock: webglSedia ? stockPilih : 'none',
          p_strength: webglSedia ? keamatan : 1,
        })
      }

      setImej(null)
      failRef.current = null
      const inp = document.getElementById('bt-fail') as HTMLInputElement | null
      if (inp) inp.value = ''
      await muatGaleri()
    } catch (e) {
      setRalat(e instanceof Error ? e.message : 'Gagal simpan gambar')
    } finally {
      setSibuk(false)
    }
  }

  // ---- simpan video ----
  async function simpanVideo() {
    const f = videoFail
    if (!f || !sesi) return
    setSibuk(true)
    setRalat('')
    try {
      const r1 = await fetch('/api/guestbook-sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'upload', session: sesi, nama: f.name }),
      })
      const j1 = await r1.json()
      if (!r1.ok) throw new Error(j1.ralat || 'Gagal minta kebenaran')

      const r2 = await fetch(j1.url, {
        method: 'PUT',
        headers: { 'content-type': f.type || 'video/mp4', 'x-upsert': 'false' },
        body: f,
      })
      if (!r2.ok) throw new Error('Muat naik gagal. Periksa internet, cuba lagi.')

      if (isV2) {
        await rpc('alunara_gb_add_media', {
          p_session: sesi,
          p_storage_path: j1.laluan,
          p_media_type: 'video',
          p_mime_type: f.type || 'video/mp4',
          p_bytes: f.size,
          p_duration_sec: await ukurDurasi(f),
        })
      }

      setVideoFail(null)
      setTab('foto')
      const inp = document.getElementById('bt-video') as HTMLInputElement | null
      if (inp) inp.value = ''
      await muatGaleri()
    } catch (e) {
      setRalat(e instanceof Error ? e.message : 'Gagal simpan video')
    } finally {
      setSibuk(false)
    }
  }

  // ---- simpan voice ----
  async function simpanVoice() {
    const blob = voiceBlob
    if (!blob || !sesi) return
    setSibuk(true)
    setRalat('')
    try {
      const r1 = await fetch('/api/guestbook-sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'upload', session: sesi, nama: 'voice-note' }),
      })
      const j1 = await r1.json()
      if (!r1.ok) throw new Error(j1.ralat || 'Gagal minta kebenaran')

      const r2 = await fetch(j1.url, {
        method: 'PUT',
        headers: { 'content-type': blob.type || 'audio/webm', 'x-upsert': 'false' },
        body: blob,
      })
      if (!r2.ok) throw new Error('Muat naik gagal. Periksa internet, cuba lagi.')

      if (isV2) {
        await rpc('alunara_gb_add_media', {
          p_session: sesi,
          p_storage_path: j1.laluan,
          p_media_type: 'voice',
          p_mime_type: blob.type || 'audio/webm',
          p_bytes: blob.size,
          p_duration_sec: voiceSaat,
        })
      }

      setVoiceBlob(null)
      setVoiceSaat(0)
      setTab('foto')
      await muatGaleri()
    } catch (e) {
      setRalat(e instanceof Error ? e.message : 'Gagal simpan nota suara')
    } finally {
      setSibuk(false)
    }
  }

  function ukurDurasi(f: File): Promise<number | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(f)
      const el = document.createElement('video')
      el.preload = 'metadata'
      el.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        resolve(isFinite(el.duration) ? Math.round(el.duration) : null)
      }
      el.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
      el.src = url
    })
  }

  // ---- paparan ----
  const bolehUpload = isV2
    ? (info?.boleh_upload ?? false) && !!sesi
    : (maklumatV1?.boleh_upload ?? false) && !!sesi

  const tajuk = isV2 ? info?.title : maklumatV1?.event_title
  const hostNama = isV2 ? info?.nickname : maklumatV1?.host_name
  const welcomeLabel = info?.welcome_label || 'Kenalkan diri dulu'
  const welcomeMsg = info?.welcome_message
  const jumlah = isV2 ? media.length : gambarV1.length

  if (mula) {
    return <div className="bt-kulit"><p className="bt-info">Memuatkan…</p></div>
  }

  if (!info && !maklumatV1) {
    return (
      <div className="bt-kulit">
        <div className="bt-kad">
          <h1>Kod tak dijumpai</h1>
          <p className="bt-info">
            Kod <strong>{kodAtas}</strong> tak sah atau majlis dah tamat. Minta tuan rumah
            tunjuk QR semula.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bt-kulit">
      <header className="bt-kepala">
        <p className="bt-eyebrow">Buku Tamu</p>
        <h1>{tajuk}</h1>
        {hostNama && <p className="bt-info">Majlis {hostNama}</p>}
        {welcomeMsg && <p className="bt-info bt-welcome">{welcomeMsg}</p>}
        <p className="bt-info bt-info--kecil">
          {jumlah} kenangan dikongsi
          {!bolehUpload && sesi && ' · tempoh muat naik dah tamat'}
        </p>
      </header>

      {!sesi && (
        <section className="bt-kad">
          <h2>{welcomeLabel}</h2>
          <p className="bt-info">Nama sahaja. Tak payah daftar akaun.</p>
          <label className="bt-medan">
            <span>Nama</span>
            <input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="cth. Aina"
              maxLength={60}
              autoComplete="name"
            />
          </label>
          <label className="bt-medan">
            <span>Ucapan atau doa (pilihan)</span>
            <textarea
              value={ucapan}
              onChange={(e) => setUcapan(e.target.value)}
              placeholder="Semoga bahagia hingga ke jannah…"
              maxLength={UCAPAN_MAX}
              rows={3}
            />
          </label>
          {ralat && <p className="bt-ralat">{ralat}</p>}
          <button className="bt-btn" onClick={masuk} disabled={sibuk || !(isV2 ? info?.boleh_upload : maklumatV1?.boleh_upload)}>
            {sibuk ? 'Sebentar…' : 'Masuk'}
          </button>
        </section>
      )}

      {sesi && bolehUpload && (
        <section className="bt-kad">
          <h2>Kongsi kenangan</h2>

          {/* Tab media */}
          <div className="bt-tab">
            <button
              className={'bt-tab-btn' + (tab === 'foto' ? ' bt-tab-btn--aktif' : '')}
              onClick={() => setTab('foto')}
            >
              📷 Foto
            </button>
            {isV2 && (
              <button
                className={'bt-tab-btn' + (tab === 'video' ? ' bt-tab-btn--aktif' : '')}
                onClick={() => setTab('video')}
              >
                🎥 Video
              </button>
            )}
            {isV2 && (
              <button
                className={'bt-tab-btn' + (tab === 'voice' ? ' bt-tab-btn--aktif' : '')}
                onClick={() => setTab('voice')}
              >
                🎙️ Suara
              </button>
            )}
          </div>

          {/* --- FOTO --- */}
          {tab === 'foto' && (
            <>
              {!imej ? (
                <>
                  <input
                    id="bt-fail"
                    className="bt-fail"
                    type="file"
                    accept="image/*"
                    onChange={(e) => void pilihFail(e.target.files?.[0] ?? null)}
                  />
                  <label htmlFor="bt-fail" className="bt-btn bt-btn--pilih">
                    Pilih gambar
                  </label>
                </>
              ) : (
                <>
                  <div className="bt-preview">
                    <canvas ref={canvasRef} />
                  </div>
                  {webglSedia ? (
                    <>
                      <p className="bt-label">Pilih warna</p>
                      <div className="bt-chips">
                        {stockTersedia.map((s) => (
                          <button
                            key={s.id}
                            className={'bt-chip' + (stockPilih === s.id ? ' bt-chip--aktif' : '')}
                            onClick={() => setStockPilih(s.id)}
                            title={s.nota}
                          >
                            {s.pendek}
                          </button>
                        ))}
                      </div>
                      <p className="bt-nota">{cariStock(stockPilih).nota}</p>
                      <label className="bt-medan bt-medan--julat">
                        <span>Kekuatan</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round(keamatan * 100)}
                          onChange={(e) => setKeamatan(Number(e.target.value) / 100)}
                        />
                      </label>
                    </>
                  ) : (
                    <p className="bt-info bt-info--kecil">
                      Telefon ini tak sokong pratonton warna. Gambar tetap boleh dikongsi.
                    </p>
                  )}
                  <div className="bt-tindakan">
                    <button className="bt-btn" onClick={simpanFoto} disabled={sibuk}>
                      {sibuk ? 'Menghantar…' : 'Kongsi gambar'}
                    </button>
                    <button
                      className="bt-btn bt-btn--halus"
                      onClick={() => {
                        setImej(null)
                        failRef.current = null
                        const inp = document.getElementById('bt-fail') as HTMLInputElement | null
                        if (inp) inp.value = ''
                      }}
                      disabled={sibuk}
                    >
                      Batal
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* --- VIDEO --- */}
          {isV2 && tab === 'video' && (
            <>
              {!videoFail ? (
                <>
                  <input
                    id="bt-video"
                    className="bt-fail"
                    type="file"
                    accept="video/*"
                    onChange={(e) => void pilihVideo(e.target.files?.[0] ?? null)}
                  />
                  <label htmlFor="bt-video" className="bt-btn bt-btn--pilih">
                    Pilih video
                  </label>
                  <p className="bt-info bt-info--kecil">Maksimum 3 minit.</p>
                </>
              ) : (
                <>
                  <p className="bt-info bt-info--kecil">{videoFail.name}</p>
                  <div className="bt-tindakan">
                    <button className="bt-btn" onClick={simpanVideo} disabled={sibuk}>
                      {sibuk ? 'Menghantar…' : 'Kongsi video'}
                    </button>
                    <button
                      className="bt-btn bt-btn--halus"
                      onClick={() => {
                        setVideoFail(null)
                        const inp = document.getElementById('bt-video') as HTMLInputElement | null
                        if (inp) inp.value = ''
                      }}
                      disabled={sibuk}
                    >
                      Batal
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* --- VOICE --- */}
          {isV2 && tab === 'voice' && (
            <div className="bt-voice">
              {!rakam && !voiceBlob && (
                <button className="bt-btn bt-btn--pilih" onClick={mulaRakam} disabled={sibuk}>
                  🎙️ Rakam nota suara
                </button>
              )}
              {rakam && (
                <>
                  <p className="bt-voice-masa">
                    Merakam… {voiceSaat}s / {VOICE_MAX_SAAT}s
                  </p>
                  <button className="bt-btn" onClick={berhentiRakam} disabled={sibuk}>
                    ⏹ Berhenti
                  </button>
                </>
              )}
              {voiceBlob && !rakam && (
                <>
                  <p className="bt-info bt-info--kecil">
                    Nota suara siap ({voiceSaat}s). Dengar dulu:
                  </p>
                  <audio controls src={URL.createObjectURL(voiceBlob)} />
                  <div className="bt-tindakan">
                    <button className="bt-btn" onClick={simpanVoice} disabled={sibuk}>
                      {sibuk ? 'Menghantar…' : 'Kongsi suara'}
                    </button>
                    <button
                      className="bt-btn bt-btn--halus"
                      onClick={() => {
                        setVoiceBlob(null)
                        setVoiceSaat(0)
                      }}
                      disabled={sibuk}
                    >
                      Rakam semula
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {ralat && <p className="bt-ralat">{ralat}</p>}
        </section>
      )}

      {sesi && !(isV2 ? info?.boleh_upload : maklumatV1?.boleh_upload) && (
        <p className="bt-info">Tempoh muat naik majlis ini dah tamat. Kenangan lama masih boleh dilihat.</p>
      )}

      {/* ---------- galeri + filter ---------- */}
      <section className="bt-galeri">
        <div className="bt-galeri-kepala">
          <h2>Galeri majlis</h2>
          {media.some((m) => m.media_type === 'photo') && (
            <button className="bt-btn bt-btn--halus bt-btn--sm" onClick={() => { setSlaid(true); setSlaidIdx(0) }}>
              ▶ Tayang (slideshow)
            </button>
          )}
        </div>

        <div className="bt-filter">
          {MEDIA_FILTER.map((f) => (
            <button
              key={f}
              className={'bt-chip' + (filterMedia === f ? ' bt-chip--aktif' : '')}
              onClick={() => setFilterMedia(f)}
            >
              {LABEL_MEDIA[f]}
            </button>
          ))}
        </div>

        {isV2 && subEvents.length > 1 && (
          <div className="bt-filter">
            <button
              className={'bt-chip' + (filterEvent === 'semua' ? ' bt-chip--aktif' : '')}
              onClick={() => setFilterEvent('semua')}
            >
              Semua majlis
            </button>
            {subEvents.map((e) => (
              <button
                key={e.event_id}
                className={'bt-chip' + (filterEvent === e.event_type ? ' bt-chip--aktif' : '')}
                onClick={() => setFilterEvent(e.event_type)}
              >
                {e.label || e.event_type}
              </button>
            ))}
          </div>
        )}

        {/* --- v2 grid --- */}
        {isV2 && (
          <>
            {!media.length && <p className="bt-info">Belum ada kenangan. Jadi yang pertama.</p>}
            <div className="bt-grid">
              {media.map((m) => {
                const url = urlPeta[m.storage_path]
                return (
                  <figure key={m.id} className="bt-kotak">
                    {url ? (
                      m.media_type === 'photo' ? (
                        <button
                          className="bt-kotak-btn"
                          onClick={() => setZoom({ id: m.id, storage_path: m.storage_path, stock: m.stock, nama_awal: m.nama_awal, wish: m.wish, created_at: m.created_at })}
                          aria-label={`Besarkan gambar dari ${m.nama_awal}`}
                        >
                          <img src={url} alt={`Gambar dari ${m.nama_awal}`} loading="lazy" />
                        </button>
                      ) : m.media_type === 'video' ? (
                        <video src={url} controls preload="metadata" className="bt-media-video" />
                      ) : (
                        <div className="bt-media-voice">
                          <audio src={url} controls preload="metadata" />
                          <span className="bt-info bt-info--kecil">Nota suara · {m.duration_sec ?? '?'}s</span>
                        </div>
                      )
                    ) : (
                      <div className="bt-tunggu" />
                    )}
                    <figcaption>
                      <strong>{m.nama_awal}</strong>
                      {m.media_type !== 'photo' && <em> · {LABEL_MEDIA[m.media_type as MediaFilter]}</em>}
                      {m.stock !== 'none' && m.media_type === 'photo' && <em> · {cariStock(m.stock).pendek}</em>}
                      {m.wish && <span className="bt-ucapan">{m.wish}</span>}
                    </figcaption>
                  </figure>
                )
              })}
            </div>
          </>
        )}

        {/* --- v1 grid --- */}
        {!isV2 && (
          <>
            {!gambarV1.length && <p className="bt-info">Belum ada gambar. Jadi yang pertama.</p>}
            <div className="bt-grid">
              {gambarV1.map((g) => {
                const url = urlPeta[g.storage_path]
                return (
                  <figure key={g.id} className="bt-kotak">
                    {url ? (
                      <button
                        className="bt-kotak-btn"
                        onClick={() => setZoom(g)}
                        aria-label={`Besarkan gambar dari ${g.nama_awal}`}
                      >
                        <img src={url} alt={`Gambar dari ${g.nama_awal}`} loading="lazy" />
                      </button>
                    ) : (
                      <div className="bt-tunggu" />
                    )}
                    <figcaption>
                      <strong>{g.nama_awal}</strong>
                      {g.stock !== 'none' && <em> · {cariStock(g.stock).pendek}</em>}
                      {g.wish && <span className="bt-ucapan">{g.wish}</span>}
                    </figcaption>
                  </figure>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* Lightbox (foto sahaja) */}
      {zoom && urlPeta[zoom.storage_path] && (
        <div
          className="bt-zoom"
          role="dialog"
          aria-modal="true"
          aria-label="Gambar besar"
          onClick={() => setZoom(null)}
        >
          <button className="bt-zoom-tutup" aria-label="Tutup" onClick={() => setZoom(null)}>
            ✕
          </button>
          <img src={urlPeta[zoom.storage_path]} alt={`Gambar dari ${zoom.nama_awal}`} />
          <div className="bt-zoom-kapsyen">
            <strong>{zoom.nama_awal}</strong>
            {zoom.stock !== 'none' && <em> · {cariStock(zoom.stock).pendek}</em>}
            {zoom.wish && <span className="bt-ucapan">{zoom.wish}</span>}
          </div>
        </div>
      )}

      {/* Slideshow — tayangan penuh skrin untuk hall/TV */}
      {slaid && (() => {
        const senarai = media.filter((m) => m.media_type === 'photo')
        const aktif = senarai[slaidIdx % (senarai.length || 1)]
        return (
          <div className="bt-slaid" role="dialog" aria-modal="true" aria-label="Slideshow">
            <button className="bt-slaid-tutup" aria-label="Tutup" onClick={() => setSlaid(false)}>
              ✕
            </button>
            {aktif && urlPeta[aktif.storage_path] ? (
              <img src={urlPeta[aktif.storage_path]} alt={`Gambar dari ${aktif.nama_awal}`} className="bt-slaid-img" />
            ) : (
              <p className="bt-info">Tiada gambar untuk ditayang.</p>
            )}
            {aktif && (
              <div className="bt-slaid-kapsyen">
                <strong>{aktif.nama_awal}</strong>
                {aktif.wish && <span className="bt-ucapan">{aktif.wish}</span>}
              </div>
            )}
          </div>
        )
      })()}

      <footer className="bt-kaki">
        <p>Buku tamu oleh ALUNARA</p>
      </footer>
    </div>
  )
}
