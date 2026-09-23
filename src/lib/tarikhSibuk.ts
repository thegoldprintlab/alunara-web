/**
 * Tarikh sibuk untuk kalendar awam /tempah.
 *
 * KENAPA BUKAN TERUS DARI JADUAL
 *   Jadual `alunara_bookings` menyimpan NAMA + NO. TELEFON pelanggan.
 *   Ia dilindungi RLS (admin sahaja). Jadi kalendar awam tak boleh baca
 *   jadual itu — ia panggil RPC `alunara_public_booked_dates()` yang
 *   memulangkan TARIKH sahaja.
 *
 * KENAPA MASIH ADA FALLBACK
 *   Kalau Supabase tak diset (build tanpa env) atau rangkaian gagal, kita
 *   jatuh balik ke senarai TARIKH_LOCK dalam src/content.ts. Kalendar mesti
 *   tetap berfungsi walaupun DB tak dapat dihubungi — lebih baik daripada
 *   papar semua tarikh sebagai kosong.
 */

const URL_BASE = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''

/** Tarikh (YYYY-MM-DD) yang dah ada tempahan aktif, ikut DB. */
export async function tarikhSibukDariDb(): Promise<string[] | null> {
  if (!URL_BASE || !ANON) return null
  try {
    const r = await fetch(`${URL_BASE}/rest/v1/rpc/alunara_public_booked_dates`, {
      method: 'POST',
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${ANON}`,
        'content-type': 'application/json',
      },
      body: '{}',
    })
    if (!r.ok) return null
    const arr = (await r.json()) as unknown
    if (!Array.isArray(arr)) return null
    return arr.filter((d): d is string => typeof d === 'string').map((d) => d.slice(0, 10))
  } catch {
    return null
  }
}
