import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Nav from './components/Nav'
import Footer from './components/Footer'
import StickyWa from './components/StickyWa'
import Home from './pages/Home'
import { TemaIndex, TemaDetail } from './pages/Tema'
import Pakej from './pages/Pakej'
import Galeri from './pages/Galeri'
import HargaHantar from './pages/HargaHantar'
import Hubungi from './pages/Hubungi'
import Checklist from './pages/Checklist'
import Tempah from './pages/Tempah'
import Admin from './pages/Admin'
import './App.css'

/** Scroll ke atas setiap kali tukar halaman. */
function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollTop />
      <div className="site">
        <Nav />
        <main id="kandungan">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tema" element={<TemaIndex />} />
            <Route path="/tema/:id" element={<TemaDetail />} />
            <Route path="/pakej" element={<Pakej />} />
            <Route path="/galeri" element={<Galeri />} />
            <Route path="/harga-hantar" element={<HargaHantar />} />
            <Route path="/checklist" element={<Checklist />} />
            <Route path="/hubungi" element={<Hubungi />} />
            <Route path="/tempah" element={<Tempah />} />
            <Route path="/admin" element={<Admin />} />
            {/* Route lama — redirect supaya link/bio yang dah diedar tak mati */}
            <Route path="/book" element={<Navigate to="/tempah" replace />} />
            <Route path="/gallery" element={<Navigate to="/galeri" replace />} />
            <Route path="/contact" element={<Navigate to="/hubungi" replace />} />
            <Route path="/payment" element={<Navigate to="/hubungi" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
        <StickyWa />
      </div>
    </BrowserRouter>
  )
}
