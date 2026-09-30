/**
 * Pangkalan data untuk /admin ALUNARA.
 *
 * KENAPA REST, BUKAN SDK SUPABASE
 *   Projek ini tak ada `@supabase/supabase-js` dalam dependencies (sengaja —
 *   laman awam tak perlu langsung). Untuk panel admin dalaman, panggilan REST
 *   terus cukup: kurang satu dependency, bundle awam tak naik.
 *
 * KESELAMATAN — apa yang melindungi data
 *   1. Log masuk sebenar (Supabase Auth, email + kata laluan). Bukan kod
 *      hardcoded macam panel lama.
 *   2. RLS di jadual alunara_* hanya benarkan pengguna dengan
 *      profiles.role = 'admin'. Walaupun seseorang curi anon key (memang
 *      awam), dia tetap tak nampak satu baris pun tanpa log masuk.
 *   Initiatif ini TIDAK menghalang: sesiapa yang tahu kredensial boleh masuk.
 *   Jaga kata laluan akaun admin; jangan kongsi.
 *
 * TOKEN disimpan dalam localStorage (bukan cookie) — bermakna XSS = token
 * dicuri. Kita tak render HTML mentah dari input pengguna, jadi risiko ini
 * sama tahap dengan kebanyakan panel admin SPA.
 */

const URL_BASE = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''
const SESI_KEY = 'alunara_admin_sesi_v1'

export const dbSedia = Boolean(URL_BASE && ANON)

export type Sesi = {
  access_token: string
  refresh_token: string
  /** Epoch saat (detik) token luput. */
  luput: number
  email: string
}

export type Booking = {
  id: string
  event_date: string
  customer_name: string
  customer_phone: string | null
  event_type: string | null
  package_tier: string | null
  package_id: string | null
  addon: boolean
  theme: string | null
  location: string | null
  venue: string | null
  setup_time: string | null
  notes: string | null
  status: string
  total_amount: number
  deposit_amount: number
  paid_amount: number
  client_id: string | null
  created_at: string
}

export type Entri = {
  id: string
  event_id: string
  guest_id: string | null
  storage_path: string
  width: number | null
  height: number | null
  bytes: number | null
  stock: string
  stock_strength: number
  hidden: boolean
  hidden_reason: string | null
  created_at: string
  /** Dari join `alunara_guestbook_guests` — bukan lajur jadual photos. */
  alunara_guestbook_guests?: { name: string | null; wish: string | null } | null
}

/** Media generic (v2) — foto + video + voice note. */
export type Media = {
  id: string
  event_id: string
  guest_id: string | null
  storage_path: string
  media_type: 'photo' | 'video' | 'voice'
  mime_type: string | null
  width: number | null
  height: number | null
  bytes: number | null
  duration_sec: number | null
  stock: string
  stock_strength: number
  hidden: boolean
  hidden_reason: string | null
  created_at: string
  alunara_guestbook_guests?: { name: string | null; wish: string | null } | null
}

export type Galeri = {
  id: string
  slug: string
  nickname: string
  title: string
  event_type: string
  event_date: string | null
  venue: string | null
  welcome_label: string | null
  welcome_message: string | null
  theme: string
  cover_path: string | null
  owner_name: string | null
  owner_phone: string | null
  active: boolean
  is_pro: boolean
  upload_until: string
  created_at: string
  updated_at: string
}

export type UnlockCode = {
  id: string
  code: string
  gallery_id: string | null
  is_pro: boolean
  notes: string | null
  expires_at: string
  used_at: string | null
  created_at: string
}

export type Majlis = {
  id: string
  code: string
  title: string
  host_name: string | null
  event_date: string | null
  active: boolean
  upload_until: string
  allowed_stocks: string[] | null
  max_uploads_per_guest: number
  notes: string | null
  created_at: string
  updated_at: string
  // v2 — sub-event dalam gallery
  gallery_id: string | null
  event_type: string | null
  venue: string | null
  label: string | null
}

export type Klien = {
  id: string
  name: string
  phone: string | null
  email: string | null
  source: string | null
  area: string | null
  notes: string | null
  created_at: string
}

export type Lead = {
  id: string
  name: string
  phone: string | null
  event_date: string | null
  event_type: string | null
  interest: string | null
  source: string | null
  source_page: string | null
  notes: string | null
  status: string
  created_at: string
}

/* ------------------------------ SESI ------------------------------ */

export function bacaSesi(): Sesi | null {
  try {
    const raw = localStorage.getItem(SESI_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Sesi
    return s?.access_token ? s : null
  } catch {
    return null
  }
}

function simpanSesi(s: Sesi | null) {
  if (s) localStorage.setItem(SESI_KEY, JSON.stringify(s))
  else localStorage.removeItem(SESI_KEY)
}

export function logKeluar() {
  const s = bacaSesi()
  if (s) {
    // Best-effort: batal token di pelayan. Kalau gagal pun sesi tempatan dibuang.
    void fetch(`${URL_BASE}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}` },
    }).catch(() => undefined)
  }
  simpanSesi(null)
}

/** Tukar refresh_token jadi access_token baru. */
async function segarkan(s: Sesi): Promise<Sesi | null> {
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: s.refresh_token }),
  })
  if (!r.ok) {
    simpanSesi(null)
    return null
  }
  const j = (await r.json()) as { access_token: string; refresh_token: string; expires_in: number; user?: { email?: string } }
  const baru: Sesi = {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    luput: Math.floor(Date.now() / 1000) + (j.expires_in ?? 3600),
    email: j.user?.email ?? s.email,
  }
  simpanSesi(baru)
  return baru
}

/** Sesi yang masih sah (disegarkan jika luput dalam 60 saat). */
export async function sesiSah(): Promise<Sesi | null> {
  const s = bacaSesi()
  if (!s) return null
  if (s.luput - 60 > Math.floor(Date.now() / 1000)) return s
  return segarkan(s)
}

/** Log masuk. Ralat dikembalikan sebagai teks Melayu, bukan dibuang. */
export async function logMasuk(email: string, kataLaluan: string): Promise<{ ok: boolean; ralat?: string }> {
  if (!dbSedia) return { ok: false, ralat: 'VITE_SUPABASE_URL / ANON_KEY tak diset.' }
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: kataLaluan }),
  })
  const j = (await r.json().catch(() => ({}))) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    user?: { email?: string }
    error_description?: string
    msg?: string
    error?: string
  }
  if (!r.ok || !j.access_token) {
    const m = String(j.error_description ?? j.msg ?? j.error ?? '')
    if (/invalid login/i.test(m)) return { ok: false, ralat: 'Email atau kata laluan salah.' }
    if (/email not confirmed/i.test(m)) return { ok: false, ralat: 'Email belum disahkan.' }
    return { ok: false, ralat: m || `Log masuk gagal (HTTP ${r.status}).` }
  }
  simpanSesi({
    access_token: j.access_token,
    refresh_token: j.refresh_token ?? '',
    luput: Math.floor(Date.now() / 1000) + (j.expires_in ?? 3600),
    email: j.user?.email ?? email,
  })
  return { ok: true }
}

/**
 * Sahkan pengguna ni benar-benar admin.
 * RLS sudah menghalang data, tetapi semakan ini memberi mesej yang jelas
 * ("akaun ini bukan admin") dan bukan senarai kosong yang mengelirukan.
 */
export async function sahkanAdmin(): Promise<{ ok: boolean; ralat?: string }> {
  const s = await sesiSah()
  if (!s) return { ok: false, ralat: 'Sesi tamat. Log masuk semula.' }
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: apiHeader(s),
    body: '{}',
  })
  if (!r.ok) return { ok: false, ralat: `Semakan admin gagal (HTTP ${r.status}).` }
  const val = (await r.json()) as boolean
  return val ? { ok: true } : { ok: false, ralat: 'Akaun ini tiada peranan admin.' }
}

/* --------------------------- AKSES TABEL --------------------------- */

function apiHeader(s: Sesi, extra: Record<string, string> = {}) {
  return {
    apikey: ANON,
    Authorization: `Bearer ${s.access_token}`,
    'content-type': 'application/json',
    ...extra,
  }
}

async function minta<T>(
  s: Sesi,
  laluan: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; data?: T; ralat?: string }> {
  const r = await fetch(`${URL_BASE}/rest/v1/${laluan}`, {
    ...init,
    headers: apiHeader(s, (init.headers as Record<string, string>) ?? {}),
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    if (r.status === 401) return { ok: false, ralat: 'Sesi tamat. Log masuk semula.' }
    if (r.status === 403) return { ok: false, ralat: 'Tiada kebenaran (RLS tolak).' }
    return { ok: false, ralat: `HTTP ${r.status}: ${t.slice(0, 200)}` }
  }
  if (r.status === 204) return { ok: true }
  return { ok: true, data: (await r.json()) as T }
}

const KLIEN_KOL = 'id,name,phone,email,source,area,notes,created_at'
const BOOKING_KOL =
  'id,event_date,customer_name,customer_phone,event_type,package_tier,package_id,addon,theme,location,venue,setup_time,notes,status,total_amount,deposit_amount,paid_amount,client_id,created_at'
const LEAD_KOL =
  'id,name,phone,event_date,event_type,interest,source,source_page,notes,status,created_at'

export const db = {
  async klien(s: Sesi) {
    return minta<Klien[]>(s, `alunara_clients?select=${KLIEN_KOL}&order=name.asc`)
  },
  async tempahan(s: Sesi) {
    return minta<Booking[]>(
      s,
      `alunara_bookings?select=${BOOKING_KOL}&order=event_date.desc`,
    )
  },
  async leads(s: Sesi) {
    return minta<Lead[]>(s, `alunara_leads?select=${LEAD_KOL}&order=created_at.desc&limit=300`)
  },

  async tambahKlien(s: Sesi, k: Partial<Klien>) {
    return minta<Klien[]>(s, 'alunara_clients', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(k),
    })
  },
  async kemasKlien(s: Sesi, id: string, k: Partial<Klien>) {
    return minta<Klien[]>(s, `alunara_clients?id=eq.${id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(k),
    })
  },
  async buangKlien(s: Sesi, id: string) {
    return minta<void>(s, `alunara_clients?id=eq.${id}`, { method: 'DELETE' })
  },

  async tambahTempahan(s: Sesi, b: Partial<Booking>) {
    return minta<Booking[]>(s, 'alunara_bookings', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(b),
    })
  },
  async kemasTempahan(s: Sesi, id: string, b: Partial<Booking>) {
    return minta<Booking[]>(s, `alunara_bookings?id=eq.${id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(b),
    })
  },
  async buangTempahan(s: Sesi, id: string) {
    return minta<void>(s, `alunara_bookings?id=eq.${id}`, { method: 'DELETE' })
  },

  async kemasLead(s: Sesi, id: string, l: Partial<Lead>) {
    return minta<Lead[]>(s, `alunara_leads?id=eq.${id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(l),
    })
  },
  async buangLead(s: Sesi, id: string) {
    return minta<void>(s, `alunara_leads?id=eq.${id}`, { method: 'DELETE' })
  },

  /* ------------------------------ BUKU TAMU ------------------------------
   * Admin buat `majlis` (satu majlis = satu kod QR). Tetamu upload gambar
   * melalui halaman /buku-tamu/:kod. Gambar disimpan dalam bucket privat;
   * admin nampak melalui signed URL (jana di /api/guestbook-sign).
   */
  async majlis(s: Sesi) {
    return minta<Majlis[]>(
      s,
      'alunara_guestbook_events?select=*&order=created_at.desc&limit=200',
    )
  },
  /** Jana kod 6 aksara yang tak berlanggar (fungsi SQL, bukan Math.random). */
  async kodMajlis(s: Sesi) {
    return minta<string>(s, 'rpc/alunara_guestbook_new_code', {
      method: 'POST',
      body: '{}',
    })
  },
  async tambahMajlis(s: Sesi, m: Partial<Majlis>) {
    return minta<Majlis[]>(s, 'alunara_guestbook_events', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(m),
    })
  },
  async kemasMajlis(s: Sesi, id: string, m: Partial<Majlis>) {
    return minta<Majlis[]>(s, `alunara_guestbook_events?id=eq.${id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(m),
    })
  },
  async buangMajlis(s: Sesi, id: string) {
    return minta<void>(s, `alunara_guestbook_events?id=eq.${id}`, { method: 'DELETE' })
  },
  /**
   * Media satu majlis (v2) — foto + video + suara, join nama/ucapan tetamu.
   *
   * KENAPA BUKAN `alunara_guestbook_photos`
   *   Jadual photos itu skema v1. Buku tamu v2 tulis ke
   *   `alunara_guestbook_media`, jadi kalau panel baca photos, tetamu yang
   *   kongsi video atau nota suara TAK PERNAH muncul di /admin — bukan bug
   *   paparan, data memang di jadual lain. (Migrasi v2 memang menyalin foto
   *   lama ke media; selepas itu photos tak lagi ditulis.)
   */
  async entri(s: Sesi, eventId: string) {
    return minta<Media[]>(
      s,
      `alunara_guestbook_media?event_id=eq.${eventId}` +
        `&select=*,alunara_guestbook_guests(name,wish)` +
        `&order=created_at.desc&limit=500`,
    )
  },
  /** Sembunyi / tunjuk semula entri (moderation, bukan padam). */
  async kemasEntri(s: Sesi, id: string, e: Partial<Media>) {
    return minta<Media[]>(s, `alunara_guestbook_media?id=eq.${id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(e),
    })
  },

  /* --------------------------- BUKU TAMU v2 ---------------------------
   * Gallery (boleh banyak sub-event) + media generic + unlock code.
   */
  async galeri(s: Sesi) {
    return minta<Galeri[]>(
      s,
      'alunara_guestbook_galleries?select=*&order=created_at.desc&limit=200',
    )
  },
  async galeriEvent(s: Sesi, galleryId: string) {
    return minta<Majlis[]>(
      s,
      `alunara_guestbook_events?gallery_id=eq.${galleryId}&select=*&order=event_date.asc`,
    )
  },
  /** Tambah sub-event (nikah, resepsi lelaki, resepsi wanita) ke gallery v2. */
  async tambahSubEvent(
    s: Sesi,
    galleryId: string,
    sub: { label: string; event_type?: string; title?: string; event_date?: string; venue?: string },
  ) {
    return minta<string>(s, 'rpc/alunara_gb_add_sub_event', {
      method: 'POST',
      body: JSON.stringify({
        p_gallery_id: galleryId,
        p_label: sub.label,
        p_event_type: sub.event_type ?? 'wedding',
        p_title: sub.title ?? null,
        p_event_date: sub.event_date ?? null,
        p_venue: sub.venue ?? null,
      }),
    })
  },
  async unlockCodes(s: Sesi) {
    return minta<UnlockCode[]>(
      s,
      'alunara_guestbook_unlock_codes?select=*&order=created_at.desc&limit=200',
    )
  },
  /** Jana unlock code baru (admin sahaja — RPC security definer). */
  async janaUnlockCode(s: Sesi, isPro = false, notes = '') {
    return minta<string>(s, 'rpc/alunara_gb_new_unlock_code', {
      method: 'POST',
      body: JSON.stringify({ p_is_pro: isPro, p_notes: notes || null }),
    })
  },
  /** Media satu gallery (ikut filter media_type + event_type). */
  async mediaGaleri(s: Sesi, _slug: string) {
    return minta<Media[]>(
      s,
      `alunara_guestbook_media?select=*,alunara_guestbook_guests(name,wish)&order=created_at.desc&limit=500`,
    )
  },
}

/* --------------------------- TARIKH SIBUK ---------------------------
 * Panel admin TIDAK boleh bergantung pada RPC awam
 * (alunara_public_booked_dates) kerana fungsi itu menapis tarikh lampau.
 * Admin perlu nampak semua, termasuk tarikh yang dah berlalu.
 * ------------------------------------------------------------------ */
export function tarikhSibukSet(tempahan: Booking[]): Set<string> {
  return new Set(
    tempahan.filter((b) => b.status !== 'cancelled').map((b) => b.event_date.slice(0, 10)),
  )
}
