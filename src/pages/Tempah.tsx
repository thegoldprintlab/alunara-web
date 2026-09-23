import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PAKEJ, TEMA, WA_DISPLAY, waLink, cajHantarText, LOKASI, TARIKH_LOCK } from '../content'
import { tarikhSibukDariDb } from '../lib/tarikhSibuk'
import CtaBand from '../components/CtaBand'
import { IconWhatsApp, IconCheck, IconArrow } from '../components/Icons'

const HARI = ['Is', 'Se', 'Ra', 'Ka', 'Ju', 'Sa', 'Ah']
const EVENT = ['Hari Jadi', 'Kahwin / Tunang', 'Aqiqah / Cukur Jambul', 'Korporat', 'Lain-lain']

const BULAN_MS = [
  'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
  'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember',
]

/** Tarikh tempatan sebagai YYYY-MM-DD (elak masalah timezone toISOString). */
function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export default function Tempah() {
  const today = useMemo(() => new Date(), [])
  const minDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d
  }, [])

  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

  /**
   * Tarikh yang tak boleh dipilih — dua sumber:
   *   1. DB (jadual tempahan, status aktif) melalui RPC awam yang pulangkan
   *      TARIKH sahaja. Ini yang menyegerakkan admin panel dengan kalendar.
   *   2. TARIKH_LOCK dalam src/content.ts — senarai manual + sandaran kalau
   *      DB tak dapat dihubungi. Kalau DB hidup, senarai ini tetap digabung
   *      supaya tarikh yang bos dah set manual tak terbuka semula.
   */
  const [booked, setBooked] = useState<string[]>(TARIKH_LOCK)

  useEffect(() => {
    let hidup = true
    void (async () => {
      const dariDb = await tarikhSibukDariDb()
      if (!hidup || !dariDb) return
      setBooked([...new Set([...TARIKH_LOCK, ...dariDb])])
    })()
    return () => {
      hidup = false
    }
  }, [])

  const [tarikh, setTarikh] = useState('')
  const [nama, setNama] = useState('')
  const [telefon, setTelefon] = useState('')
  const [jenis, setJenis] = useState(EVENT[0])
  const [pakej, setPakej] = useState('bayu')
  const [tema, setTema] = useState(TEMA[0].nama)
  const [lokasi, setLokasi] = useState(LOKASI[0].nama)
  const [nota, setNota] = useState('')
  const [hantar, setHantar] = useState(false)

  const bookedSet = useMemo(() => new Set(booked), [booked])
  const minStr = ymd(minDate)

  const pakejPilih = PAKEJ.find((p) => p.id === pakej) ?? PAKEJ[1]
  const lokasiPilih = LOKASI.find((l) => l.nama === lokasi) ?? LOKASI[0]

  /** Bina mesej WhatsApp penuh dari borang. */
  function mesejWa(): string {
    const t = tarikh
      ? new Date(tarikh + 'T00:00:00').toLocaleDateString('ms-MY', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
      : '(belum pilih)'
    return [
      'Hi ALUNARA! Saya nak lock tarikh majlis.',
      '',
      `Tarikh: ${t}`,
      `Nama: ${nama || '-'}`,
      `No. WhatsApp: ${telefon || '-'}`,
      `Jenis majlis: ${jenis}`,
      `Pakej: ${pakejPilih.nama} (${pakejPilih.harga}) — ${pakejPilih.meja} meja, ${pakejPilih.kerusi} kerusi`,
      `Tema: ${tema}`,
      `Lokasi: ${lokasiPilih.nama} (${lokasiPilih.km} km — hantar ${cajHantarText(lokasiPilih.km)})`,
      nota ? `Nota: ${nota}` : '',
      '',
      'Boleh confirm tarikh ni masih kosong?',
    ]
      .filter(Boolean)
      .join('\n')
  }

  function pilihTarikh(d: string) {
    if (d < minStr || bookedSet.has(d)) return
    setTarikh(d)
  }

  /** Buka WhatsApp dengan butiran tempahan penuh. Tiada simpanan ke pangkalan data. */
  function keWhatsApp() {
    setHantar(true)
    window.open(waLink(mesejWa()), '_blank', 'noopener')
    setHantar(false)
  }

  // ---- grid kalendar ----
  const sel = useMemo(() => {
    const tahun = view.getFullYear()
    const bulan = view.getMonth()
    const pertama = new Date(tahun, bulan, 1)
    const hariDlmBulan = new Date(tahun, bulan + 1, 0).getDate()
    // Isnin = 0
    const offset = (pertama.getDay() + 6) % 7
    const cells: { d: string; num: number; luar: boolean }[] = []
    for (let i = 0; i < offset; i++) {
      const dt = new Date(tahun, bulan, -offset + i + 1)
      cells.push({ d: ymd(dt), num: dt.getDate(), luar: true })
    }
    for (let n = 1; n <= hariDlmBulan; n++) {
      const dt = new Date(tahun, bulan, n)
      cells.push({ d: ymd(dt), num: n, luar: false })
    }
    while (cells.length % 7 !== 0) {
      const dt = new Date(tahun, bulan + 1, cells.length - offset - hariDlmBulan + 1)
      cells.push({ d: ymd(dt), num: dt.getDate(), luar: true })
    }
    return cells
  }, [view])

  const bolehUndur = view > new Date(today.getFullYear(), today.getMonth(), 1)
  const bolehMaju = view < new Date(today.getFullYear(), today.getMonth() + 4, 1)
  const tarikhSedia = Boolean(tarikh && nama && telefon)

  return (
    <>
      <section className="page section">
        <div className="container">
          <div className="page__head">
            <div className="eyebrow">Tempahan</div>
            <h1>Semak tarikh, lock tarikh awak</h1>
            <hr className="divider" />
            <p className="lead">
              Kami ada 3 meja &amp; 18 kerusi sahaja. Bila satu tarikh dah diambil, memang tiada
              lagi — jadi semak awal.
            </p>
          </div>

          <div className="tempah-grid">
            {/* ---------------------------- KALENDAR --------------------------- */}
            <div className="kal">
              <div className="kal__head">
                <button
                  type="button"
                  className="kal__nav"
                  onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
                  disabled={!bolehUndur}
                  aria-label="Bulan sebelumnya"
                >
                  <IconArrow className="flip-x" />
                </button>
                <div className="kal__title">
                  {BULAN_MS[view.getMonth()]} {view.getFullYear()}
                </div>
                <button
                  type="button"
                  className="kal__nav kal__nav--next"
                  onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
                  disabled={!bolehMaju}
                  aria-label="Bulan seterusnya"
                >
                  <IconArrow />
                </button>
              </div>

              <div className="kal__legend">
                <span><i className="dot dot--free" /> Kosong</span>
                <span><i className="dot dot--taken" /> Sudah ditempah</span>
                <span><i className="dot dot--pick" /> Pilihan awak</span>
              </div>

              <div className="kal__grid" role="grid" aria-label="Kalendar tarikh majlis">
                {HARI.map((h) => (
                  <div className="kal__dow" key={h} role="columnheader">
                    {h}
                  </div>
                ))}
                {sel.map((c) => {
                  const lepas = c.d < minStr
                  const penuh = bookedSet.has(c.d)
                  const pilih = c.d === tarikh
                  const kelas =
                    'kal__cell' +
                    (c.luar ? ' kal__cell--luar' : '') +
                    (lepas ? ' kal__cell--luar' : '') +
                    (penuh ? ' kal__cell--penuh' : '') +
                    (pilih ? ' kal__cell--pilih' : '')
                  return (
                    <button
                      type="button"
                      key={c.d}
                      className={kelas}
                      data-tarikh={c.d}
                      onClick={() => pilihTarikh(c.d)}
                      disabled={lepas || penuh}
                      aria-label={`${c.num}${penuh ? ' — sudah ditempah' : lepas ? ' — tarikh terlalu dekat' : ''}`}
                    >
                      {c.num}
                    </button>
                  )
                })}
              </div>

              <p className="kal__note">
                Kalendar ini untuk rujukan. Tarikh sebenar disahkan oleh kami di WhatsApp —
                kami hanya ada 3 meja &amp; 18 kerusi, jadi satu tarikh satu majlis.
              </p>
              <p className="kal__note">
                Tarikh yang sudah di-lock (deposit diterima) bertanda kelabu dan tak boleh
                dipilih. Senarai tarikh ini disegerakkan dari panel admin.
              </p>
            </div>

            {/* ----------------------------- BORANG ---------------------------- */}
            <div className="borang">
              <h2 className="borang__title">
                {tarikh ? (
                  <>
                    <IconCheck className="borang__tick" /> {new Date(tarikh + 'T00:00:00').toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </>
                ) : (
                  'Pilih tarikh di kalendar dulu'
                )}
              </h2>

              {!tarikh && (
                <p className="muted borang__hint">
                  Kalau tarikh awak belum pasti, WhatsApp sahaja — kami boleh tahan tarikh untuk
                  awak sebentar.
                </p>
              )}

              <div className="borang__body" aria-hidden={!tarikh}>
                <div className="field">
                  <label htmlFor="nama">Nama</label>
                  <input
                    id="nama"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    placeholder="cth. Nurul"
                  />
                </div>
                <div className="field">
                  <label htmlFor="tel">No. WhatsApp</label>
                  <input
                    id="tel"
                    type="tel"
                    value={telefon}
                    onChange={(e) => setTelefon(e.target.value)}
                    placeholder="cth. 012-3456789"
                  />
                </div>
                <div className="borang__row">
                  <div className="field">
                    <label htmlFor="jenis">Jenis majlis</label>
                    <select id="jenis" value={jenis} onChange={(e) => setJenis(e.target.value)}>
                      {EVENT.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="pakej">Pakej</label>
                    <select id="pakej" value={pakej} onChange={(e) => setPakej(e.target.value)}>
                      {PAKEJ.map((p) => (
                        <option key={p.id} value={p.id}>{p.nama} — {p.harga}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="borang__row">
                  <div className="field">
                    <label htmlFor="tema">Tema</label>
                    <select id="tema" value={tema} onChange={(e) => setTema(e.target.value)}>
                      {TEMA.map((t) => (
                        <option key={t.id} value={t.nama}>{t.nama}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="lokasi">Kawasan</label>
                    <select id="lokasi" value={lokasi} onChange={(e) => setLokasi(e.target.value)}>
                      {LOKASI.map((l) => (
                        <option key={l.nama} value={l.nama}>{l.nama}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="nota">Nota (pilihan)</label>
                  <textarea
                    id="nota"
                    rows={3}
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    placeholder="Jumlah tetamu, rumah luar, minta warna tertentu…"
                  />
                </div>

                <div className="borang__sum">
                  <div><span>Pakej</span><strong>{pakejPilih.nama} · {pakejPilih.harga}</strong></div>
                  <div><span>Penghantaran</span><strong>{cajHantarText(lokasiPilih.km)}</strong></div>
                  <div><span>Deposit</span><strong>RM 50</strong></div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn--wa btn--block borang__submit"
                onClick={keWhatsApp}
                disabled={!tarikhSedia || hantar}
              >
                <IconWhatsApp /> {hantar ? 'Menghantar…' : 'Hantar & Lock via WhatsApp'}
              </button>

              <p className="borang__note">
                Kami tak minta bayaran di laman ini. Butang ni akan hantar butiran awak ke
                WhatsApp {WA_DISPLAY} — deposit RM50 dibayar selepas kami confirm tarikh.
              </p>

              {!tarikh && (
                <a className="borang__skip" href={waLink('Hi ALUNARA! Saya belum pasti tarikh, tapi nak tanya pasal pakej dulu.')} target="_blank" rel="noreferrer noopener">
                  Tak pasti tarikh lagi? <span>WhatsApp terus <IconArrow /></span>
                </a>
              )}
            </div>
          </div>

          <div className="tempah-steps">
            <div className="ts"><span>1</span><p>Awak pilih tarikh &amp; isi butiran.</p></div>
            <div className="ts"><span>2</span><p>Kami confirm tarikh masih kosong.</p></div>
            <div className="ts"><span>3</span><p>Deposit RM50 untuk lock. Siap.</p></div>
          </div>

          <p className="center muted">
            Nak faham harga &amp; caj hantar dulu? <Link to="/pakej">Lihat pakej</Link> ·{' '}
            <Link to="/harga-hantar">Kira caj penghantaran</Link>
          </p>
        </div>
      </section>

      <CtaBand
        tajuk="Bukan tarikh tu?"
        ayat="Kalau tarikh pilihan awak dah penuh, kami boleh cadangkan tarikh berdekatan yang masih kosong."
        btnText="Tanya Tarikh Lain"
        to="/hubungi"
      />
    </>
  )
}
