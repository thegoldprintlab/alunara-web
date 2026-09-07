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
