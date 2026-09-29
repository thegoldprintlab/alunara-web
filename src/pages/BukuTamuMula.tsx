/**
 * /buku-tamu — halaman penerangan produk (Buku Tamu QR).
 *
 * Kenapa wujud: pautan tanpa kod sebelum ini hanya tunjuk arahan "kod tak ada".
 * Tetapi URL ini juga yang orang taip untuk cari tahu apa itu buku tamu —
 * jadi ia mesti jual produk, bukan sekadar halaman ralat.
 *
 * Nada: macam halaman produk, bukan app. Harga dinyatakan terus supaya client
 * tak payah tanya WhatsApp hanya untuk tahu berapa.
 */
import { Link } from 'react-router-dom'
import './BukuTamu.css'

/** Harga buku tamu. Sengaja di satu tempat supaya senang tukar. */
const HARGA = {
  solo: 79,
  premium: 149,
  bundle: 199,
}

export default function BukuTamuMula() {
  return (
    <div className="bt-kulit bt-mula">
      <header className="bt-hero">
        <p className="bt-eyebrow">ALUNARA · Buku Tamu</p>
        <h1>Buku tamu digital untuk majlis anda</h1>
        <p className="bt-hero-sub">
          Tetamu scan QR di meja majlis, upload gambar terus dari telefon. Tiada
          app, tiada akaun, tiada yang perlu dipasang. Semua gambar terkumpul
          dalam satu galeri peribadi majlis anda.
        </p>
        <div className="bt-hero-aksi">
          <a className="bt-btn" href="#harga">
            Lihat harga
          </a>
          <Link className="bt-btn bt-btn--halus" to="/hubungi">
            Tanya dulu
          </Link>
        </div>
      </header>

      <section className="bt-bahagian">
        <h2>Macam mana ia berjalan</h2>
        <ol className="bt-langkah">
          <li>
            <strong>Kami sediakan kod majlis.</strong> Selepas tempahan disahkan,
            kami cipta satu kod 6 aksara untuk majlis anda.
          </li>
          <li>
            <strong>Anda dapat QR.</strong> Kami hantar pautan + QR siap cetak.
            Letak atas meja majlis atau bagi kepada pengapit.
          </li>
          <li>
            <strong>Tetamu scan dan kongsi.</strong> Isi nama sahaja, pilih gambar,
            pilih warna film, tekan kongsi. Siap dalam beberapa saat.
          </li>
          <li>
            <strong>Gambar masuk galeri anda.</strong> Semua gambar peribadi —
            hanya orang yang ada QR majlis anda boleh melihatnya.
          </li>
        </ol>
      </section>

      <section className="bt-bahagian">
        <h2>Apa yang tetamu boleh buat</h2>
        <div className="bt-ciri">
          <div className="bt-ciri-kad">
            <h3>Gambar candid</h3>
            <p>Upload terus dari browser telefon. Tiada app, tiada log masuk.</p>
          </div>
          <div className="bt-ciri-kad">
            <h3>Filter film stock</h3>
            <p>
              Enam warna bergaya filem — Portra, Portofino dan lain-lain. Supaya
              semua gambar nampak satu nada, bukan campur-campur.
            </p>
          </div>
          <div className="bt-ciri-kad">
            <h3>Ucapan &amp; doa</h3>
            <p>Tetamu boleh tinggal ucapan bertulis yang muncul bawah gambar.</p>
          </div>
          <div className="bt-ciri-kad">
            <h3>Galeri langsung</h3>
            <p>Gambar muncul serta-merta. Tetamu lain boleh tengok dan besarkan.</p>
          </div>
        </div>
      </section>

      <section className="bt-bahagian" id="harga">
        <h2>Harga</h2>
        <p className="bt-info">
          Sekali bayar. Tiada langganan bulanan, tiada caj tersembunyi. Galeri
          aktif <strong>90 hari</strong> selepas tarikh majlis.
        </p>

        <div className="bt-harga">
          <div className="bt-harga-kad">
            <p className="bt-harga-nama">Solo</p>
            <p className="bt-harga-angka">
              RM{HARGA.solo}
              <span> sekali</span>
            </p>
            <ul className="bt-harga-senarai">
              <li>1 majlis, 1 kod QR</li>
              <li>Gambar tanpa had sehingga 20 seorang</li>
              <li>6 filter film stock</li>
              <li>Ucapan tetamu</li>
              <li>Galeri aktif 90 hari</li>
            </ul>
          </div>

          <div className="bt-harga-kad bt-harga-kad--utama">
            <p className="bt-harga-tag">Paling popular</p>
            <p className="bt-harga-nama">Premium</p>
            <p className="bt-harga-angka">
              RM{HARGA.premium}
              <span> sekali</span>
            </p>
            <ul className="bt-harga-senarai">
              <li>Semua dalam Solo</li>
              <li>Kuota naik jadi 50 gambar seorang</li>
              <li>Galeri aktif <strong>6 bulan</strong></li>
              <li>Nama majlis &amp; tarikh pada halaman</li>
              <li>QR siap cetak (kami hantar fail)</li>
            </ul>
          </div>

          <div className="bt-harga-kad">
            <p className="bt-harga-nama">Bundle Tempahan</p>
            <p className="bt-harga-angka">
              RM{HARGA.bundle}
              <span> dengan sewa</span>
            </p>
            <ul className="bt-harga-senarai">
              <li>Untuk client sewa meja &amp; kerusi ALUNARA</li>
              <li>Buku tamu Premium</li>
              <li>Diskaun RM{HARGA.premium + HARGA.bundle - HARGA.bundle} dari harga asing</li>
              <li>Kod siap sebelum majlis</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="bt-bahagian">
        <h2>Soalan yang selalu ditanya</h2>
        <dl className="bt-faq">
          <dt>Tetamu kena install app?</dt>
          <dd>
            Tidak. Scan QR, terus upload dari browser telefon. Inilah sebab kami
            pilih cara ini — app membunuh penyertaan tetamu.
          </dd>

          <dt>Orang lain boleh tengok gambar majlis saya?</dt>
          <dd>
            Tidak. Setiap majlis ada kod sendiri dan galeri disekat pada kod itu.
            Hanya orang yang ada QR majlis anda boleh masuk. Jangan kongsi QR di
            media sosial awam.
          </dd>

          <dt>Berapa lama galeri aktif?</dt>
          <dd>
            90 hari untuk Solo, 6 bulan untuk Premium, dikira dari tarikh majlis.
            Selepas itu muat naik ditutup; gambar lama masih ada dengan kami.
          </dd>

          <dt>Siapa yang muat turun gambar?</dt>
          <dd>
            Anda. Kami sediakan butang muat turun di panel ALUNARA supaya anda
            boleh simpan semua gambar sendiri.
          </dd>

          <dt>Boleh guna untuk majlis selain kahwin?</dt>
          <dd>
            Boleh — bertunang, cukur jambul, hari lahir, majlis doa selamat.
            Apa-apa majlis yang ada tetamu dan ada gambar.
          </dd>
        </dl>
      </section>

      <section className="bt-bahagian bt-cta">
        <h2>Nak tempah buku tamu?</h2>
        <p className="bt-info">
          Beritahu kami tarikh majlis. Kami akan siapkan kod dan QR sebelum hari
          tersebut.
        </p>
        <div className="bt-hero-aksi">
          <Link className="bt-btn" to="/tempah">
            Tempah sekarang
          </Link>
          <Link className="bt-btn bt-btn--halus" to="/hubungi">
            WhatsApp kami
          </Link>
        </div>
      </section>

      <section className="bt-bahagian">
        <h2>Sudah ada kod majlis?</h2>
        <p className="bt-info">
          Buka pautan pada QR anda — ia nampak macam{' '}
          <code>alunara.my/buku-tamu/ABC234</code>. Kod ialah 6 aksara di hujung
          pautan.
        </p>
      </section>

      <footer className="bt-kaki">
        <p>Buku tamu oleh ALUNARA · Melaka</p>
      </footer>
    </div>
  )
}
