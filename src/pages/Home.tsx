import { Link } from 'react-router-dom'
import {
  PAKEJ,
  TEMA,
  SEBAB,
  PITCH,
  ADDON,
  WA_DISPLAY,
  MSG,
  waLink,
} from '../content'
import CtaBand from '../components/CtaBand'
import {
  IconWhatsApp,
  IconArrow,
  IconCheck,
  IconMinus,
  IconSparkle,
  IconTruck,
} from '../components/Icons'

export default function Home() {
  return (
    <>
      {/* ------------------------------- HERO ------------------------------ */}
      <section className="hero">
        <div className="hero__media">
          <img
            src="/img/hero-setup.webp"
            alt="Setup meja panjang ALUNARA dengan alas bertekstur, hiasan bunga dan kerusi bersarung"
          />
        </div>
        <div className="container hero__inner">
          <div className="hero__copy">
            <div className="eyebrow">Event Styling · Melaka</div>
            <h1 className="hero__title">
              Majlis Kecil,
              <br />
              Kesan Mewah.
            </h1>
            <p className="hero__tagline">1 Tarikh, 1 Majlis</p>
            <p className="hero__sub">
              Sewa meja &amp; kerusi bertema untuk majlis anda di Melaka. Tiga tema siap
              digayakan — rustic, minimalist, floral — dan kami uruskan hantar, susun, kemas.
            </p>
            <div className="hero__prices">
              <span>Dari <strong>RM 109</strong></span>
              <span className="hero__dot" aria-hidden="true">·</span>
              <span>Meja hidangan <strong>percuma</strong></span>
              <span className="hero__dot" aria-hidden="true">·</span>
              <span>Deposit <strong>RM 50</strong></span>
            </div>
            <div className="hero__cta">
              <Link to="/tempah" className="btn btn--gold">
                Semak Tarikh Kosong <IconArrow />
              </Link>
              <a
                className="btn btn--outline-cream"
                href={waLink(MSG.am)}
                target="_blank"
                rel="noreferrer noopener"
              >
                <IconWhatsApp /> {WA_DISPLAY}
              </a>
            </div>
            <p className="hero__note">
              Tak pasti nak mula dari mana? WhatsApp sahaja — kami bukan mesin, kami balas sendiri.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------ KENAPA ---------------------------- */}
      <section className="section section--tight strip">
        <div className="container">
          <div className="strip__grid">
            <div className="strip__item">
              <IconSparkle />
              <div>
                <strong>3 tema siap gayanya</strong>
                <span>Rustic · Minimalist · Floral</span>
              </div>
            </div>
            <div className="strip__item">
              <IconTruck />
              <div>
                <strong>Hantar + setup</strong>
                <span>Percuma dalam 10 km</span>
              </div>
            </div>
            <div className="strip__item">
              <IconCheck />
              <div>
                <strong>Meja hidangan percuma</strong>
                <span>Semua pakej</span>
              </div>
            </div>
            <div className="strip__item">
              <IconWhatsApp />
              <div>
                <strong>Balas sendiri</strong>
                <span>Bukan sistem auto</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------- TEMA ----------------------------- */}
      <section className="section">
        <div className="container">
          <div className="section__head">
            <div className="eyebrow">Tema Kami</div>
            <h2>Tiga gaya. Satu standard.</h2>
            <hr className="divider" />
            <p className="lead">
              Setiap tema guna set meja &amp; kerusi yang sama — yang berubah ialah alas,
              warna dan hiasan. Awak pilih gaya, kami uruskan selebihnya.
            </p>
          </div>

          <div className="tema-list">
            {TEMA.map((t, i) => (
              <article className={`tema-row${i % 2 === 1 ? ' tema-row--flip' : ''}`} key={t.id}>
                <Link to={`/tema/${t.id}`} className="tema-row__media">
                  <img
                    src={t.cover}
                    alt={`Setup tema ${t.nama} ALUNARA`}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                  <span className="tema-row__badge">{t.nama}</span>
                </Link>
                <div className="tema-row__body">
                  <div className="eyebrow">{t.tagline}</div>
                  <h3>{t.nama}</h3>
                  <p>{t.desc}</p>
                  <p className="tema-row__sesuai">
                    <strong>Sesuai untuk:</strong> {t.sesuai}
                  </p>
                  <div className="tema-row__actions">
                    <Link to={`/tema/${t.id}`} className="btn btn--ghost btn--sm">
                      Lihat Setiap Sudut <IconArrow />
                    </Link>
                    <a
                      className="tema-row__wa"
                      href={waLink(MSG.tema(t.nama))}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <IconWhatsApp /> Tanya tema ni
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- KIRAAN HARGA ------------------------- */}
      <section className="section compare">
        <div className="container">
          <div className="section__head section__head--center">
            <div className="eyebrow">Kira Sendiri</div>
            <h2>Kenapa orang kata mahal di tempat lain</h2>
            <hr className="divider divider--center" />
          </div>

          <div className="compare__grid">
            <div className="compare__card compare__card--plain">
              <div className="compare__label">Kalau kira satu-satu</div>
              <ul className="compare__list">
                {PITCH.orangLain.map((r) => (
                  <li key={r.label}>
                    <span className="compare__minus"><IconMinus /></span>
                    <span className="compare__name">{r.label}</span>
                    <span className="compare__val compare__val--bad">{r.nilai}</span>
                  </li>
                ))}
              </ul>
              <div className="compare__total compare__total--bad">
                <span>Jumlah</span>
                <strong>RM 172.80+</strong>
              </div>
              <p className="compare__foot">Itu kerusi sahaja. Meja belum sentuh lagi.</p>
            </div>

            <div className="compare__card compare__card--gold">
              <div className="compare__badge">Pakej Anggun</div>
              <div className="compare__label">Satu harga, semua masuk</div>
              <ul className="compare__list">
                {PITCH.kita.map((r) => (
                  <li key={r.label}>
                    <span className="compare__check"><IconCheck /></span>
                    <span className="compare__name">{r.label}</span>
                    <span className="compare__val">{r.nilai}</span>
                  </li>
                ))}
              </ul>
              <div className="compare__total">
                <span>Jumlah</span>
                <strong>RM 199</strong>
              </div>
              <p className="compare__foot compare__foot--light">{PITCH.punch}</p>
            </div>
          </div>

          <p className="center muted compare__src">
            * Harga kerusi bersarung RM9.60/unit adalah harga awam di Melaka. Kami letak sini
            supaya awak boleh kira sendiri.
          </p>
        </div>
      </section>

      {/* ------------------------------ PAKEJ ----------------------------- */}
      <section className="section">
        <div className="container">
          <div className="section__head">
            <div className="eyebrow">Pakej</div>
            <h2>Pilih ikut saiz majlis</h2>
            <hr className="divider" />
            <p className="lead">
              Semua pakej sudah termasuk meja hidangan, hiasan bertema, riben dan setup.
              Kami cuma ada 3 meja &amp; 18 kerusi — sebab itu satu tarikh satu majlis.
            </p>
          </div>

          <div className="pkg-grid">
            {PAKEJ.map((p) => (
              <div className={'pkg-card' + (p.popular ? ' pkg-card--featured' : '')} key={p.id}>
                {p.popular && <div className="pkg-card__badge">Paling Popular</div>}
                <div className="pkg-card__name">{p.nama}</div>
                <div className="pkg-card__price">
                  <span className="pkg-card__rm">RM</span>
                  {p.hargaNum}
                </div>
                <p className="pkg-card__blurb">{p.blurb}</p>
                <ul className="pkg-card__list">
                  {p.dapat.map((it) => (
                    <li key={it}>
                      <IconCheck /> {it}
                    </li>
                  ))}
                </ul>
                <a
                  className={'btn ' + (p.popular ? 'btn--gold' : 'btn--ghost') + ' btn--block'}
                  href={waLink(MSG.pakej(p.nama, p.harga))}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <IconWhatsApp /> Tanya Pakej {p.nama}
                </a>
              </div>
            ))}
          </div>

          <div className="addon">
            <div>
              <div className="eyebrow">Tambahan</div>
              <h3>{ADDON.nama} · {ADDON.harga}</h3>
              <p className="muted">
                Tapak kek, bekas air, kipas + extension. Boleh tambah pada mana-mana pakej.
              </p>
            </div>
            <a
              className="btn btn--ghost btn--sm"
              href={waLink(`Hi ALUNARA! Saya nak tambah ${ADDON.nama} (${ADDON.harga}) sekali.`)}
              target="_blank"
              rel="noreferrer noopener"
            >
              Tambah <IconArrow />
            </a>
          </div>
        </div>
      </section>

      {/* ------------------------------ SEBAB ----------------------------- */}
      <section className="section section--cream">
        <div className="container">
          <div className="section__head">
            <div className="eyebrow">Kenapa ALUNARA</div>
            <h2>Kami sengaja kekal kecil</h2>
            <hr className="divider" />
          </div>
          <div className="sebab-grid">
            {SEBAB.map((s, i) => (
              <div className="sebab" key={s.tajuk}>
                <div className="sebab__num">{String(i + 1).padStart(2, '0')}</div>
                <h3>{s.tajuk}</h3>
                <p>{s.ayat}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ LANGKAH --------------------------- */}
      <section className="section">
        <div className="container">
          <div className="section__head">
            <div className="eyebrow">Cara Ia Berfungsi</div>
            <h2>Empat langkah sahaja</h2>
            <hr className="divider" />
          </div>
          <div className="steps">
            <div className="step">
              <div className="step__num">1</div>
              <h3>Pilih tarikh</h3>
              <p>Semak kalendar kami — tarikh yang sudah diambil akan ditanda.</p>
            </div>
            <div className="step">
              <div className="step__num">2</div>
              <h3>Pilih tema &amp; pakej</h3>
              <p>Rustic, minimalist atau floral. Ikut berapa meja yang awak perlu.</p>
            </div>
            <div className="step">
              <div className="step__num">3</div>
              <h3>Deposit RM50</h3>
              <p>Lock tarikh awak. Bukan 50% — RM50 sahaja.</p>
            </div>
            <div className="step">
              <div className="step__num">4</div>
              <h3>Kami setup</h3>
              <p>Kami sampai awal, susun kemas, dan siap sebelum tetamu datang.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="ck-promo">
            <div className="ck-promo__text">
              <div className="eyebrow">Percuma · 3 langkah pertama terbuka</div>
              <h2>Checklist pelan majlis</h2>
              <hr className="divider" />
              <p>
                Tiga senarai semak siap susun — birthday, tunang dan kenduri. Isi nama, no.
                WhatsApp &amp; tarikh majlis untuk buka semua langkah, kemudian tanda satu-satu
                dalam browser atau muat turun PDF. Senang awak tak lupa benda penting sebelum
                hari majlis.
              </p>
            </div>
            <div className="ck-promo__side">
              <Link to="/checklist" className="btn btn--gold btn--block">
                Buka Checklist <IconArrow />
              </Link>
              <span className="ck-promo__nota">3 jenis majlis · 46 langkah semuanya</span>
            </div>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  )
}
