import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { SOSIAL, WA_DISPLAY, MSG, waLink } from '../content'
import { IconWhatsApp, IconInstagram, IconTikTok, IconThreads, IconX, IconGrid } from './Icons'

const LINKS = [
  { to: '/', label: 'Utama' },
  { to: '/tema', label: 'Tema' },
  { to: '/pakej', label: 'Pakej' },
  { to: '/galeri', label: 'Galeri' },
  { to: '/checklist', label: 'Checklist' },
  { to: '/harga-hantar', label: 'Penghantaran' },
  { to: '/hubungi', label: 'Hubungi' },
]

const SOC_ICON: Record<string, ReactNode> = {
  Instagram: <IconInstagram />,
  TikTok: <IconTikTok />,
  Threads: <IconThreads />,
}

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <a href="#kandungan" className="skip">
        Lompat ke kandungan
      </a>
      <header className={'nav' + (scrolled ? ' nav--scrolled' : '') + (open ? ' nav--open' : '')}>
        <div className="container nav__inner">
          <Link to="/" className="nav__brand" aria-label="ALUNARA — laman utama">
            <span className="nav__brand-name">ALUNARA</span>
            <span className="nav__brand-sub">Event Styling · Melaka</span>
          </Link>

          <nav className="nav__links" aria-label="Navigasi utama">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) => 'nav__link' + (isActive ? ' nav__link--active' : '')}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="nav__side">
            <div className="nav__socials">
              {SOSIAL.map((s) => (
                <a
                  key={s.nama}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer me"
                  aria-label={`${s.nama} ALUNARA (${s.handle})`}
                  title={`${s.nama} ${s.handle}`}
                  className="nav__soc"
                >
                  {SOC_ICON[s.nama]}
                </a>
              ))}
            </div>
            <a
              className="btn btn--wa btn--sm nav__cta"
              href={waLink(MSG.am)}
              target="_blank"
              rel="noreferrer noopener"
            >
              <IconWhatsApp />
              <span>WhatsApp</span>
            </a>
            <button
              className="nav__burger"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? 'Tutup menu' : 'Buka menu'}
              type="button"
            >
              {open ? <IconX /> : <IconGrid />}
            </button>
          </div>
        </div>
      </header>

      <div id="mobile-menu" className={'drawer' + (open ? ' drawer--open' : '')} hidden={!open}>
        <nav className="drawer__links" aria-label="Navigasi mudah alih">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className="drawer__link">
              {l.label}
            </NavLink>
          ))}
          <NavLink to="/tempah" className="drawer__link drawer__link--gold">
            Semak Tarikh Kosong
          </NavLink>
        </nav>
        <div className="drawer__foot">
          <div className="drawer__label">Ikuti kami</div>
          <div className="drawer__socials">
            {SOSIAL.map((s) => (
              <a key={s.nama} href={s.url} target="_blank" rel="noreferrer me" className="drawer__soc">
                {SOC_ICON[s.nama]}
                <span>{s.handle}</span>
              </a>
            ))}
          </div>
          <a className="drawer__phone" href={waLink(MSG.am)} target="_blank" rel="noreferrer noopener">
            <IconWhatsApp /> WhatsApp {WA_DISPLAY}
          </a>
        </div>
      </div>
    </>
  )
}
