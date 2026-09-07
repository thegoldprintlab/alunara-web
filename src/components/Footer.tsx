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
          <div className="footer__heading">Terokai</div>
          <Link to="/book">Tempah Tarikh Anda</Link>
          <Link to="/gallery">Galeri</Link>
          <Link to="/payment">Bayaran</Link>
          <Link to="/contact">Hubungi</Link>
        </div>
        <div className="footer__col">
          <div className="footer__heading">Ikuti</div>
          {socials.map((s) => (
            <a key={s.name} href={s.url} target="_blank" rel="noreferrer">
              {s.name}
            </a>
          ))}
        </div>
        <div className="footer__col">
          <div className="footer__heading">Lokasi</div>
          <div>{settings.location || 'Melaka, Malaysia'}</div>
          {settings.phone && <a href={`tel:${settings.phone}`}>{settings.phone}</a>}
        </div>
      </div>
      <div className="container footer__bottom">
        © {new Date().getFullYear()} ALUNARA · Hak cipta terpelihara
      </div>
    </footer>
  )
}
