/**
 * Lead capture untuk checklist & katalog percuma di laman ALUNARA.
 *
 * Aliran sekarang:
 *  1. Pelawat isi borang (nama + no. WhatsApp + tarikh majlis + jenis majlis).
 *  2. Lead dihantar ke `/api/lead` (fungsi serverless dalam repo ini) yang
 *     terus hantar mesej ke Telegram bot @Jojobotobot → bos dapat notifikasi.
 *  3. Lead SALINAN disimpan dalam localStorage browser pelawat (key
 *     `alunara_lead_v1`) supaya kalau Telegram/hantar gagal, data tak hilang.
 *
 * Token bot TIDAK pernah ada di sini — ia duduk dalam env Vercel dan hanya
 * dibaca oleh `/api/lead`. Frontend cuma tahu URL relatif.
 */
export type Lead = {
  nama: string
  telefon: string
  tarikh: string
  jenis: string
  lokasi?: string
  /** Pakej (katalog) atau nama checklist yang dimuat turun. */
  checklist: string
  /** 'checklist' | 'katalog' */
  sumber?: string
  asal: string
  masa: string
}

const KEY = 'alunara_lead_v1'

/** Endpoint serverless sendiri. Boleh ganti guna VITE_LEAD_ENDPOINT kalau perlu. */
const ENDPOINT = (import.meta.env.VITE_LEAD_ENDPOINT as string | undefined) || '/api/lead'

/** Baca semua lead yang tersimpan dalam browser ini. */
export function bacaLead(): Lead[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? (arr as Lead[]) : []
  } catch {
    return []
  }
}

/**
 * Simpan lead: localStorage dahulu (supaya tak hilang walau rangkaian gagal),
 * kemudian hantar ke `/api/lead` untuk notifikasi Telegram.
 *
 * `navigator.sendBeacon` dipilih sebab ia tak disekat ad-blocker macam fetch
 * biasa dan tak menghalang pelawat. Kalau browser tak sokong, jatuh balik ke
 * fetch + keepalive.
 */
export function hantarLead(lead: Omit<Lead, 'masa'>): void {
  const penuh: Lead = { ...lead, masa: new Date().toISOString() }

  try {
    const sedia = bacaLead()
    sedia.push(penuh)
    localStorage.setItem(KEY, JSON.stringify(sedia.slice(-200)))
  } catch {
    /* mode private / storage penuh — jangan halang pelawat dapat PDF */
  }

  if (!ENDPOINT || typeof navigator === 'undefined') return

  const body = JSON.stringify(penuh)
  try {
    if ('sendBeacon' in navigator) {
      const blob = new Blob([body], { type: 'application/json' })
      const ok = navigator.sendBeacon(ENDPOINT, blob)
      if (ok) return
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      /* senyap — lead tetap ada dalam localStorage */
    })
  } catch {
    /* senyap — lead tetap ada dalam localStorage */
  }
}

/** '2026-11-14' -> '14 November 2026' (BM, mesra pengguna). */
export function tarikhMesra(iso: string): string {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('ms-MY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Nombor Malaysia: buang bukan digit, terima 9–11 digit (01x… atau 60x…). */
export function telefonSah(v: string): boolean {
  const d = v.replace(/\D/g, '')
  if (d.startsWith('60')) return d.length >= 11 && d.length <= 13
  return d.length >= 9 && d.length <= 11
}

/** Tarikh hari ini sebagai YYYY-MM-DD (waktu tempatan, bukan UTC). */
export function hariIni(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const t = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${t}`
}
