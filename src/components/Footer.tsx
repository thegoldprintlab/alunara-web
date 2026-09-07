import { Link } from 'react-router-dom'
import type { Settings } from '../lib/supabase'

export default function Footer({ settings }: { settings: Settings }) {
  const socials = [
    settings.instagram && { name: 'Instagram', url: settings.instagram },
    settings.tiktok && { name: 'TikTok', url: settings.tiktok },
    settings.threads && { name: 'Threads', url: settings.threads },
  ].filter(Boolean) as { name: string; url: string }[]

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div>
          <div className="footer__brand">ALUNARA</div>
          <div className="footer__tag">1 Tarikh, 1 Majlis</div>
        </div>
        <div className="footer__col">
          <div className="footer__heading">Explore</div>
          <Link to="/book">Book Your Date</Link>
          <Link to="/gallery">Gallery</Link>
          <Link to="/payment">Payment</Link>
          <Link to="/contact">Contact</Link>
        </div>
        <div className="footer__col">
          <div className="footer__heading">Follow</div>
          {socials.map((s) => (
            <a key={s.name} href={s.url} target="_blank" rel="noreferrer">
              {s.name}
            </a>
          ))}
        </div>
        <div className="footer__col">
          <div className="footer__heading">Location</div>
          <div>{settings.location || 'Melaka, Malaysia'}</div>
          {settings.phone && <a href={`tel:${settings.phone}`}>{settings.phone}</a>}
        </div>
      </div>
      <div className="container footer__bottom">
        © {new Date().getFullYear()} ALUNARA · All rights reserved
      </div>
    </footer>
  )
}
