import { Link } from 'react-router-dom'
import { waLink, MSG } from '../content'
import { IconWhatsApp, IconArrow } from './Icons'

/** Pita ajakan (CTA) yang dipakai di bawah setiap halaman. */
export default function CtaBand({
  tajuk = 'Satu tarikh hanya untuk satu majlis.',
  ayat = 'Bila tarikh dah diambil, memang tiada lagi. Semak kalendar kami sebelum awak pilih tarikh majlis.',
  btnText = 'Semak Tarikh Kosong',
  to = '/tempah',
}: {
  tajuk?: string
  ayat?: string
  btnText?: string
  to?: string
}) {
  return (
    <section className="cta-band">
      <div className="container cta-band__inner">
        <div className="cta-band__text">
          <h2>{tajuk}</h2>
          <p>{ayat}</p>
        </div>
        <div className="cta-band__actions">
          <Link to={to} className="btn btn--gold">
            {btnText} <IconArrow />
          </Link>
          <a
            className="btn btn--outline-cream"
            href={waLink(MSG.am)}
            target="_blank"
            rel="noreferrer noopener"
          >
            <IconWhatsApp /> WhatsApp Kami
          </a>
        </div>
      </div>
    </section>
  )
}
