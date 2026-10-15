import { Link } from 'react-router-dom'
import { PAKEJ, TEMA, WA_DISPLAY, MSG, waLink, LOOSE_ITEMS } from '../content'
import CtaBand from '../components/CtaBand'
import { IconWhatsApp, IconArrow } from '../components/Icons'

const BANDING: { label: string; nilai: string[]; jenis: 'text' | 'bil' }[] = [
  { label: 'Harga', nilai: PAKEJ.map((p) => p.harga), jenis: 'text' },
  { label: 'Meja', nilai: PAKEJ.map((p) => `${p.meja} meja`), jenis: 'bil' },
  { label: 'Kerusi beriben', nilai: PAKEJ.map((p) => `${p.kerusi} kerusi`), jenis: 'bil' },
  { label: 'Alas meja + hiasan', nilai: PAKEJ.map(() => 'Termasuk'), jenis: 'text' },
  {
    label: 'Basic dessert table',
    nilai: PAKEJ.map((p) => (p.id === 'sari' ? 'Tidak termasuk' : 'Termasuk')),
    jenis: 'text',
  },
  {
    label: 'Welcome board',
    nilai: PAKEJ.map((p) => (p.id === 'anggun' || p.id === 'purnama' ? 'Termasuk' : '—')),
    jenis: 'text',
  },
  {
    label: 'Khemah gazebo 3m x 4m',
    nilai: PAKEJ.map((p) => (p.id === 'purnama' ? 'Termasuk' : '—')),
    jenis: 'text',
  },
  { label: 'Hantar & setup', nilai: PAKEJ.map(() => 'Termasuk'), jenis: 'text' },
]

export default function Pakej() {
  return (
    <>
      <section className="page section">
        <div className="container">
          <div className="page__head">
            <div className="eyebrow">Pakej &amp; Harga</div>
            <h1>Semua pakej, semua termasuk</h1>
            <hr className="divider" />
            <p className="lead">
            Tiada caj tersembunyi. Pakej Sari, Bayu, Anggun & Purnama sudah termasuk meja
            beriben, hiasan meja dan setup. Basic dessert table & welcome board bergantung
            pada pakej yang dipilih.
          </p>
          </div>

          <div className="pkg-grid pkg-grid--page">
            {PAKEJ.map((p) => (
              <div
                id={`pakej-${p.id}`}
                className={'pkg-card pkg-card--tall' + (p.popular ? ' pkg-card--featured' : '')}
                key={p.id}
              >
                {p.popular && <div className="pkg-card__badge">Paling Popular</div>}
                <div className="pkg-card__name">{p.nama}</div>
                <div className="pkg-card__price">
                  <span className="pkg-card__rm">RM</span>
                  {p.hargaNum}
                </div>
                <p className="pkg-card__blurb">{p.blurb}</p>

                <div className="pkg-card__spec">
                  <span>{p.meja} meja</span>
                  <span>{p.kerusi} kerusi</span>
                </div>

                <ul className="pkg-card__list">
                  {p.dapat.map((it) => (
                    <li key={it}>{it}</li>
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

          {/* -------------------------- JADUAL BANDING ------------------------- */}
          <div className="tbl-wrap">
            <h2 className="tbl-title">Banding sebelah-sebelah</h2>
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Perkara</th>
                  {PAKEJ.map((p) => (
                    <th scope="col" key={p.id} className={p.popular ? 'tbl__hl' : ''}>
                      {p.nama}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BANDING.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    {r.nilai.map((v, i) => (
                      <td key={i} className={PAKEJ[i].popular ? 'tbl__hl' : ''}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row">Tema boleh pilih</th>
                  {PAKEJ.map((p) => (
                    <td key={p.id} className={p.popular ? 'tbl__hl' : ''}>
                      {TEMA.map((t) => t.nama).join(' · ')}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="notes">
            <h3>Sewa loose item</h3>
            <p className="muted">Nak tambah item tanpa ambil dalam pakej? Semua boleh disewa berasingan.</p>
            <div className="loose-grid">
              {LOOSE_ITEMS.map((item) => (
                <div className="loose-item" key={item.id}>
                  <div><strong>{item.nama}</strong>{item.unit && <small>{item.unit}</small>}</div>
                  <a href={waLink(MSG.looseItem(item.nama, item.harga))} target="_blank" rel="noreferrer noopener">
                    RM{item.harga} <IconArrow />
                  </a>
                </div>
              ))}
            </div>
          </div>

          <div className="notes">
            <h3>Perkara yang ramai tanya</h3>
            <ul>
              <li>
                <strong>Deposit:</strong> RM50 sahaja untuk lock tarikh — bukan 50% daripada harga
                pakej. Baki sebelum majlis.
              </li>
              <li>
                <strong>Penghantaran:</strong> PERCUMA dalam 10 km. Melebihi itu bermula RM20 +
                RM1.00/km.{' '}
                <Link to="/harga-hantar">Kira caj kawasan awak →</Link>
              </li>
              <li>
                <strong>Tambahan RM59:</strong> tapak kek + bekas air + kipas &amp; extension.
              </li>
              <li>
                <strong>Satu tarikh, satu majlis:</strong> kami ada 3 meja &amp; 18 kerusi sahaja.
                Tempah awal supaya tarikh awak tak diambil.
              </li>
            </ul>
          </div>

          <div className="page__cta-row">
            <Link to="/tempah" className="btn btn--solid">
              Semak Tarikh Kosong <IconArrow />
            </Link>
            <a
              className="btn btn--ghost"
              href={waLink(MSG.am)}
              target="_blank"
              rel="noreferrer noopener"
            >
              <IconWhatsApp /> WhatsApp {WA_DISPLAY}
            </a>
          </div>
        </div>
      </section>

      <CtaBand
        tajuk="Nak tengok dulu sebelum tempah?"
        ayat="Kami boleh hantar katalog penuh 3 tema, atau gambar setup yang paling dekat dengan tema pilihan awak."
        btnText="Minta Katalog"
        to="/galeri"
      />
    </>
  )
}
