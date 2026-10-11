/**
 * Attribution — tahu lead datang dari Threads, IG, TikTok, FB atau terus.
 *
 * MASALAH: satu nombor WhatsApp & satu laman web, tapi lead masuk dari banyak
 * saluran. Tanpa tag, semua lead nampak sama dan bos tak tahu saluran mana
 * berbaloi. Ini yang buat keputusan promosi jadi meneka.
 *
 * PENYELESAIAN — dua lapis:
 *
 *  1. TAG MESEJ WHATSAPP (`[TH]`, `[IG]`, `[TT]`…)
 *     Setiap pautan wa.me yang diedar di platform berbeza bawa tag dalam mesej
 *     pembuka. Customer nampak ayat biasa; bos nampak tag di baris pertama.
 *     Berfungsi walaupun customer tak melalui laman web. Guna `waLinkTag()`.
 *
 *  2. UTM PADA PAUTAN BIO (`?s=threads`)
 *     Pautan bio / poster / QR di platform berbeza bawa `?s=<platform>`.
 *     Nilai itu disimpan dalam localStorage dan dilekatkan pada setiap lead
 *     borang (checklist/katalog), jadi lead borang pun boleh dijejak.
 *
 * Gabungan kedua-duanya menutup semua jalan masuk: link langsung (WA) dan
 * lead borang (laman web).
 */

/** Saluran yang dikenali. Nama ini yang muncul dalam Telegram & DB. */
export type Saluran = 'threads' | 'ig' | 'tiktok' | 'fb' | 'youtube' | 'web' | 'langsung'

/** Kod pendek — muat dalam mesej WhatsApp tanpa nampak pelik. */
export const KOD: Record<Saluran, string> = {
  threads: 'TH',
  ig: 'IG',
  tiktok: 'TT',
  fb: 'FB',
  youtube: 'YT',
  web: 'WEB',
  langsung: 'TERUS',
}

/** Nama mesra untuk paparan Telegram (bos baca ini). */
export const NAMA: Record<Saluran, string> = {
  threads: 'Threads',
  ig: 'Instagram',
  tiktok: 'TikTok',
  fb: 'Facebook',
  youtube: 'YouTube',
  web: 'Laman web',
  langsung: 'Terus (taip nombor)',
}

export const LABEL: Record<Saluran, string> = {
  threads: '🧵',
  ig: '📸',
  tiktok: '🎵',
  fb: '👥',
  youtube: '▶️',
  web: '🌐',
  langsung: '📱',
}

const SEMUA: Saluran[] = ['threads', 'ig', 'tiktok', 'fb', 'youtube', 'web', 'langsung']

const KEY = 'alunara:saluran'

/** Terima pelbagai ejaan: 'ig', 'instagram', 'insta' → 'ig'. */
export function normalSaluran(v: string | null | undefined): Saluran | null {
  if (!v) return null
  const s = v.toLowerCase().trim()
  const peta: Record<string, Saluran> = {
    th: 'threads', threads: 'threads', thread: 'threads',
    ig: 'ig', insta: 'ig', instagram: 'ig',
    tt: 'tiktok', tiktok: 'tiktok', tik: 'tiktok',
    fb: 'fb', facebook: 'fb',
    yt: 'youtube', youtube: 'youtube',
    web: 'web', laman: 'web', website: 'web',
    terus: 'langsung', langsung: 'langsung', direct: 'langsung',
  }
  return peta[s] ?? null
}

/**
 * Baca saluran dari URL semasa (?s=ig atau ?utm_source=ig), simpan dalam
 * localStorage supaya kekal walau pelawat navigasi ke halaman lain.
 *
 * Dipanggil SEKALI semasa muatan (lihat App.tsx). Kalau URL tiada parameter,
 * nilai lama dikekalkan — pelawat yang datang dari IG kemudian buka /pakej
 * masih dikira datang dari IG.
 */
export function tangkapSaluran(): Saluran | null {
  if (typeof window === 'undefined') return null
  try {
    const p = new URLSearchParams(window.location.search)
    const dariUrl =
      normalSaluran(p.get('s')) ??
      normalSaluran(p.get('utm_source')) ??
      normalSaluran(p.get('ref'))
    if (dariUrl) {
      localStorage.setItem(KEY, dariUrl)
      return dariUrl
    }
    return (localStorage.getItem(KEY) as Saluran | null) ?? null
  } catch {
    return null
  }
}

/** Saluran tersimpan (untuk dilampirkan pada lead borang). */
export function saluranTersimpan(): Saluran {
  if (typeof window === 'undefined') return 'web'
  try {
    const v = localStorage.getItem(KEY)
    return (SEMUA.includes(v as Saluran) ? (v as Saluran) : 'web')
  } catch {
    return 'web'
  }
}
