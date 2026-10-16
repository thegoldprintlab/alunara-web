import { Link } from 'react-router-dom'
import { LOOSE_ITEMS, MSG, waLink } from '../content'
import CtaBand from '../components/CtaBand'
import { IconWhatsApp, IconArrow } from '../components/Icons'

/**
 * Halaman sewa item berasingan (loose items).
 *
 * Sebelum ini senarai ini duduk di dalam /pakej dan juga di homepage, jadi
 * dua tempat boleh jadi tak selaras bila harga berubah. Sekarang ia hidup di
 * SATU halaman sahaja — /sewa-item — dan halaman lain cuma paut ke sini.
 * Kalau tambah item baru, cukup tambah dalam LOOSE_ITEMS (content.ts).
 */
export default function SewaItem() {
  return (
    <>
      <section className="page section">
        <div className="container">
          <div className="page__head">
            <div className="eyebrow">Sewa Item</div>
            <h1>Sewa item sahaja, tanpa pakej</h1>
            <hr className="divider" />
            <p className="lead">
              Tak perlu ambil pakej penuh. Semua item di bawah boleh disewa berasingan —
              sesuai kalau awak dah ada meja sendiri, atau nak tambah satu dua barang pada
              setup yang dah ada. Hantar &amp; setup tetap kami uruskan.
            </p>
          </div>

          <div className="loose-grid loose-grid--page">
            {LOOSE_ITEMS.map((item) => (
              <div className="loose-item" key={item.id}>
                <div>
                  <strong>{item.nama}</strong>
                  {item.unit && <small>{item.unit}</small>}
                </div>
                <a
                  href={waLink(MSG.looseItem(item.nama, item.harga))}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  RM{item.harga} <IconArrow />
                </a>
              </div>
            ))}
          </div>

          <div className="notes">
            <h3>Perkara yang ramai tanya</h3>
            <ul>
              <li>
                <strong>Boleh campur dengan pakej:</strong> item berasingan boleh ditambah pada
                pakej Sari, Bayu, Anggun atau Purnama — cuma sebut masa tanya.
              </li>
              <li>
                <strong>Deposit:</strong> RM50 sahaja untuk lock tarikh, sama seperti pakej. Baki
                sebelum majlis.
              </li>
              <li>
                <strong>Penghantaran:</strong> PERCUMA dalam 10 km. Melebihi itu bermula RM20 +
                RM1.00/km.{' '}
                <Link to="/harga-hantar">Kira caj kawasan awak →</Link>
              </li>
              <li>
                <strong>Stok terhad:</strong> satu tarikh, satu majlis. Kerusi, riben dan gazebo
                ikut siapa tempah dulu.
              </li>
            </ul>
          </div>

          <div className="page__cta-row">
            <a
              className="btn btn--solid"
              href={waLink(MSG.am)}
              target="_blank"
              rel="noreferrer noopener"
            >
              <IconWhatsApp /> Tanya Stok &amp; Tarikh
            </a>
            <Link to="/pakej" className="btn btn--ghost">
              Lihat Pakej Penuh <IconArrow />
            </Link>
          </div>
        </div>
      </section>

      <CtaBand
        tajuk="Nak item sahaja, atau pakej penuh?"
        ayat="Bagitahu kami berapa meja dan kerusi yang awak perlukan — kami susun yang paling berbaloi untuk majlis awak."
        btnText="Semak Tarikh Kosong"
      />
    </>
  )
}
