import { Link } from 'react-router-dom'
import { SOSIAL, WA_DISPLAY, MSG, waLink, PAKEJ, TEMA } from '../content'
import { IconWhatsApp, IconInstagram, IconTikTok, IconThreads, IconPin } from './Icons'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand-col">
          <div className="footer__brand">ALUNARA</div>
          <div className="footer__tag">1 Tarikh, 1 Majlis</div>
          <p className="footer__blurb">
            Sewa meja &amp; kerusi bertema untuk majlis kecil di Melaka. Setiap tarikh,
            satu majlis sahaja.
          </p>
          <div className="footer__socials">
            {SOSIAL.map((s) => (
              <a
                key={s.nama}
                href={s.url}
                target="_blank"
                rel="noreferrer me"
                className="footer__soc"
                aria-label={`${s.nama} ALUNARA (${s.handle})`}
              >
                {s.nama === 'Instagram' && <IconInstagram />}
                {s.nama === 'TikTok' && <IconTikTok />}
                {s.nama === 'Threads' && <IconThreads />}
                <span>{s.handle}</span>
              </a>
            ))}
          </div>
        </div>

        <div className="footer__col">
          <div className="footer__heading">Tema</div>
          {TEMA.map((t) => (
            <Link key={t.id} to={`/tema/${t.id}`}>
              {t.nama}
            </Link>
          ))}
          <Link to="/galeri">Galeri Penuh</Link>
        </div>

        <div className="footer__col">
          <div className="footer__heading">Pakej</div>
          {PAKEJ.map((p) => (
            <Link key={p.id} to="/pakej">
              {p.nama} · {p.harga}
            </Link>
          ))}
          <Link to="/harga-hantar">Caj Penghantaran</Link>
        </div>

        <div className="footer__col">
          <div className="footer__heading">Hubungi</div>
          <a href={waLink(MSG.am)} target="_blank" rel="noreferrer noopener" className="footer__wa">
            <IconWhatsApp /> {WA_DISPLAY}
          </a>
          <span className="footer__flat">
            <IconPin /> Melaka sahaja
          </span>
          <Link to="/tempah">Semak Tarikh Kosong</Link>
          <Link to="/checklist">Checklist Pelan Majlis</Link>
          <Link to="/hubungi">Semua Soalan Lazim</Link>
        </div>
      </div>

      <div className="container footer__bottom">
        <span>© {year} ALUNARA · Hak cipta terpelihara</span>
        <span className="footer__made">Dibina untuk majlis kecil yang nampak mahal.</span>
      </div>
    </footer>
  )
}
