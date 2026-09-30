/**
 * uji-had-server.mjs — sahkan had 60s di RPC (bukan hanya di UI).
 *
 * KENAPA: had di UI boleh lulus tetapi RPC masih terima apa-apa nilai. Ujian
 * ini panggil RPC terus dengan durasi 75s dan 30s, dan laporkan mesej ralat.
 * Guna majlis BUANGAN sahaja (default CUBA24).
 *
 * CARA GUNA:
 *   cd ~/alunara-web
 *   PG_PW='<password DB>' node scripts/uji-had-server.mjs [slug]
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const REF = 'sdzjlekydkwtxjjtrwrh'
const slug = process.argv[2] || 'CUBA24'

// Guna env .env.local untuk panggilan RPC (anon key awam — bukan rahsia).
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const baca = (k) => new RegExp(`^${k}=(.*)$`, 'm').exec(env)?.[1]?.trim()
const URL_ = baca('VITE_SUPABASE_URL')
const ANON = baca('VITE_SUPABASE_ANON_KEY')
if (!URL_ || !ANON) {
  console.error('.env.local tak lengkap (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)')
  process.exit(1)
}

async function rpc(nama, args) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${nama}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  })
  return { status: r.status, data: await r.json().catch(() => null) }
}

// 1. Daftar tetamu (dapatkan sesi).
const join = await rpc('alunara_gb_join', { p_slug: slug, p_name: 'Uji Had Server', p_wish: null })
if (join.status !== 200) {
  console.error('join gagal:', JSON.stringify(join.data))
  process.exit(1)
}
const sesi = join.data
console.log('sesi:', sesi.slice(0, 8) + '…')

// 2. Dapatkan event_id dari DB supaya laluan fail sah (mesti prefix event uuid).
const pw = process.env.PG_PW
if (!pw) {
  console.error('PG_PW tak set — perlu untuk cari event_id.')
  process.exit(1)
}
const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 6543,
  user: `postgres.${REF}`,
  password: pw,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})
await c.connect()
const ev = await c.query(
  `select g.event_id from public.alunara_guestbook_guests g where g.session = $1`,
  [sesi],
)
await c.end()
const eventId = ev.rows[0]?.event_id
if (!eventId) {
  console.error('event_id tak jumpa untuk sesi ini')
  process.exit(1)
}

// 3. Panggil RPC dengan durasi berbeza.
for (const dur of [75, 61, 60, 30]) {
  const r = await rpc('alunara_gb_add_media', {
    p_session: sesi,
    p_storage_path: `${eventId}/ujian-had-${dur}s.mp4`,
    p_media_type: 'video',
    p_mime_type: 'video/mp4',
    p_bytes: 1234,
    p_duration_sec: dur,
  })
  const mesej = r.data?.message || (typeof r.data === 'string' ? r.data : JSON.stringify(r.data))
  const lulus = dur <= 60
  const ok = lulus ? !String(mesej).includes('terlalu panjang') : String(mesej).includes('terlalu panjang')
  console.log(
    `  ${dur}s → ${ok ? '✓' : '✗'} ${String(mesej).slice(0, 80)}` +
      (lulus ? '' : '  (mesti ditolak)'),
  )
  if (!ok) process.exitCode = 1
}
console.log(process.exitCode ? 'GAGAL: had server tak betul' : 'LULUS: had server aktif')
