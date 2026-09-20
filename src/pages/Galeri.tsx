import { Link } from 'react-router-dom'
import { TEMA, KATALOG, waLink, MSG } from '../content'
import CtaBand from '../components/CtaBand'
import Lightbox from '../components/Lightbox'
import { IconWhatsApp, IconArrow } from '../components/Icons'

export default function Galeri() {
  const jumlah = TEMA.reduce((n, t) => n + t.gambar.length + 1, 0)

  return (
    <>
      <section className="page section">
        <div className="container">
          <div className="page__head">
            <div className="eyebrow">Galeri</div>
            <h1>Setup sebenar, bukan gambar stok</h1>
            <hr className="divider" />
            <p className="lead">
              Semua gambar di bawah adalah setup yang kami pernah siapkan sendiri di Melaka.
              Klik untuk besarkan.
            </p>
            <p className="muted galeri__count">{jumlah} gambar · 3 tema</p>
          </div>

          {TEMA.map((t) => (
            <section className="galeri-block" key={t.id} aria-labelledby={`galeri-${t.id}`}>
              <header className="galeri-block__head">
                <div>
                  <h2 id={`galeri-${t.id}`}>{t.nama}</h2>
                  <p className="muted">{t.tagline} · {t.sesuai}</p>
                </div>
                <Link to={`/tema/${t.id}`} className="btn btn--ghost btn--sm">
                  Halaman Tema <IconArrow />
                </Link>
              </header>
              <div className="shots shots--wide">
                <Lightbox src={t.cover} alt={`Tema ${t.nama} — pandangan utama`} />
                {t.gambar.map((src, i) => (
                  <Lightbox key={src} src={src} alt={`Tema ${t.nama} — sudut ${i + 1}`} />
                ))}
              </div>
            </section>
          ))}

          {/* --------------------------- KATALOG PDF -------------------------- */}
          <section className="katalog" id="katalog">
            <div className="katalog__text">
              <div className="eyebrow">Katalog Penuh</div>
              <h2>Nak simpan &amp; tunjuk pada orang rumah?</h2>
              <hr className="divider" />
              <p>
                Kami ada katalog PDF 7 muka surat untuk setiap tema — sesuai dihantar ke
                WhatsApp, senang tunjuk pada keluarga atau pasangan.
              </p>
              <a
                className="btn btn--wa"
                href={waLink(MSG.katalog)}
                target="_blank"
                rel="noreferrer noopener"
              >
                <IconWhatsApp /> Minta Katalog (PDF)
              </a>
            </div>
            <div className="katalog__files">
              {KATALOG.map((k) => (
                <a key={k.fail} className="katalog__file" href={k.fail} target="_blank" rel="noreferrer">
                  <span className="katalog__file-name">Katalog {k.nama}</span>
                  <span className="katalog__file-meta">PDF · buka</span>
                </a>
              ))}
            </div>
          </section>
        </div>
      </section>

      <CtaBand
        tajuk="Dah jumpa gaya awak?"
        ayat="Semak tarikh kosong sekarang — kalau tarikh tu dah diambil, memang kami tak boleh selitkan majlis kedua."
        btnText="Semak Tarikh Kosong"
      />
    </>
  )
}
