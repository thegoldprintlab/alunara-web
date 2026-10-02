import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { initAnalytics, trackPageView } from '../lib/analytics'

/**
 * Hantar page_view ke Vercel Web Analytics pada setiap navigasi react-router,
 * dan sekali semasa muatan pertama.
 *
 * Mesti duduk DALAM <BrowserRouter> (ia baca useLocation). Tak render apa-apa.
 *
 * /admin SENGAJA dikecualikan: lawatan bos sendiri ke panel dalaman bukan
 * trafik pelanggan, dan ia akan mengembung angka pelawat dengan palsu.
 */
export default function AnalyticsTracker() {
  const location = useLocation()
  const sedia = useRef(false)

  useEffect(() => {
    if (!sedia.current) sedia.current = initAnalytics()
    if (!sedia.current) return
    if (location.pathname.startsWith('/admin')) return
    // pathname sahaja — query/hash dibuang supaya ?utm=... tak pecahkan laporan.
    trackPageView(location.pathname)
  }, [location.pathname])

  return null
}
