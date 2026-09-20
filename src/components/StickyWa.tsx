import { waLink, MSG } from '../content'
import { IconWhatsApp } from './Icons'

/** Butang WhatsApp terapung — kekal nampak atas skrin mudah alih. */
export default function StickyWa() {
  return (
    <a
      className="sticky-wa"
      href={waLink(MSG.am)}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="WhatsApp ALUNARA"
    >
      <IconWhatsApp />
      <span className="sticky-wa__text">Tanya kami</span>
    </a>
  )
}
