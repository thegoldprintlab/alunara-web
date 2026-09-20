import { useMemo, useState } from 'react'
import {
  LOKASI,
  JARAK_PERCUMA_KM,
  cajHantar,
  cajHantarText,
  waLink,
  MSG,
} from '../content'
import CtaBand from '../components/CtaBand'
import { IconWhatsApp, IconTruck, IconPin, IconArrow } from '../components/Icons'

export default function HargaHantar() {
  const [kawasan, setKawasan] = useState(LOKASI[0].nama)
  const lokasi = useMemo(() => LOKASI.find((l) => l.nama === kawasan) ?? LOKASI[0], [kawasan])
  const caj = cajHantar(lokasi.km)

  // senarai unik mengikut susunan jarak
  const disusun = useMemo(() => [...LOKASI].sort((a, b) => a.km - b.km), [])

  return (
    <>
      <section className="page section">
        <div className="container">
          <div className="page__head">
            <div className="eyebrow">Penghantaran</div>
            <h1>Berapa caj hantar ke kawasan awak?</h1>
            <hr className="divider" />
            <p className="lead">
              Penghantaran PERCUMA dalam {JARAK_PERCUMA_KM} km. Melebihi itu, caj bermula RM20
              dan ditambah RM1.00 untuk setiap km berikutnya.
            </p>
          </div>

          {/* --------------------------- KALKULATOR --------------------------- */}
          <div className="calc">
            <div className="calc__form">
              <label htmlFor="kawasan">Pilih kawasan majlis</label>
              <select id="kawasan" value={kawasan} onChange={(e) => setKawasan(e.target.value)}>
                {disusun.map((l) => (
                  <option key={l.nama} value={l.nama}>
                    {l.nama} — {l.km} km
                  </option>
                ))}
              </select>
              <p className="calc__hint">
                Jarak adalah anggaran dari pusat operasi kami di Taman Rambai Jaya. Tak jumpa kawasan awak? Pilih yang
                paling dekat, atau tanya kami terus.
              </p>
            </div>

            <div className={'calc__result' + (caj === 0 ? ' calc__result--free' : '')}>
              <div className="calc__result-top">
                <IconTruck />
                <span>{lokasi.nama}</span>
              </div>
              <div className="calc__hasil">
                {caj === 0 ? 'PERCUMA' : `RM ${caj}`}
              </div>
              <div className="calc__breakdown">
                {caj === 0 ? (
                  <>Dalam lingkungan {JARAK_PERCUMA_KM} km — tiada caj penghantaran.</>
                ) : (
                  <>
                    RM20 (asas) + {lokasi.km - JARAK_PERCUMA_KM} km × RM1.00
                  </>
                )}
              </div>
              <a
                className="btn btn--wa btn--block"
                href={waLink(MSG.lokasi(lokasi.nama, cajHantarText(lokasi.km)))}
                target="_blank"
                rel="noreferrer noopener"
              >
                <IconWhatsApp /> Confirm {lokasi.nama}
              </a>
            </div>
          </div>

          {/* ---------------------------- JADUAL ----------------------------- */}
          <div className="tbl-wrap">
            <h2 className="tbl-title">Senarai penuh kawasan &amp; caj</h2>
            <table className="tbl tbl--tight">
              <thead>
                <tr>
                  <th scope="col">Kawasan</th>
                  <th scope="col">Anggaran jarak</th>
                  <th scope="col">Caj penghantaran</th>
                </tr>
              </thead>
              <tbody>
                {disusun.map((l) => {
                  const c = cajHantar(l.km)
                  return (
                    <tr key={l.nama} className={l.nama === kawasan ? 'tbl__active' : ''}>
                      <th scope="row">
                        {l.nama === kawasan && <IconPin className="tbl__pin" />}
                        {l.nama}
                      </th>
                      <td>{l.km} km</td>
                      <td>
                        {c === 0 ? (
                          <span className="tag tag--free">PERCUMA</span>
                        ) : (
                          <span className="tag">RM {c}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="muted tbl__foot">
              * Jarak dikira dari pusat operasi kami di Taman Rambai Jaya. Kalau rumah awak lebih jauh sedikit
              daripada anggaran ini, kami akan confirm semula melalui WhatsApp sebelum apa-apa
              bayaran.
            </p>
          </div>

          <div className="page__cta-row">
            <a
              className="btn btn--solid"
              href={waLink(MSG.am)}
              target="_blank"
              rel="noreferrer noopener"
            >
              <IconWhatsApp /> Tanya Lokasi Saya
            </a>
            <a className="btn btn--ghost" href="#kawasan">
              Kira Semula <IconArrow />
            </a>
          </div>
        </div>
      </section>

      <CtaBand
        tajuk="Caj jelas, tiada kejutan di akhir"
        ayat="Kami bagi tahu jumlah penuh sebelum awak bayar deposit. Kalau ada tambahan, awak akan tahu dulu."
        btnText="Semak Tarikh Kosong"
      />
    </>
  )
}
