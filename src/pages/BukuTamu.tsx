/**
 * Buku Tamu ALUNARA — halaman tetamu.
 *
 * Aliran:
 *   1. Buka /buku-tamu/:kod (dari QR atau link)
 *   2. Isi nama (+ ucapan) → dapat sesi
 *   3. Ambil gambar → pilih film stock → simpan
 *   4. Gambar muncul dalam galeri untuk semua tetamu
 *
 * KEPUTUSAN REKA BENTUK
 *   * Tiada log masuk. Tetamu scan QR, terus guna. Setiap halangan tambahan
 *     mengurangkan bilangan gambar yang masuk — dan itu nilai produk ini.
 *   * Sesi disimpan dalam localStorage, jadi refresh tak hilang nama.
 *   * Preview guna WebGL pada canvas yang SAMA dengan yang dihantar, jadi
 *     apa tetamu nampak = apa yang disimpan. Tiada kejutan.
 *   * Kalau peranti tak sokong WebGL, gambar tetap boleh dihantar tanpa
 *     filter. Jangan halang tetamu sebab telefon lama.
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

/** Panggil RPC awam. anon key memang awam — RLS + semakan dalam fungsi yang jaga. */
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

type Maklumat = {
  event_title: string
  host_name: string | null
  event_date: string | null
  boleh_upload: boolean
  jumlah_gambar: number
  stocks: string[] | null
}

type Gambar = {
  id: string
  storage_path: string
  stock: string
  nama_awal: string
  wish: string | null
  created_at: string
}

const SESI_KEY = 'alunara_bukutamu_sesi_v1'

export default function BukuTamu() {
  const { kod = '' } = useParams()
  const kodAtas = kod.toUpperCase()

  const [maklumat, setMaklumat] = useState<Maklumat | null>(null)
  const [gambar, setGambar] = useState<Gambar[]>([])
  const [urlPeta, setUrlPeta] = useState<Record<string, string>>({})
  const [nama, setNama] = useState('')
  const [ucapan, setUcapan] = useState('')
  const [sesi, setSesi] = useState<string | null>(null)
  const [stockPilih, setStockPilih] = useState(STOCK_DEFAULT)
  const [keamatan, setKeamatan] = useState(1)
  const [sibuk, setSibuk] = useState(false)
  const [ralat, setRalat] = useState('')
  const [imej, setImej] = useState<HTMLImageElement | null>(null)
  const [webglSedia, setWebglSedia] = useState(true)
  const [mula, setMula] = useState(true)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<FilmRenderer | null>(null)
  const failRef = useRef<File | null>(null)

  // ---- sesi tersimpan (refresh tak hilang nama) ----
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
      /* storage tak boleh dibaca — tetamu isi semula, bukan masalah besar */
    }
  }, [kodAtas])

  // ---- muat maklumat majlis + galeri ----
  const muatGaleri = useCallback(async () => {
    try {
      const g = (await rpc('alunara_guestbook_gallery', {
        p_code: kodAtas,
        p_limit: 300,
      })) as Gambar[]
      setGambar(g || [])
      const laluan = (g || []).map((x) => x.storage_path)
      if (laluan.length) {
        const r = await fetch('/api/guestbook-sign', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'read', laluan }),
        })
        if (r.ok) {
          const j = await r.json()
          setUrlPeta(j.urls || {})
        }
      }
    } catch {
      /* galeri gagal tak sepatutnya halang tetamu upload */
    }
  }, [kodAtas])

  useEffect(() => {
    let batal = false
    ;(async () => {
      try {
        const m = (await rpc('alunara_guestbook_info', { p_code: kodAtas })) as Maklumat[]
        if (batal) return
        if (!m?.length) {
          setRalat('Kod majlis tak dijumpai.')
        } else {
          setMaklumat(m[0])
        }
      } catch (e) {
        if (!batal) setRalat(e instanceof Error ? e.message : 'Ralat')
      } finally {
        if (!batal) setMula(false)
      }
    })()
    void muatGaleri()
    return () => {
      batal = true
    }
  }, [kodAtas, muatGaleri])

  // ---- stock yang dibenarkan untuk majlis ini ----
  const stockTersedia = useMemo(() => {
    const dibenar = maklumat?.stocks
    if (!dibenar?.length) return STOCKS
    return STOCKS.filter((s) => dibenar.includes(s.id))
  }, [maklumat])

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

  // ---- lukis semula bila imej / stock / keamatan berubah ----
  useEffect(() => {
    const r = rendererRef.current
    if (!r || !imej) return
    r.lukis(imej, cariStock(stockPilih), keamatan)
  }, [imej, stockPilih, keamatan, webglSedia])

  // ---- tetamu pilih gambar ----
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

  // ---- daftar sebagai tetamu ----
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
        /* mode private — sesi kekal dalam memori sahaja */
      }
    } catch (e) {
      setRalat(e instanceof Error ? e.message : 'Gagal masuk')
    } finally {
      setSibuk(false)
    }
  }

  // ---- simpan gambar ----
  async function simpan() {
    const f = failRef.current
    if (!f || !sesi) return
    setSibuk(true)
    setRalat('')
    try {
      // 1. minta URL muat naik. Server yang tentukan laluan.
      const r1 = await fetch('/api/guestbook-sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'upload', session: sesi, nama: f.name }),
      })
      const j1 = await r1.json()
      if (!r1.ok) throw new Error(j1.ralat || 'Gagal minta kebenaran')

      // 2. siapkan blob. Kalau WebGL ada, lukis dengan filter pada canvas
      //    output saiz penuh; kalau tak, hantar fail asal terus.
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

      // 3. muat naik
      const r2 = await fetch(j1.url, {
        method: 'PUT',
        headers: { 'content-type': 'image/jpeg', 'x-upsert': 'false' },
        body: blob,
      })
      if (!r2.ok) throw new Error('Muat naik gagal. Periksa internet, cuba lagi.')

      // 4. daftar dalam DB
      await rpc('alunara_guestbook_add_photo', {
        p_session: sesi,
        p_storage_path: j1.laluan,
        p_width: webglSedia ? saizMuatTurun(imej?.naturalWidth ?? 0, imej?.naturalHeight ?? 0).w : null,
        p_height: webglSedia ? saizMuatTurun(imej?.naturalWidth ?? 0, imej?.naturalHeight ?? 0).h : null,
        p_bytes: blob.size,
        p_stock: webglSedia ? stockPilih : 'none',
        p_strength: webglSedia ? keamatan : 1,
      })

      // 5. bersihkan + segarkan galeri
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

  // -------------------------------------------------------------- PAPARAN
  if (mula) {
    return <div className="bt-kulit"><p className="bt-info">Memuatkan…</p></div>
  }

  if (!maklumat) {
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

  const bolehUpload = maklumat.boleh_upload && !!sesi

  return (
    <div className="bt-kulit">
      <header className="bt-kepala">
        <p className="bt-eyebrow">Buku Tamu</p>
        <h1>{maklumat.event_title}</h1>
        {maklumat.host_name && <p className="bt-info">Majlis {maklumat.host_name}</p>}
        <p className="bt-info bt-info--kecil">
          {maklumat.jumlah_gambar} gambar dikongsi
          {!maklumat.boleh_upload && ' · tempoh muat naik dah tamat'}
        </p>
      </header>

      {!sesi && (
        <section className="bt-kad">
          <h2>Kenalkan diri dulu</h2>
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
              maxLength={500}
              rows={3}
            />
          </label>
          {ralat && <p className="bt-ralat">{ralat}</p>}
          <button className="bt-btn" onClick={masuk} disabled={sibuk || !maklumat.boleh_upload}>
            {sibuk ? 'Sebentar…' : 'Masuk'}
          </button>
        </section>
      )}

      {sesi && bolehUpload && (
        <section className="bt-kad">
          <h2>Kongsi gambar</h2>

          {!imej && (
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
          )}

          {imej && (
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

              {ralat && <p className="bt-ralat">{ralat}</p>}

              <div className="bt-tindakan">
                <button className="bt-btn" onClick={simpan} disabled={sibuk}>
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

          {ralat && !imej && <p className="bt-ralat">{ralat}</p>}
        </section>
      )}

      {sesi && !maklumat.boleh_upload && (
        <p className="bt-info">Tempoh muat naik majlis ini dah tamat. Gambar lama masih boleh dilihat.</p>
      )}

      <section className="bt-galeri">
        <h2>Galeri majlis</h2>
        {!gambar.length && <p className="bt-info">Belum ada gambar. Jadi yang pertama.</p>}
        <div className="bt-grid">
          {gambar.map((g) => (
            <figure key={g.id} className="bt-kotak">
              {urlPeta[g.storage_path] ? (
                <img src={urlPeta[g.storage_path]} alt={`Gambar dari ${g.nama_awal}`} loading="lazy" />
              ) : (
                <div className="bt-tunggu" />
              )}
              <figcaption>
                <strong>{g.nama_awal}</strong>
                {g.stock !== 'none' && <em> · {cariStock(g.stock).pendek}</em>}
                {g.wish && <span className="bt-ucapan">{g.wish}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <footer className="bt-kaki">
        <p>Buku tamu oleh ALUNARA</p>
      </footer>
    </div>
  )
}
