import { Link, NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home' },
  { to: '/book', label: 'Book' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/payment', label: 'Payment' },
  { to: '/contact', label: 'Contact' },
]

export default function Nav() {
  return (
    <header className="nav">
      <div className="container nav__inner">
        <Link to="/" className="nav__brand">
          <span className="nav__brand-name">ALUNARA</span>
          <span className="nav__brand-sub">Event Styling · Melaka</span>
        </Link>
        <nav className="nav__links">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                'nav__link' + (isActive ? ' nav__link--active' : '')
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
