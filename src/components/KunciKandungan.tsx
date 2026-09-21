import { useState } from 'react'
import { hantarLead, telefonSah } from '../lib/lead'
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
 * dipapar percuma, selebihnya dikunci di sebalik borang 2 medan.
 *
 * SENGAJA 2 medan sahaja (nama + no. WhatsApp). Tarikh majlis ditanya di gate
 * PDF kalau pelawat nak versi cetak — jangan halang orang dengan 4 medan awal.
 *
 * Nota jujur: ini gate sisi-klien. Sesiapa yang buka DevTools boleh langkau.
 * Tujuannya menapis pelawat biasa, bukan pertahanan keselamatan.
 */
export default function KunciKandungan({ nama, percuma, jumlah, onBuka }: Props) {
  const [namaOrang, setNamaOrang] = useState('')
  const [telefon, setTelefon] = useState('')
  const [ralat, setRalat] = useState('')

  const lagi = jumlah - percuma

  function hantar(e: React.FormEvent) {
    e.preventDefault()
    if (!namaOrang.trim()) return setRalat('Nama belum diisi.')
    if (!telefonSah(telefon)) return setRalat('No. WhatsApp macam tak lengkap — cth. 012-3456789.')

    hantarLead({
      nama: namaOrang.trim(),
      telefon: telefon.trim(),
      tarikh: '',
      jenis: 'Belum pasti',
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
          Isi nama dan no. WhatsApp — semua langkah terus terbuka, boleh tanda satu-satu.
          Percuma, tiada daftar akaun.
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

          {ralat && <p className="kunci__ralat">{ralat}</p>}

          <button type="submit" className="btn btn--solid btn--block">
            <IconCheck /> Buka semua langkah · Percuma
          </button>
        </form>

        <p className="kunci__nota">
          Kami simpan nombor awak untuk hantar checklist &amp; tanya pasal majlis. Tiada spam.
          Tak nak bagi nombor?{' '}
          <a href={waLink(MSG.am)} target="_blank" rel="noreferrer noopener">
            <IconWhatsApp /> WhatsApp kami
          </a>{' '}
          terus.
        </p>
      </div>
    </div>
  )
}
