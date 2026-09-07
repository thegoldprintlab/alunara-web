import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getGallery, type GalleryItem } from '../lib/supabase'

const PACKAGES = [
  {
    name: 'Champagne',
    price: 'RM 99',
    blurb: 'Essential setup for intimate gatherings',
    items: ['1 themed table styling', 'Chair & table dressing', 'Basic floral accent'],
  },
  {
    name: 'Signature',
    price: 'RM 149',
    blurb: 'Our most-loved styling for birthdays & majlis',
    items: ['Full table & backdrop styling', 'Rustic / floral theme', 'Champagne accent details'],
    featured: true,
  },
  {
    name: 'Luxury',
    price: 'RM 199',
    blurb: 'Complete premium experience',
    items: ['Premium themed styling', 'Full floral arrangement', 'Serving table included'],
  },
]

export default function Home() {
  const [gallery, setGallery] = useState<GalleryItem[]>([])

  useEffect(() => {
    getGallery().then(setGallery)
  }, [])

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div className="eyebrow">Event Styling · Melaka</div>
          <h1 className="hero__title">
            Rustic &amp; Minimalist Floral
            <br />
            Styling for Your Day
          </h1>
          <p className="hero__tagline">1 Tarikh, 1 Majlis</p>
          <p className="hero__sub">
            Sewaan meja &amp; kerusi bertema untuk majlis anda di Melaka. Setiap tarikh
            kami dedikasikan sepenuhnya untuk satu majlis sahaja.
          </p>
          <div className="hero__cta">
            <Link to="/book" className="btn btn--gold">Book Your Date</Link>
            <Link to="/gallery" className="btn btn--ghost">View Gallery</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__head">
            <div className="eyebrow">Our Themes</div>
            <h2>Rustic · Minimalist Floral</h2>
            <div className="divider divider--center" />
            <p className="section__lead">
              Dua tema tandatangan kami — champagne &amp; dark coffee — digayakan
              kemas, ringkas dan eksklusif.
            </p>
          </div>
          <div className="theme-row">
            {gallery.slice(0, 2).map((g) => (
              <div className="theme-card" key={g.id}>
                <img src={g.url} alt={g.caption} loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--cream">
        <div className="container">
          <div className="section__head">
            <div className="eyebrow">Packages</div>
            <h2>Pakej Berpatutan untuk Majlis Anda</h2>
            <div className="divider divider--center" />
          </div>
          <div className="pkg-grid">
            {PACKAGES.map((p) => (
              <div className={'pkg-card' + (p.featured ? ' pkg-card--featured' : '')} key={p.name}>
                {p.featured && <div className="pkg-card__badge">Most Popular</div>}
                <div className="pkg-card__name">{p.name}</div>
                <div className="pkg-card__price">{p.price}</div>
                <p className="pkg-card__blurb">{p.blurb}</p>
                <ul className="pkg-card__list">
                  {p.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
                <Link to="/book" className="btn btn--ghost">Reserve</Link>
              </div>
            ))}
          </div>
          <p className="section__note">
            * Meja hidangan (serving table) percuma untuk semua pakej.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__head">
            <div className="eyebrow">How It Works</div>
            <h2>Simple &amp; Personal</h2>
            <div className="divider divider--center" />
          </div>
          <div className="steps">
            <div className="step">
              <div className="step__num">1</div>
              <h3>Pick Your Date</h3>
              <p>Pilih tarikh yang kosong di kalendar booking.</p>
            </div>
            <div className="step">
              <div className="step__num">2</div>
              <h3>Pay via QR</h3>
              <p>Imbas QR DuitNow/TnG untuk sahkan tempahan.</p>
            </div>
            <div className="step">
              <div className="step__num">3</div>
              <h3>We Style It</h3>
              <p>Kami uruskan setup penuh untuk majlis anda.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="container cta-band__inner">
          <h2>Ready to reserve your date?</h2>
          <p>Setiap tarikh hanya untuk satu majlis. Book awal untuk elak kecewa.</p>
          <Link to="/book" className="btn btn--gold">Book Now</Link>
        </div>
      </section>
    </>
  )
}
