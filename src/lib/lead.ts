/**
 * Lead capture ringan untuk checklist percuma.
 *
 * Cara ia berfungsi (tiada backend baru):
 *  1. Setiap lead disimpan dalam localStorage browser pelawat (key: `alunara_lead_v1`),
 *     jadi kalau API mati, data masih ada dan boleh dihantar semula nanti.
 *  2. Kalau `VITE_LEAD_ENDPOINT` diset (contoh: endpoint Apps Script / serverless sendiri),
 *     lead dihantar ke sana guna `navigator.sendBeacon` — tak disekat oleh ad-blocker
 *     macam request fetch biasa.
 *  3. Kalau endpoint tak diset, lead DIKELUARKAN dari localStorage oleh Hermes
 *     (Chrome profil ~/.hermes-screenshots lewat Playwright) — jadi bos tetap nampak
 *     senarai lead tanpa perlu setup server.
 *
 * PENTING: data pelanggan (nama + telefon) tak pernah dihantar ke pihak ketiga.
 */
export type Lead = {
  nama: string
  telefon: string
  tarikh: string
  jenis: string
  lokasi?: string
  checklist: string
  asal: string
  masa: string
}

const KEY = 'alunara_lead_v1'
const ENDPOINT = (import.meta.env.VITE_LEAD_ENDPOINT as string | undefined) ?? ''

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

/** Simpan lead: localStorage dahulu, kemudian hantar ke endpoint kalau ada. */
export function hantarLead(lead: Omit<Lead, 'masa'>): void {
  const penuh: Lead = { ...lead, masa: new Date().toISOString() }

  try {
    const sedia = bacaLead()
    sedia.push(penuh)
    localStorage.setItem(KEY, JSON.stringify(sedia.slice(-200)))
  } catch {
    /* mode private / storage penuh — jangan halang pelawat dapat PDF */
  }

  if (ENDPOINT && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    try {
      const blob = new Blob([JSON.stringify(penuh)], { type: 'application/json' })
      navigator.sendBeacon(ENDPOINT, blob)
    } catch {
      /* senyap — lead tetap ada dalam localStorage */
    }
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
