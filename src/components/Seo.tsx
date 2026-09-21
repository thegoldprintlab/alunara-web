import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * SEO ringkas — set <title>, meta description, canonical & og:title/url
 * ikut laluan semasa. Tanpa dependency tambahan (SPA ringan).
 * Kalau tambah halaman baru, tambah entri dalam META di bawah.
 */
type Meta = { title: string; desc: string }

const META: Record<string, Meta> = {
  '/': {
    title: 'ALUNARA · Sewa Meja & Kerusi Bertema Melaka | Pakej dari RM109',
    desc: 'Sewa meja & kerusi bertema di Melaka. Pakej dari RM109 termasuk meja hidangan, sarung kerusi, hantar & setup. Tema Rustic, Minimalist, Floral. 1 Tarikh, 1 Majlis.',
  },
  '/pakej': {
    title: 'Pakej & Harga Sewa Meja Kerusi Melaka | ALUNARA',
    desc: 'Pakej Sari RM109 (1 meja + 6 kerusi), Bayu RM149 (2 meja + 12 kerusi), Anggun RM199 (3 meja + 18 kerusi). Meja hidangan percuma, hantar & setup termasuk.',
  },
  '/tema': {
    title: 'Tema Rustic, Minimalist & Floral | ALUNARA Melaka',
    desc: 'Tiga tema meja & kerusi siap digayakan untuk majlis anda di Melaka — Rustic, Minimalist dan Floral. Lihat contoh setup sebenar.',
  },
  '/tema/rustic': {
    title: 'Tema Rustic — Sewa Meja Kerusi Kenduri Melaka | ALUNARA',
    desc: 'Tema Rustic ALUNARA — ton bumi hangat untuk kenduri, majlis keluarga dan makan-makan santai di Melaka. Pakej dari RM109.',
  },
  '/tema/minimalist': {
    title: 'Tema Minimalist — Sewa Meja Kerusi Majlis Formal Melaka | ALUNARA',
    desc: 'Tema Minimalist ALUNARA — bersih, elegan dan tak sesak. Sesuai untuk pertunangan, doa selamat dan majlis formal di Melaka.',
  },
  '/tema/floral': {
    title: 'Tema Floral — Sewa Meja Kerusi Hari Jadi Melaka | ALUNARA',
    desc: 'Tema Floral ALUNARA — segar, ceria dan penuh warna. Sesuai untuk hari jadi, aqiqah dan baby shower di Melaka.',
  },
  '/galeri': {
    title: 'Galeri Setup Meja & Kerusi Bertema Melaka | ALUNARA',
    desc: 'Gambar setup meja dan kerusi bertema ALUNARA yang telah siap di Melaka — Rustic, Minimalist dan Floral.',
  },
  '/harga-hantar': {
    title: 'Caj Penghantaran Melaka — 10km Percuma | ALUNARA',
    desc: 'Penghantaran PERCUMA dalam 10 km dari Taman Rambai Jaya, Melaka. Melebihi 10 km: RM20 + RM1 setiap km berikutnya.',
  },
  '/checklist': {
    title: 'Checklist Pelan Majlis Percuma (PDF) | ALUNARA Melaka',
    desc: 'Checklist pelan majlis percuma daripada ALUNARA — senarai semak untuk birthday, tunang dan kenduri. Muat turun PDF.',
  },
  '/hubungi': {
    title: 'Hubungi ALUNARA — WhatsApp 018-956 4604 | Sewa Meja Melaka',
    desc: 'Hubungi ALUNARA untuk semak tarikh kosong dan tempah sewa meja & kerusi bertema di Melaka. WhatsApp 018-956 4604.',
  },
  '/tempah': {
    title: 'Semak Tarikh Kosong & Tempah | ALUNARA Melaka',
    desc: 'Semak kalendar tarikh kosong ALUNARA dan tempah tarikh majlis anda di Melaka. Deposit RM50 untuk lock tarikh.',
  },
}

const NOINDEX = ['/admin']

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export default function Seo() {
  const { pathname } = useLocation()

  useEffect(() => {
    const m = META[pathname]
    const origin = 'https://alunara.my'
    const url = origin + pathname

    if (NOINDEX.includes(pathname)) {
      setMeta('name', 'robots', 'noindex, nofollow')
      document.title = 'Admin | ALUNARA'
      return
    }

    setMeta('name', 'robots', 'index, follow, max-image-preview:large')
    setCanonical(url)

    if (!m) return
    document.title = m.title
    setMeta('name', 'description', m.desc)
    setMeta('property', 'og:title', m.title)
    setMeta('property', 'og:description', m.desc)
    setMeta('property', 'og:url', url)
  }, [pathname])

  return null
}
