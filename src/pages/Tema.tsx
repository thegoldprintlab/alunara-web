import { Link, useParams, Navigate } from 'react-router-dom'
import { TEMA, waLink, MSG } from '../content'
import CtaBand from '../components/CtaBand'
import Lightbox from '../components/Lightbox'
import { IconWhatsApp, IconArrow } from '../components/Icons'

/** /tema — senarai semua tema. */
export function TemaIndex() {
  return (
    <>
      <section className="page section">
        <div className="container">
          <div className="page__head">
            <div className="eyebrow">Tema</div>
            <h1>Tiga cara untuk gayakan majlis</h1>
            <hr className="divider" />
            <p className="lead">
              Kami guna set meja &amp; kerusi yang sama. Yang berubah ialah alas, warna dan
              hiasan — sebab itu harga kekal sama walau apa tema awak pilih.
            </p>
          </div>

          <div className="tema-cards">
            {TEMA.map((t) => (
              <Link to={`/tema/${t.id}`} className="tema-card" key={t.id}>
                <div className="tema-card__media">
                  <img src={t.cover} alt={`Setup tema ${t.nama}`} loading="lazy" decoding="async" />
                </div>
                <div className="tema-card__body">
                  <div className="eyebrow">{t.tagline}</div>
                  <h3>{t.nama}</h3>
                  <p>{t.sesuai}</p>
                  <span className="tema-card__more">
                    Lihat 3 sudut <IconArrow />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <CtaBand
        tajuk="Dah tahu nak tema apa?"
        ayat="WhatsApp kami nama tema tu — kami hantar gambar setup sebenar yang paling dekat dengan pilihan awak."
        btnText="Semak Tarikh Kosong"
      />
    </>
  )
}

/** /tema/:id — halaman satu tema. */
export function TemaDetail() {
  const { id } = useParams()
  const tema = TEMA.find((t) => t.id === id)
  if (!tema) return <Navigate to="/tema" replace />

  const lain = TEMA.filter((t) => t.id !== tema.id)

  return (
    <>
      <section className="page section tema-hero">
        <div className="container">
          <nav className="crumb" aria-label="Breadcrumb">
            <Link to="/">Utama</Link>
            <span aria-hidden="true">/</span>
            <Link to="/tema">Tema</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{tema.nama}</span>
          </nav>

          <div className="tema-hero__grid">
            <div className="tema-hero__copy">
              <div className="eyebrow">{tema.tagline}</div>
              <h1>{tema.nama}</h1>
              <hr className="divider" />
              <p className="lead">{tema.desc}</p>
              <p className="tema-hero__sesuai">
                <strong>Sesuai untuk:</strong> {tema.sesuai}
              </p>
              <div className="tema-hero__actions">
                <Link to="/tempah" className="btn btn--gold">
                  Semak Tarikh Kosong <IconArrow />
                </Link>
                <a
                  className="btn btn--ghost"
                  href={waLink(MSG.tema(tema.nama))}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <IconWhatsApp /> Tanya Tema {tema.nama}
                </a>
              </div>
            </div>
            <div className="tema-hero__media">
              <img
                src={tema.cover}
                alt={`Setup tema ${tema.nama} ALUNARA di Melaka`}
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tight">
        <div className="container">
          <div className="section__head">
            <div className="eyebrow">Setiap Sudut</div>
            <h2>Yang awak sebenarnya dapat</h2>
            <hr className="divider" />
            <p className="muted">
              Klik gambar untuk besarkan. Semua ni setup sebenar yang kami pernah siapkan.
            </p>
          </div>
          <div className="shots">
            {tema.gambar.map((src, i) => (
              <Lightbox key={src} src={src} alt={`Tema ${tema.nama} — sudut ${i + 1}`} />
            ))}
          </div>
        </div>
      </section>

      <section className="section section--cream">
        <div className="container">
          <div className="section__head">
            <div className="eyebrow">Tema Lain</div>
            <h2>Kalau ni tak kena gaya</h2>
            <hr className="divider" />
          </div>
          <div className="tema-cards tema-cards--2">
            {lain.map((t) => (
              <Link to={`/tema/${t.id}`} className="tema-card" key={t.id}>
                <div className="tema-card__media">
                  <img src={t.cover} alt={`Setup tema ${t.nama}`} loading="lazy" decoding="async" />
                </div>
                <div className="tema-card__body">
                  <h3>{t.nama}</h3>
                  <p>{t.sesuai}</p>
                  <span className="tema-card__more">
                    Lihat <IconArrow />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        tajuk={`Suka tema ${tema.nama}?`}
        ayat="Sebut sahaja nama tema tu dalam WhatsApp — kami terus semak tarikh awak."
        btnText="Semak Tarikh Kosong"
      />
    </>
  )
}
