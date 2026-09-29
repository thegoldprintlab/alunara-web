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
import { waLink, MSG } from '../content'
import './BukuTamu.css'

/**
 * Harga buku tamu — diputuskan bos 29 Sep 2026.
 *
 *   bundle   = +RM39 di atas pakej sewa meja (add-on)
 *   standalone = RM79, buku tamu sahaja
 *
 * Produk SAMA untuk kedua-duanya — tiada tier ciri. Bezanya cuma sama ada
 * client juga menyewa meja. Jangan cipta tier baharu tanpa bos.
 * Rujuk Dokumentasi/Sedetik/03 - Keputusan & Langkah Seterusnya.md
 */
const HARGA = {
  bundle: 39,
  standalone: 79,
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
            <strong>Tempah &amp; bayar.</strong> Beritahu kami tarikh majlis.
            Selepas bayaran, kami hantar satu kod 6 aksara melalui WhatsApp.
          </li>
          <li>
            <strong>Anda cipta galeri sendiri.</strong> Masukkan kod, isi
            butiran majlis (jenis, tajuk, tarikh, venue, ucapan) dalam beberapa
            minit — tanpa perlu tunggu kami.
          </li>
          <li>
            <strong>Anda dapat QR.</strong> Sistem jana pautan peribadi
            <code> alunara.my/buku-tamu/nama-anda</code> + QR siap cetak. Letak
            atas meja majlis atau bagi kepada pengapit.
          </li>
          <li>
            <strong>Tetamu scan dan kongsi.</strong> Isi nama sahaja, pilih
            gambar, pilih warna film, tekan kongsi. Siap dalam beberapa saat.
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
              Lapan warna bergaya filem sebenar — Kodak Portra, Fuji Superia,
              CineStill dan lain-lain. Supaya semua gambar nampak satu nada,
              bukan campur-campur.
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
          <div className="bt-harga-kad bt-harga-kad--utama">
            <p className="bt-harga-tag">Dengan sewa meja</p>
            <p className="bt-harga-nama">Bundle Alunara</p>
            <p className="bt-harga-angka">
              +RM{HARGA.bundle}
              <span> atas pakej</span>
            </p>
            <ul className="bt-harga-senarai">
              <li>Untuk client sewa meja &amp; kerusi ALUNARA</li>
              <li>1 majlis, 1 kod QR</li>
              <li>Gambar tanpa had</li>
              <li>8 filter film stock</li>
              <li>Ucapan &amp; doa tetamu</li>
              <li>Galeri aktif 90 hari</li>
              <li>Kod &amp; QR siap sebelum majlis</li>
            </ul>
          </div>

          <div className="bt-harga-kad">
            <p className="bt-harga-nama">Buku tamu sahaja</p>
            <p className="bt-harga-angka">
              RM{HARGA.standalone}
              <span> sekali</span>
            </p>
            <ul className="bt-harga-senarai">
              <li>Tanpa sewa meja</li>
              <li>Produk sama — tiada ciri dikurangkan</li>
              <li>1 majlis, 1 kod QR</li>
              <li>Gambar tanpa had</li>
              <li>8 filter film stock</li>
              <li>Ucapan &amp; doa tetamu</li>
              <li>Galeri aktif 90 hari</li>
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
            Galeri aktif 90 hari dari tarikh majlis. Selepas itu muat naik
            ditutup; gambar lama masih ada dengan kami.
          </dd>

          <dt>Siapa yang muat turun gambar?</dt>
          <dd>
            Anda. Kami sediakan butang muat turun di panel ALUNARA supaya anda
            boleh simpan semua gambar sendiri.
          </dd>

          <dt>Gambar saya disimpan di mana?</dt>
          <dd>
            Dalam storan awan peribadi, bukan di laman web awam. Setiap gambar
            dibuka guna pautan bertandatangan yang luput dalam sejam — jadi
            tiada sesiapa boleh teka pautan dan tengok gambar majlis anda.
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
          <a className="bt-btn bt-btn--halus" href={waLink(MSG.bukuTamu)} target="_blank" rel="noreferrer noopener">
            WhatsApp kami
          </a>
        </div>
      </section>

      <section className="bt-bahagian bt-cta">
        <h2>Sudah ada kod majlis?</h2>
        <p className="bt-info">
          Kalau kami dah hantar kod (cth. <code>AB23CD45</code>) selepas bayaran,
          klik di bawah untuk cipta galeri anda dan isi butiran majlis sendiri —
          dalam masa beberapa minit.
        </p>
        <div className="bt-hero-aksi">
          <Link className="bt-btn" to="/buku-tamu/buat">
            Cipta galeri saya
          </Link>
        </div>
        <p className="bt-info bt-info--kecil">
          Tiada kod? <Link to="/tempah" className="bt-pautan">Tempah buku tamu di sini</Link>.
        </p>
      </section>

      <footer className="bt-kaki">
        <p>Buku tamu oleh ALUNARA · Melaka</p>
      </footer>
    </div>
  )
}
