/**
 * Vercel Web Analytics — kiraan pelawat untuk alunara.my.
 *
 * Kenapa Vercel, bukan Google Analytics:
 *   Laman ini tiada cookie dan tiada borang login, jadi tiada sebab untuk
 *   minta consent. Vercel Web Analytics memang cookieless — tiada apa-apa
 *   disimpan dalam peranti pelawat, jadi ia terus berfungsi tanpa banner
 *   (dan tanpa risiko GDPR/ePrivacy).
 *
 * Apa yang direkod: path halaman, hos rujukan, negara, jenis peranti/browser,
 * dan kiraan pelawat unik (hash harian, bukan id kekal).
 *
 * SKRIP: /_vercel/insights/script.js — disajikan oleh Vercel (same-origin).
 * Ia HANYA wujud bila Web Analytics dihidupkan untuk projek ini di dashboard
 * Vercel → Analytics → Enable.
 */

import { inject, pageview } from '@vercel/analytics'

/** Skrip hanya masuk pada hos sebenar — preview/localhost dikecualikan. */
const HOST_DIBENARKAN = ['alunara.my', 'www.alunara.my']

let sudahInject = false

function hosBetul(): boolean {
  if (typeof window === 'undefined') return false
  return HOST_DIBENARKAN.includes(window.location.hostname)
}

/**
 * Suntik skrip analytics. Senyap (no-op) bila bukan production atau hos bukan
 * laman sebenar — pemanggil tak perlu jaga apa-apa.
 */
export function initAnalytics(): boolean {
  if (!import.meta.env.PROD) return false
  if (!hosBetul()) return false
  if (sudahInject) return true
  inject({ mode: 'production' })
  sudahInject = true
  return true
}

/**
 * page_view manual untuk navigasi SPA. Tanpa ini Vercel cuma nampak muatan
 * pertama, jadi /pakej, /galeri, /tempah tak muncul sebagai halaman berasingan.
 */
export function trackPageView(path: string) {
  if (!sudahInject) return
  try {
    pageview({ path })
  } catch {
    // Analytics tak boleh sesekali memecahkan laman. Telan dan teruskan.
  }
}
