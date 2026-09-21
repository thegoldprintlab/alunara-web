import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CHECKLIST,
  CHECKLIST_META,
  CHECKLIST_COUNTDOWN,
  waLink,
  MSG,
} from '../content'
import CtaBand from '../components/CtaBand'
import MuatGate from '../components/MuatGate'
import KunciKandungan from '../components/KunciKandungan'
import { IconCheck, IconArrow, IconWhatsApp, IconSparkle, IconPlus, IconMinus } from '../components/Icons'

/**
 * Halaman /checklist — senarai semak pelan majlis (Birthday / Tunang / Kenduri).
 *
 * Satu halaman khas supaya senang promote di bio IG/TikTok: satu link,
 * tiga checklist, boleh tanda terus dalam browser (disimpan dalam localStorage),
 * plus butang muat turun PDF (via MuatGate → lead ke Telegram bos).
 *
 * Kandungan datang dari CHECKLIST_META / CHECKLIST_COUNTDOWN dalam content.ts.
 *
 * KANDUNGAN BERGATE: hanya 3 langkah pertama dipapar percuma. Selebihnya
 * dikunci di sebalik borang 2 medan (KunciKandungan). Kalau senarai penuh
 * terpampang, orang baca je dan tak perlu bagi nombor — lead magnet bocor.
 */

/** Kunci localStorage supaya tanda awak kekal bila balik semula. */
function kunciTanda(id: string) {
  return `alunara:checklist:${id}`
}

/** Kunci localStorage — sudah buka kandungan checklist ni. */
function kunciBuka(id: string) {
  return `alunara:checklist:buka:${id}`
}

/** Berapa langkah dipapar sebelum kunci. */
const LANGKAH_PERCUMA = 3

function bacaTanda(id: string): string[] {
  try {
    const mentah = localStorage.getItem(kunciTanda(id))
    return mentah ? (JSON.parse(mentah) as string[]) : []
  } catch {
    return []
  }
}

function sudahBuka(id: string): boolean {
  try {
    return localStorage.getItem(kunciBuka(id)) !== null
  } catch {
    return false
  }
}

export default function Checklist() {
  const [aktifId, setAktifId] = useState(CHECKLIST_META[0].id)
  const [tanda, setTanda] = useState<string[]>(() => bacaTanda(CHECKLIST_META[0].id))
  const [bukaCountdown, setBukaCountdown] = useState(false)
  const [terbuka, setTerbuka] = useState<boolean>(() => sudahBuka(CHECKLIST_META[0].id))

  const aktif = useMemo(
    () => CHECKLIST_META.find((c) => c.id === aktifId) ?? CHECKLIST_META[0],
    [aktifId],
  )

  // Bila tukar jenis majlis, muat semula tanda + status buka dari simpanan.
  useEffect(() => {
    setTanda(bacaTanda(aktif.id))
    setTerbuka(sudahBuka(aktif.id))
  }, [aktif.id])

  function simpan(id: string, senarai: string[]) {
    try {
      localStorage.setItem(kunciTanda(id), JSON.stringify(senarai))
    } catch {
      /* mod private / storage penuh — tanda hilang bila refresh, bukan isu besar */
    }
  }

  function toggle(langkah: string) {
    setTanda((lama) => {
      const baru = lama.includes(langkah) ? lama.filter((x) => x !== langkah) : [...lama, langkah]
      simpan(aktif.id, baru)
      return baru
    })
  }

  function reset() {
    setTanda([])
    simpan(aktif.id, [])
  }

  function bukaKunci() {
    try {
      localStorage.setItem(kunciBuka(aktif.id), new Date().toISOString())
    } catch {
      /* gagal simpan pun tak apa — kandungan tetap terbuka sesi ini */
    }
    setTerbuka(true)
  }

  const jumlah = aktif.langkah.length
  const dilihat = terbuka ? aktif.langkah : aktif.langkah.slice(0, LANGKAH_PERCUMA)
  const siap = tanda.length
  const peratus = jumlah ? Math.round((siap / jumlah) * 100) : 0
  const pdf = CHECKLIST.find((c) => aktif.nama.endsWith(c.nama))

  return (
    <>
      <section className="page section">
        <div className="container">
          <div className="page__head">
            <div className="eyebrow">Percuma · 3 langkah pertama terbuka</div>
            <h1>Checklist pelan majlis</h1>
            <hr className="divider" />
            <p className="lead">
              Tiga senarai semak siap susun ikut urutan — birthday, tunang dan kenduri. Tiga
              langkah pertama terbuka terus; isi nama &amp; no. WhatsApp untuk buka semua.
              Boleh tanda satu-satu dalam browser (auto simpan), atau muat turun versi PDF.
            </p>
          </div>

          {/* ------------------------------ TAB ------------------------------ */}
          <div className="ck-tabs" role="tablist" aria-label="Jenis majlis">
            {CHECKLIST_META.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={c.id === aktif.id}
                aria-controls={`ck-panel-${c.id}`}
                className={'ck-tab' + (c.id === aktif.id ? ' ck-tab--on' : '')}
                onClick={() => setAktifId(c.id)}
              >
                <span className="ck-tab__nama">{c.nama.replace('Checklist ', '')}</span>
                <span className="ck-tab__sub">{c.sub}</span>
              </button>
            ))}
          </div>

          {/* ----------------------------- PANEL ----------------------------- */}
          <div className="ck" id={`ck-panel-${aktif.id}`} role="tabpanel">
            <div className="ck__main">
              <header className="ck__head">
                <div>
                  <h2>{aktif.nama}</h2>
                  <p className="muted ck__sesuai">{aktif.sesuai}</p>
                </div>
                <div className="ck__tema">
                  <span className="ck__tema-lab">Tema padan</span>
                  <Link to={`/tema/${aktif.temaId}`} className="ck__tema-link">
                    {aktif.temaNama} <IconArrow />
                  </Link>
                </div>
              </header>

              <p className="ck__lede">{aktif.lede}</p>

              {/* Progress hanya bermakna bila pelawat dah buka kunci — jangan
                  dedah jumlah sebenar sebagai tekanan tak perlu pada yang belum isi borang. */}
              {terbuka && (
                <div className="ck__prog-wrap">
                  <div className="ck__prog-top">
                    <span>
                      <strong>{siap}</strong> / {jumlah} selesai
                    </span>
                    {siap > 0 && (
                      <button type="button" className="ck__reset" onClick={reset}>
                        Kosongkan tanda
                      </button>
                    )}
                  </div>
                  <div
                    className="ck__prog"
                    role="progressbar"
                    aria-valuenow={peratus}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Kemajuan checklist"
                  >
                    <span className="ck__prog-bar" style={{ width: `${peratus}%` }} />
                  </div>
                </div>
              )}

              <ul className="ck__list">
                {dilihat.map((l, i) => {
                  const ok = tanda.includes(l)
                  return (
                    <li key={l}>
                      <label className={'ck__item' + (ok ? ' ck__item--ok' : '')}>
                        <input
                          type="checkbox"
                          checked={ok}
                          onChange={() => toggle(l)}
                          className="ck__box"
                        />
                        <span className="ck__tick" aria-hidden="true">
                          <IconCheck />
                        </span>
                        <span className="ck__no">{String(i + 1).padStart(2, '0')}</span>
                        <span className="ck__tx">{l}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>

              {!terbuka && (
                <KunciKandungan
                  nama={aktif.nama}
                  percuma={LANGKAH_PERCUMA}
                  jumlah={jumlah}
                  onBuka={bukaKunci}
                />
              )}

              {terbuka && (
                <div className="ck__tip">
                  <div className="ck__tip-lab">
                    <IconSparkle /> Tip ALUNARA
                  </div>
                  <p>{aktif.tip}</p>
                </div>
              )}
            </div>

            {/* ---------------------------- SIDEBAR ---------------------------- */}
            <aside className="ck__side">
              <div className="ck__card">
                <div className="eyebrow">Simpan &amp; tunjuk</div>
                <h3>Muat turun {aktif.nama} (PDF)</h3>
                <p className="muted ck__card-ayat">
                  4 muka surat — senarai semak, countdown, dan ruang butiran majlis. Senang
                  tunjuk pada pasangan atau orang rumah.
                </p>
                {pdf && (
                  <MuatGate
                    senarai={[pdf]}
                    jenis="checklist"
                    eyebrow="Checklist Percuma"
                    meta={() => 'PDF · 4 muka'}
                  />
                )}
                <p className="ck__nota">
                  Data yang awak isi (nama, no. WA, tarikh) dipakai untuk semak tarikh kosong
                  sahaja — bukan untuk spam.
                </p>
              </div>

              <div className="ck__card ck__card--dark">
                <div className="eyebrow">Jangan tunggu hari H</div>
                <h3>Satu tarikh, satu majlis</h3>
                <p>
                  Kami cuma ada 3 meja &amp; 18 kerusi. Tarikh dikunci oleh pelanggan yang
                  menjelaskan deposit <strong>RM50</strong> dulu.
                </p>
                <Link to="/tempah" className="btn btn--gold btn--block">
                  Semak Tarikh Kosong <IconArrow />
                </Link>
                <a
                  className="btn btn--outline-cream btn--block"
                  href={waLink(MSG.checklist + aktif.nama.replace('Checklist ', ''))}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <IconWhatsApp /> WhatsApp {aktif.nama.replace('Checklist ', '')}
                </a>
              </div>

              {terbuka && (
                <div className="ck__card">
                  <div className="eyebrow">Apa ada dalam senarai</div>
                  <p className="muted ck__card-ayat">{aktif.ada}</p>
                  <Link to="/pakej" className="ck__link">
                    Lihat pakej &amp; harga <IconArrow />
                  </Link>
                  <Link to="/galeri" className="ck__link">
                    Tengok setup sebenar <IconArrow />
                  </Link>
                </div>
              )}
            </aside>
          </div>

          {/* ---------------------------- COUNTDOWN --------------------------- */}
          <div className="ck-cd">
            <button
              type="button"
              className="ck-cd__toggle"
              onClick={() => setBukaCountdown((v) => !v)}
              aria-expanded={bukaCountdown}
            >
              <span>
                <strong>Countdown majlis</strong> — apa nak buat 4 minggu sebelum
              </span>
              {bukaCountdown ? <IconMinus /> : <IconPlus />}
            </button>
            {bukaCountdown && (
              <ol className="ck-cd__list">
                {CHECKLIST_COUNTDOWN.map((c, i) => (
                  <li key={i} className="ck-cd__row">
                    <span className="ck-cd__n">{c.n}</span>
                    <span className="ck-cd__bila">{c.bila}</span>
                    <span className="ck-cd__apa">{c.apa}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>

      <CtaBand
        tajuk="Checklist dah siap — setup biar kami uruskan"
        ayat="Meja & kerusi bersarung bertema, meja hidangan percuma, hantar dan pasang sebelum tetamu tiba."
        btnText="Semak Tarikh Kosong"
      />
    </>
  )
}
