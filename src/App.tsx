import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, type ReactNode } from 'react'
import Nav from './components/Nav'
import Footer from './components/Footer'
import StickyWa from './components/StickyWa'
import Seo from './components/Seo'
import AnalyticsTracker from './components/AnalyticsTracker'
import Home from './pages/Home'
import { TemaIndex, TemaDetail } from './pages/Tema'
import Pakej from './pages/Pakej'
import Galeri from './pages/Galeri'
import HargaHantar from './pages/HargaHantar'
import Hubungi from './pages/Hubungi'
import Checklist from './pages/Checklist'
import BukuTamu from './pages/BukuTamu'
import BukuTamuMula from './pages/BukuTamuMula'
import BukuTamuBuat from './pages/BukuTamuBuat'
import Tempah from './pages/Tempah'
import Admin from './pages/Admin'
import './App.css'
import './pages/Admin.css'

/**
 * Scroll ke atas setiap kali tukar halaman.
 *
 * `key` (bukan `pathname`) — sebab klik pautan footer ke halaman yang SAMA
 * (cth. di /pakej, klik "Sari · RM109" yang juga pergi ke /pakej) tak ubah
 * pathname, jadi skrin kekal di bawah dan orang sangka butang tak berfungsi.
 * location.key berubah pada setiap navigasi, jadi kes itu pun di-scroll atas.
 */
function ScrollTop() {
  const { key, hash } = useLocation()
  useEffect(() => {
    // Pautan footer pakej bawa #pakej-<id> — pergi terus ke kad itu, bukan atas.
    if (hash) {
      const el = document.querySelector(hash)
      if (el) {
        el.scrollIntoView({ block: 'center' })
        return
      }
    }
    window.scrollTo(0, 0)
  }, [key, hash])
  return null
}

/**
 * Panel admin guna susun atur sendiri — nav awam, footer dan butang
 * WhatsApp terapung cuma jadi bunyi bising (dan butang WhatsApp di atas
 * jadual tempahan boleh tersalah tekan). Jadi ia disembunyikan di /admin.
 */
function SusunAtur({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const dalamAdmin = pathname.startsWith('/admin')

  return (
    <div className={'site' + (dalamAdmin ? ' site--admin' : '')}>
      {!dalamAdmin && <Nav />}
      <main id="kandungan">{children}</main>
      {!dalamAdmin && (
        <>
          <Footer />
          <StickyWa />
        </>
      )}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollTop />
      <Seo />
      <AnalyticsTracker />
      <SusunAtur>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tema" element={<TemaIndex />} />
          <Route path="/tema/:id" element={<TemaDetail />} />
          <Route path="/pakej" element={<Pakej />} />
          <Route path="/galeri" element={<Galeri />} />
          <Route path="/harga-hantar" element={<HargaHantar />} />
          <Route path="/checklist" element={<Checklist />} />
          <Route path="/hubungi" element={<Hubungi />} />
          {/* Buku tamu — self-serve create mesti DIATAS :kod supaya "buat"
              tak dianggap sebagai kod majlis. */}
          <Route path="/buku-tamu/buat" element={<BukuTamuBuat />} />
          {/* Buku tamu — tetamu buka dari QR. Tiada log masuk. */}
          <Route path="/buku-tamu/:kod" element={<BukuTamu />} />
          {/* Tanpa kod = halaman penerangan produk. URL ini juga yang orang
              taip untuk cari tahu apa itu buku tamu, jadi ia mesti jual,
              bukan tunjuk ralat. */}
          <Route path="/buku-tamu" element={<BukuTamuMula />} />
          <Route path="/tempah" element={<Tempah />} />
          {/* Panel dalaman — log masuk Supabase Auth + RLS admin. */}
          <Route path="/admin" element={<Admin />} />
          {/* Route lama — redirect supaya link/bio yang dah diedar tak mati */}
          <Route path="/book" element={<Navigate to="/tempah" replace />} />
          <Route path="/gallery" element={<Navigate to="/galeri" replace />} />
          <Route path="/contact" element={<Navigate to="/hubungi" replace />} />
          <Route path="/payment" element={<Navigate to="/hubungi" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SusunAtur>
    </BrowserRouter>
  )
}
