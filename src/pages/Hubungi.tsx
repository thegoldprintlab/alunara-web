import { useState } from 'react'
import { FAQ, SOSIAL, WA_DISPLAY, MSG, waLink, KATALOG, CHECKLIST } from '../content'
import CtaBand from '../components/CtaBand'
import MuatChecklist from '../components/MuatChecklist'
import {
  IconWhatsApp,
  IconInstagram,
  IconTikTok,
  IconThreads,
  IconPin,
  IconPlus,
  IconMinus,
  IconArrow,
} from '../components/Icons'

export default function Hubungi() {
  const [buka, setBuka] = useState<number | null>(0)

  const SOC = [
    { ...SOSIAL[0], icon: <IconInstagram /> },
    { ...SOSIAL[1], icon: <IconTikTok /> },
    { ...SOSIAL[2], icon: <IconThreads /> },
  ]

  return (
    <>
      <section className="page section">
        <div className="container">
          <div className="page__head">
            <div className="eyebrow">Hubungi</div>
            <h1>WhatsApp kami — kami balas sendiri</h1>
            <hr className="divider" />
            <p className="lead">
              Tiada sistem auto, tiada chatbot. Awak akan bercakap terus dengan orang yang akan
              setup majlis awak.
            </p>
          </div>

          <div className="contact-grid">
            {/* --------------------------- WHATSAPP --------------------------- */}
            <div className="contact-card contact-card--primary">
              <IconWhatsApp className="contact-card__icon" />
              <div className="eyebrow eyebrow--dark">Cara terpantas</div>
              <h2>WhatsApp</h2>
              <a className="contact-card__big" href={`tel:+${'60189564604'}`}>
                {WA_DISPLAY}
              </a>
              <p className="contact-card__note">
                Balasan biasanya dalam beberapa jam. Kalau lambat, kami mungkin sedang setup
                majlis orang lain.
              </p>
              <div className="contact-card__quick">
                {[
                  { t: 'Nak tanya harga', m: MSG.am },
                  { t: 'Nak katalog PDF', m: MSG.katalog },
                  { t: 'Nak semak tarikh', m: 'Hi ALUNARA! Boleh semak tarikh kosong untuk bulan ni?' },
                  { t: 'Nak bayar deposit', m: MSG.deposit },
                ].map((q) => (
                  <a
                    key={q.t}
                    className="quick"
                    href={waLink(q.m)}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {q.t} <IconArrow />
                  </a>
                ))}
              </div>
            </div>

            {/* --------------------------- SOCIALS ---------------------------- */}
            <div className="contact-card">
              <div className="eyebrow">Ikuti</div>
              <h2>Media sosial</h2>
              <p className="muted">
                Kami post setup terbaru, video sebelum/selepas dan tips majlis di sini.
              </p>
              <div className="social-list">
                {SOC.map((s) => (
                  <a
                    key={s.nama}
                    className="social-row"
                    href={s.url}
                    target="_blank"
                    rel="noreferrer me"
                  >
                    <span className="social-row__icon">{s.icon}</span>
                    <span className="social-row__body">
                      <strong>{s.nama}</strong>
                      <span>{s.handle}</span>
                    </span>
                    <IconArrow />
                  </a>
                ))}
              </div>
            </div>

            {/* ---------------------------- LOKASI ---------------------------- */}
            <div className="contact-card">
              <div className="eyebrow">Kawasan</div>
              <h2>Melaka sahaja</h2>
              <p className="muted">
                <IconPin className="inline-icon" /> Kami cover seluruh Melaka. Penghantaran
                percuma dalam 10 km dari pusat bandar.
              </p>
              <ul className="contact-list">
                <li>Buka tempahan setiap hari, 9 pagi – 9 malam</li>
                <li>Satu tarikh = satu majlis sahaja</li>
                <li>Deposit RM50 untuk lock tarikh</li>
              </ul>
              <a className="btn btn--ghost btn--sm" href="/harga-hantar">
                Kira caj hantar <IconArrow />
              </a>
            </div>

            {/* ---------------------------- KATALOG --------------------------- */}
            <div className="contact-card">
              <div className="eyebrow">Katalog</div>
              <h2>PDF 3 tema</h2>
              <p className="muted">
                7 muka surat untuk setiap tema. Senang tunjuk pada pasangan atau orang rumah.
              </p>
              <div className="katalog__files katalog__files--stack">
                {KATALOG.map((k) => (
                  <a key={k.fail} className="katalog__file" href={k.fail} target="_blank" rel="noreferrer">
                    <span className="katalog__file-name">Katalog {k.nama}</span>
                    <span className="katalog__file-meta">PDF</span>
                  </a>
                ))}
              </div>
              <p className="katalog__label" style={{ marginTop: 18 }}>
                Checklist pelan majlis · percuma
              </p>
              <MuatChecklist senarai={CHECKLIST} eyebrow="Checklist Percuma" />
            </div>
          </div>

          {/* ------------------------------- FAQ ------------------------------ */}
          <div className="faq" id="faq">
            <div className="section__head">
              <div className="eyebrow">Soalan Lazim</div>
              <h2>Perkara yang selalu ditanya</h2>
              <hr className="divider" />
            </div>
            <div className="faq__list">
              {FAQ.map((f, i) => {
                const aktif = buka === i
                return (
                  <div className={'faq__item' + (aktif ? ' faq__item--open' : '')} key={f.q}>
                    <h3 className="faq__q">
                      <button
                        type="button"
                        onClick={() => setBuka(aktif ? null : i)}
                        aria-expanded={aktif}
                        aria-controls={`faq-a-${i}`}
                      >
                        <span>{f.q}</span>
                        {aktif ? <IconMinus /> : <IconPlus />}
                      </button>
                    </h3>
                    <div className="faq__a" id={`faq-a-${i}`} hidden={!aktif}>
                      <p>{f.a}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <CtaBand
        tajuk="Masih ada soalan?"
        ayat="Tanya sahaja. Kami lebih suka awak tanya awal daripada awak rasa tak pasti."
        btnText="Semak Tarikh Kosong"
      />
    </>
  )
}
