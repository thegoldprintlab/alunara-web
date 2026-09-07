import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getGallery, type GalleryItem } from '../lib/supabase'

const PACKAGES = [
  {
    name: 'Sari',
    price: 'RM 109',
    blurb: 'Setup asas untuk majlis kecil & intim',
    items: ['1 meja + 6 kerusi', 'Meja hidangan percuma', 'Sarung & hiasan bertema'],
  },
  {
    name: 'Bayu',
    price: 'RM 149',
    blurb: 'Pilihan paling popular untuk hari jadi & majlis',
    items: ['2 meja + 12 kerusi', 'Meja hidangan percuma', 'Sarung & hiasan bertema'],
    featured: true,
  },
  {
    name: 'Anggun',
    price: 'RM 199',
    blurb: 'Pengalaman premium yang lengkap',
    items: ['3 meja + 18 kerusi', 'Meja hidangan percuma', 'Sarung & hiasan bertema'],
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
            Rustic · Minimalist · Floral
            <br />
            Styling untuk Hari Anda
          </h1>
          <p className="hero__tagline">1 Tarikh, 1 Majlis</p>
          <p className="hero__sub">
            Sewaan meja &amp; kerusi bertema untuk majlis anda di Melaka. Setiap tarikh
            kami dedikasikan sepenuhnya untuk satu majlis sahaja.
          </p>
          <div className="hero__cta">
            <Link to="/book" className="btn btn--gold">Tempah Tarikh Anda</Link>
            <Link to="/gallery" className="btn btn--ghost">Lihat Galeri</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__head">
            <div className="eyebrow">Tema Kami</div>
            <h2>Rustic · Minimalist · Floral</h2>
            <div className="divider divider--center" />
            <p className="section__lead">
              Tiga tema pilihan kami — rustic, minimalist &amp; floral — digayakan
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
            <div className="eyebrow">Pakej</div>
            <h2>Pakej Berpatutan untuk Majlis Anda</h2>
            <div className="divider divider--center" />
          </div>
          <div className="pkg-grid">
            {PACKAGES.map((p) => (
              <div className={'pkg-card' + (p.featured ? ' pkg-card--featured' : '')} key={p.name}>
                {p.featured && <div className="pkg-card__badge">Paling Popular</div>}
                <div className="pkg-card__name">{p.name}</div>
                <div className="pkg-card__price">{p.price}</div>
                <p className="pkg-card__blurb">{p.blurb}</p>
                <ul className="pkg-card__list">
                  {p.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
                <Link to="/book" className="btn btn--ghost">Tempah</Link>
              </div>
            ))}
          </div>
          <p className="section__note">
            * Meja hidangan percuma untuk semua pakej.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__head">
            <div className="eyebrow">Cara Ia Berfungsi</div>
            <h2>Mudah &amp; Peribadi</h2>
            <div className="divider divider--center" />
          </div>
          <div className="steps">
            <div className="step">
              <div className="step__num">1</div>
              <h3>Pilih Tarikh Anda</h3>
              <p>Pilih tarikh yang kosong di kalendar tempahan.</p>
            </div>
            <div className="step">
              <div className="step__num">2</div>
              <h3>Bayar via QR</h3>
              <p>Imbas QR DuitNow/TnG untuk sahkan tempahan.</p>
            </div>
            <div className="step">
              <div className="step__num">3</div>
              <h3>Kami Gayakan</h3>
              <p>Kami uruskan setup penuh untuk majlis anda.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="container cta-band__inner">
          <h2>Bersedia untuk menempah tarikh anda?</h2>
          <p>Setiap tarikh hanya untuk satu majlis. Tempah awal untuk elak kecewa.</p>
          <Link to="/book" className="btn btn--gold">Tempah Sekarang</Link>
        </div>
      </section>
    </>
  )
}
