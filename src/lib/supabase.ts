import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, anon)

export const MEDIA_BASE = `${url}/storage/v1/object/public/alunara-media`

export interface Booking {
  id: string
  event_date: string
  customer_name: string
  customer_phone: string
  event_type: string
  package_tier: string
  location: string
  notes: string
  status: string
}

export interface GalleryItem {
  id: string
  media_type: 'photo' | 'video'
  url: string
  caption: string
  sort_order: number
}

export interface Settings {
  [key: string]: string
}

// Fetch all non-cancelled booked dates so the calendar can lock them out.
export async function getBookedDates(): Promise<string[]> {
  const { data, error } = await supabase
    .from('alunara_bookings')
    .select('event_date')
    .in('status', ['pending', 'confirmed'])
  if (error) {
    console.error('getBookedDates', error)
    return []
  }
  return (data ?? []).map((r) => r.event_date)
}

export async function getGallery(): Promise<GalleryItem[]> {
  const { data, error } = await supabase
    .from('alunara_gallery')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) {
    console.error('getGallery', error)
    return []
  }
  return (data ?? []) as GalleryItem[]
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase.from('alunara_settings').select('*')
  if (error) {
    console.error('getSettings', error)
    return {}
  }
  const out: Settings = {}
  for (const row of data ?? []) out[row.key] = row.value
  return out
}

export async function submitBooking(input: {
  event_date: string
  customer_name: string
  customer_phone: string
  event_type: string
  package_tier: string
  location: string
  notes: string
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { data, error } = await supabase
    .from('alunara_bookings')
    .insert([{ ...input, status: 'pending' }])
    .select('id')
    .single()

  if (error) {
    // unique violation = date already taken
    if (error.code === '23505') {
      return { ok: false, error: 'Tarikh ini baru sahaja ditempah. Sila pilih tarikh lain.' }
    }
    return { ok: false, error: error.message }
  }
  return { ok: true, id: data.id }
}

// ---------- Admin (secret-gated via RPC) ----------

export async function adminVerify(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('alunara_verify_admin', { p_code: code })
  if (error) return false
  return data === true
}

export async function adminBlockDate(input: {
  code: string
  date: string
  name: string
  pkg: string
  phone: string
  notes: string
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('alunara_admin_block_date', {
    p_code: input.code,
    p_date: input.date,
    p_customer_name: input.name || 'Tempahan Manual',
    p_package: input.pkg || 'bayu',
    p_phone: input.phone,
    p_notes: input.notes,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function adminListBookings(code: string): Promise<Booking[]> {
  const { data, error } = await supabase.rpc('alunara_admin_list_bookings', { p_code: code })
  if (error) {
    console.error('adminListBookings', error)
    return []
  }
  return (data ?? []) as Booking[]
}

export async function adminSetStatus(
  code: string,
  id: string,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('alunara_admin_set_status', {
    p_code: code,
    p_id: id,
    p_status: status,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
