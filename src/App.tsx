import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getSettings, type Settings } from './lib/supabase'
import Nav from './components/Nav'
import Footer from './components/Footer'
import Home from './pages/Home'
import Booking from './pages/Booking'
import Payment from './pages/Payment'
import Gallery from './pages/Gallery'
import Contact from './pages/Contact'
import './App.css'

export default function App() {
  const [settings, setSettings] = useState<Settings>({})

  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  return (
    <BrowserRouter>
      <div className="site">
        <Nav />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/book" element={<Booking />} />
            <Route path="/payment" element={<Payment settings={settings} />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/contact" element={<Contact settings={settings} />} />
          </Routes>
        </main>
        <Footer settings={settings} />
      </div>
    </BrowserRouter>
  )
}
