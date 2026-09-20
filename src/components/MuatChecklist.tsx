import { useEffect, useState } from 'react'
import { IconWhatsApp, IconX, IconCheck } from './Icons'
import { hantarLead, telefonSah, hariIni, tarikhMesra } from '../lib/lead'
import { waLink } from '../content'
import './MuatChecklist.css'

export type ChecklistItem = { nama: string; fail: string; tema?: string }

type Props = {
  /** Senarai checklist yang boleh dimuat turun. */
  senarai: ChecklistItem[]
  /** Tajuk kecil di atas borang. */
  eyebrow?: string
}

/**
 * Gate muat turun checklist percuma.
 *
 * Alasan gate: bos nak no. telefon + tarikh majlis supaya boleh follow-up jadi
 * pelanggan. PDF hanya diberi SELEPAS borang diisi; butang continue-to-WhatsApp
 * disediakan supaya lead yang tak sabar pun tetap boleh hubungi kami.
 */
export default function MuatChecklist({ senarai, eyebrow = 'Checklist Percuma' }: Props) {
  const [aktif, setAktif] = useState<ChecklistItem | null>(null)
  const [nama, setNama] = useState('')
  const [telefon, setTelefon] = useState('')
  const [tarikh, setTarikh] = useState('')
  const [jenis, setJenis] = useState('Belum pasti')
  const [siap, setSiap] = useState(false)
  const [ralat, setRalat] = useState('')

  // Esc untuk tutup + kunci scroll belakang
  useEffect(() => {
    if (!aktif) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && tutup()
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.style.overflow = ''
    }
  }, [aktif])

  function tutup() {
    setAktif(null)
    setSiap(false)
    setRalat('')
    setNama('')
    setTelefon('')
    setTarikh('')
    setJenis('Belum pasti')
  }

  function hantar(e: React.FormEvent) {
    e.preventDefault()
    if (!nama.trim()) return setRalat('Nama belum diisi.')
    if (!telefonSah(telefon)) return setRalat('No. WhatsApp macam tak lengkap — cth. 012-3456789.')
    if (!tarikh) return setRalat('Tarikh majlis belum dipilih.')

    hantarLead({
      nama: nama.trim(),
      telefon: telefon.trim(),
      tarikh,
      jenis,
      checklist: aktif ? `${aktif.nama} (${aktif.tema ?? '-'})` : '-',
      asal: typeof window !== 'undefined' ? window.location.pathname : '/',
    })
    // Terus buka PDF (masih dalam gesture klik user, jadi popup blocker tak halang).
    window.open(aktif!.fail, '_blank', 'noopener')
    setRalat('')
    setSiap(true)
  }

  const waSusul = aktif
    ? waLink(
        `Hi ALUNARA! Saya ${nama || '(nama)'} — baru muat turun checklist ${aktif.nama}. ` +
          `Tarikh majlis saya ${tarikh ? tarikhMesra(tarikh) : '(belum pasti)'}. Boleh bagi quote pakej?`,
      )
    : '#'

  const hariMin = hariIni()

  return (
    <>
      <div className="katalog__files">
        {senarai.map((c) => (
          <button
            key={c.fail}
            type="button"
            className="katalog__file katalog__file--btn"
            onClick={() => {
              setAktif(c)
              setSiap(false)
              setRalat('')
            }}
          >
            <span className="katalog__file-name">Checklist {c.nama}</span>
            <span className="katalog__file-meta">{c.tema ?? 'PDF'} · muat turun</span>
          </button>
        ))}
      </div>

      {aktif && (
        <div
          className="gate"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gate-tajuk"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) tutup()
          }}
        >
          <div className="gate__box">
            <button type="button" className="gate__x" onClick={tutup} aria-label="Tutup">
              <IconX />
            </button>

            <div className="gate__head">
              <div className="eyebrow">{eyebrow}</div>
              <h2 id="gate-tajuk">
                Checklist {aktif.nama}
                {aktif.tema ? <span className="gate__tema"> · {aktif.tema}</span> : null}
              </h2>
              <hr className="divider" />
              <p className="gate__lead">
                Isi nama, no. WhatsApp dan tarikh majlis awak — PDF terus terbuka. Data ini
                kami simpan untuk semak tarikh, bukan untuk spam.
              </p>
            </div>

            {siap ? (
              <div className="gate__siap">
                <div className="gate__tick">
                  <IconCheck />
                </div>
                <h3>Terima kasih, {nama.split(' ')[0]}!</h3>
                <p>
                  PDF awak dah sedia. Kalau PDF tak terbuka automatik, klik butang di bawah.
                </p>
                <div className="gate__actions">
                  <a
                    className="btn btn--solid"
                    href={aktif.fail}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => window.setTimeout(tutup, 800)}
                  >
                    Buka Checklist {aktif.nama}
                  </a>
                  <a
                    className="btn btn--wa btn--sm"
                    href={waSusul}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <IconWhatsApp /> WhatsApp kami
                  </a>
                </div>
                <p className="gate__note">
                  Tarikh {tarikhMesra(tarikh)} kami simpan. Kalau awak nak, kami boleh semak sama ada tarikh
                  itu masih kosong dan terus bagi quote.
                </p>
              </div>
            ) : (
              <form className="gate__form" onSubmit={hantar}>
                <div className="gate__row">
                  <div className="field">
                    <label htmlFor="g-nama">Nama</label>
                    <input
                      id="g-nama"
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      placeholder="cth. Nurul"
                      autoComplete="name"
                      autoFocus
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="g-tel">No. WhatsApp</label>
                    <input
                      id="g-tel"
                      type="tel"
                      inputMode="tel"
                      value={telefon}
                      onChange={(e) => setTelefon(e.target.value)}
                      placeholder="cth. 012-3456789"
                      autoComplete="tel"
                      required
                    />
                  </div>
                </div>
                <div className="gate__row">
                  <div className="field">
                    <label htmlFor="g-tarikh">Tarikh majlis</label>
                    <input
                      id="g-tarikh"
                      type="date"
                      min={hariMin}
                      value={tarikh}
                      onChange={(e) => setTarikh(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="g-jenis">Jenis majlis</label>
                    <select id="g-jenis" value={jenis} onChange={(e) => setJenis(e.target.value)}>
                      {['Belum pasti', 'Hari Jadi', 'Tunang', 'Kenduri / Doa Selamat', 'Lain-lain'].map(
                        (j) => (
                          <option key={j} value={j}>
                            {j}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </div>

                {ralat && <p className="gate__ralat">{ralat}</p>}

                <button type="submit" className="btn btn--solid btn--block">
                  Buka Checklist {aktif.nama} · Percuma
                </button>

                <p className="gate__note">
                  Tarikh majlis dipakai untuk semak tarikh kosong sahaja — bukan tempahan terus.
                  Awak boleh WhatsApp kami bila-bila masa.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
