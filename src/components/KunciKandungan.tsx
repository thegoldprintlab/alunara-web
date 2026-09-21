import { useState } from 'react'
import { hantarLead, telefonSah, hariIni } from '../lib/lead'
import { IconWhatsApp, IconCheck } from './Icons'
import { waLink, MSG } from '../content'

type Props = {
  /** Nama checklist yang sedang dilihat, cth. 'Checklist Birthday'. */
  nama: string
  /** Berapa langkah dipapar percuma sebelum kunci. */
  percuma: number
  /** Jumlah langkah sebenar — untuk ayat "N lagi terkunci". */
  jumlah: number
  /** Dipanggil selepas borang sah dihantar. */
  onBuka: (nama: string) => void
}

/**
 * Kunci kandungan checklist.
 *
 * Alasan: senarai penuh kalau terpampang habis, orang baca je dan tak perlu
 * bagi nombor telefon — lead magnet jadi bocor. Jadi 3 langkah pertama
 * dipapar percuma, selebihnya dikunci di sebalik borang.
 *
 * Medan SAMA dengan gate PDF (MuatGate): nama, no. WhatsApp, tarikh majlis,
 * jenis majlis. Jangan kurangkan — tanpa tarikh majlis lead ni tak boleh
 * di-follow-up (tak tahu nak semak tarikh kosong yang mana, tak boleh quote).
 *
 * Nota jujur: ini gate sisi-klien. Sesiapa yang buka DevTools boleh langkau.
 * Tujuannya menapis pelawat biasa, bukan pertahanan keselamatan.
 */
export default function KunciKandungan({ nama, percuma, jumlah, onBuka }: Props) {
  const [namaOrang, setNamaOrang] = useState('')
  const [telefon, setTelefon] = useState('')
  const [tarikh, setTarikh] = useState('')
  const [jenisMajlis, setJenisMajlis] = useState('Belum pasti')
  const [ralat, setRalat] = useState('')

  const lagi = jumlah - percuma
  const hariMin = hariIni()

  function hantar(e: React.FormEvent) {
    e.preventDefault()
    if (!namaOrang.trim()) return setRalat('Nama belum diisi.')
    if (!telefonSah(telefon)) return setRalat('No. WhatsApp macam tak lengkap — cth. 012-3456789.')
    if (!tarikh) return setRalat('Tarikh majlis belum dipilih.')

    hantarLead({
      nama: namaOrang.trim(),
      telefon: telefon.trim(),
      tarikh,
      jenis: jenisMajlis,
      checklist: nama,
      sumber: 'checklist_web',
      asal: typeof window !== 'undefined' ? window.location.pathname : '/checklist',
    })

    onBuka(namaOrang.trim())
  }

  return (
    <div className="kunci" id="buka-kunci">
      <div className="kunci__box">
        <div className="eyebrow">Buka semua {jumlah} langkah</div>
        <h3>
          {lagi} langkah lagi terkunci
        </h3>
        <p className="kunci__ayat">
          Isi nama, no. WhatsApp dan tarikh majlis — semua langkah terus terbuka, boleh tanda
          satu-satu. Percuma, tiada daftar akaun.
        </p>

        <form className="kunci__form" onSubmit={hantar}>
          <div className="kunci__row">
            <div className="field">
              <label htmlFor="k-nama">Nama</label>
              <input
                id="k-nama"
                value={namaOrang}
                onChange={(e) => setNamaOrang(e.target.value)}
                placeholder="cth. Nurul"
                autoComplete="name"
                autoFocus
                required
              />
            </div>
            <div className="field">
              <label htmlFor="k-tel">No. WhatsApp</label>
              <input
                id="k-tel"
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

          <div className="kunci__row">
            <div className="field">
              <label htmlFor="k-tarikh">Tarikh majlis</label>
              <input
                id="k-tarikh"
                type="date"
                min={hariMin}
                value={tarikh}
                onChange={(e) => setTarikh(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="k-jenis">Jenis majlis</label>
              <select
                id="k-jenis"
                value={jenisMajlis}
                onChange={(e) => setJenisMajlis(e.target.value)}
              >
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

          {ralat && <p className="kunci__ralat">{ralat}</p>}

          <button type="submit" className="btn btn--solid btn--block">
            <IconCheck /> Buka semua langkah · Percuma
          </button>
        </form>

        <p className="kunci__nota">
          Tarikh majlis dipakai untuk semak tarikh kosong sahaja — bukan tempahan terus.
          Tiada spam. Tak nak bagi nombor?{' '}
          <a href={waLink(MSG.am)} target="_blank" rel="noreferrer noopener">
            <IconWhatsApp /> WhatsApp kami
          </a>{' '}
          terus.
        </p>
      </div>
    </div>
  )
}
