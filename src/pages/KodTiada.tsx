/**
 * /buku-tamu tanpa kod.
 *
 * Tetamu sampai sini bila QR rosak, atau kod tercicir semasa taip. Mereka
 * datang dari meja majlis dan mungkin tak tahu apa itu "404" — jadi kita
 * beri arahan, bukan halaman ralat.
 */
import { Link } from 'react-router-dom'
import './BukuTamu.css'

export default function KodTiada() {
  return (
    <div className="bt-kulit">
      <div className="bt-kad">
        <p className="bt-eyebrow">Buku Tamu</p>
        <h1>Kod majlis tak ada</h1>
        <p className="bt-info">
          Pautan ini tak bawa kod majlis. Kod ialah <strong>6 aksara</strong> di
          hujung pautan (contoh: <code>alunara.my/buku-tamu/ABC234</code>).
        </p>
        <p className="bt-info">
          Cara paling senang: <strong>scan QR semula</strong> dari meja majlis.
          Kalau QR rosak, minta tuan rumah tunjuk pautan penuh.
        </p>
        <p className="bt-info bt-info--kecil">
          <Link to="/">Balik ke laman utama</Link>
        </p>
      </div>
    </div>
  )
}
