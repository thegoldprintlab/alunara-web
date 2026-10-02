/**
 * uji-had-video-2.mjs — sahkan siling video BERASINGAN berfungsi di server.
 *
 * KENAPA UJIAN INI PERLU
 *   Siling di UI boleh lulus tetapi RPC masih terima apa-apa. Ujian ini
 *   panggil RPC terus (tiada UI) dan sahkan:
 *     1. Video ke-4 ditolak  (siling bilangan = 3)
 *     2. Video 51MB ditolak  (siling saiz = 50MB)
 *     3. 10 foto + 3 video lulus  (video TIDAK makan kuota foto)
 *     4. baki_saya melaporkan angka yang betul
 *   Ia juga padam baris ujian yang ia cipta, supaya majlis sebenar bersih.
 *
 * CARA GUNA
 *   cd ~/alunara-web
 *   PG_PW='<password DB>' node scripts/uji-had-video-2.mjs <slug-majlis-ujian>
 *
 * Majlis ujian mesti wujud (slug sebenar). Skrip TIDAK cipta gallery baru —
 * ia guna yang sedia ada supaya tak tinggal sampah dalam DB.
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const REF = 'sdzjlekydkwtxjjtrwrh'
const slug = process.argv[2]
if (!slug) {
  console.error('Guna: node scripts/uji-had-video-2.mjs <slug-majlis-ujian>')
  process.exit(1)
}

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const baca = (k) => new RegExp(`^${k}=(.*)$`, 'm').exec(env)?.[1]?.trim()
const URL_ = baca('VITE_SUPABASE_URL')
const ANON = baca('VITE_SUPABASE_ANON_KEY')
if (!URL_ || !ANON) {
  console.error('.env.local tak lengkap')
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

// 1. Sertai majlis sebagai tetamu ujian → dapat sesi.
const join = await rpc('alunara_gb_join', { p_slug: slug, p_name: 'Uji Siling Video', p_wish: null })
if (join.status !== 200) {
  console.error('join gagal (slug betul?):', JSON.stringify(join.data))
  process.exit(1)
}
const sesi = join.data
console.log('sesi ujian:', String(sesi).slice(0, 8) + '…')

const pw = process.env.PG_PW
if (!pw) {
  console.error('PG_PW tak set — perlu untuk cari event_id + bersihkan ujian.')
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
  `select g.id as guest, g.event_id,
          e.max_video_per_guest, e.max_video_bytes
     from public.alunara_guestbook_guests g
     join public.alunara_guestbook_events e on e.id = g.event_id
    where g.session = $1`,
  [sesi],
)
if (!ev.rows.length) {
  console.error('sesi tak jumpa dalam DB')
  await c.end()
  process.exit(1)
}
const { guest, event_id: eventId } = ev.rows[0]
// PostgREST/`pg` boleh pulangkan bigint sebagai STRING. Number() wajib —
// tanpa itu `maxB + 1048576` jadi cantuman string ("524288001048576")
// dan ujian menuduh sistem atas bug ujian sendiri.
const hadV = Number(ev.rows[0].max_video_per_guest)
const maxB = Number(ev.rows[0].max_video_bytes)
console.log(`had: ${hadV} video, ${maxB} bait (${Math.round(maxB / 1048576)} MB)\n`)

let gagal = 0
const lapor = (nama, ok, nota) => {
  console.log(`  ${ok ? '✓' : '✗'} ${nama}${nota ? '  — ' + nota : ''}`)
  if (!ok) gagal++
}

/** Cipta baris media ujian (tak sentuh R2 — p_storage_path cukup untuk RPC). */
async function cubaVideo(i, bytes) {
  return rpc('alunara_gb_add_media', {
    p_session: sesi,
    p_storage_path: `${eventId}/ujian-siling-${i}.mp4`,
    p_media_type: 'video',
    p_mime_type: 'video/mp4',
    p_bytes: bytes,
    p_duration_sec: 30,
  })
}
async function cubaFoto(i) {
  return rpc('alunara_gb_add_media', {
    p_session: sesi,
    p_storage_path: `${eventId}/ujian-foto-${i}.jpg`,
    p_media_type: 'photo',
    p_mime_type: 'image/jpeg',
    p_bytes: 300000,
    p_stock: 'none',
  })
}
const mesej = (r) => String(r.data?.message || (typeof r.data === 'string' ? r.data : JSON.stringify(r.data)))

// 2. Ujian 1+3: 10 foto dahulu (mesti lulus), kemudian 3 video (mesti lulus),
//    kemudian video ke-4 (mesti DITOLAK).
console.log('UJIAN 1 & 3 — foto tidak makan kuota video')
for (let i = 1; i <= 10; i++) {
  const r = await cubaFoto(i)
  if (r.status !== 200) lapor(`foto ${i}`, false, mesej(r))
}
lapor('10 foto diterima', true)

console.log('\nUJIAN 2 — siling bilangan video = ' + hadV)
for (let i = 1; i <= hadV; i++) {
  const r = await cubaVideo(i, 5 * 1048576) // 5MB, bawah siling saiz
  lapor(`video ${i} diterima`, r.status === 200, mesej(r))
}
const keempat = await cubaVideo(hadV + 1, 5 * 1048576)
lapor(
  `video ke-${hadV + 1} DITOLAK`,
  keempat.status !== 200 && mesej(keempat).includes('had'),
  mesej(keempat),
)

console.log('\nUJIAN 4 — siling saiz video')
// Buang video terakhir supaya siling bilangan tak halang ujian saiz.
await c.query(`delete from public.alunara_guestbook_media where guest_id=$1 and media_type='video'`, [guest])
const besar = await cubaVideo(99, maxB + 1048576)
lapor(
  `video ${Math.round((maxB + 1048576) / 1048576)}MB DITOLAK`,
  besar.status !== 200 && mesej(besar).includes('besar'),
  mesej(besar),
)
const ok = await cubaVideo(100, maxB - 1048576)
lapor(`video ${Math.round((maxB - 1048576) / 1048576)}MB diterima`, ok.status === 200, mesej(ok))

console.log('\nUJIAN 5 — RPC baki_saya')
const b = await rpc('alunara_gb_baki_saya', { p_session: sesi })
const baris = Array.isArray(b.data) ? b.data[0] : null
lapor('baki_saya menjawab', !!baris, JSON.stringify(baris))
if (baris) {
  lapor('video_digunakan = 1', Number(baris.video_digunakan) === 1, `dapat ${baris.video_digunakan}`)
  lapor('media_digunakan = 11', Number(baris.media_digunakan) === 11, `dapat ${baris.media_digunakan}`)
  lapor('video_maks betul', Number(baris.video_maks) === hadV, `dapat ${baris.video_maks}`)
}

// 3. Bersihkan: padam media + tetamu ujian. Jangan tinggal sampah.
const delMedia = await c.query(`delete from public.alunara_guestbook_media where guest_id=$1`, [guest])
await c.query(`delete from public.alunara_guestbook_guests where id=$1`, [guest])
console.log(`\nDIBERSIHKAN: ${delMedia.rowCount} baris media + 1 tetamu ujian dipadam`)

await c.end()
console.log(gagal ? `\nGAGAL: ${gagal} ujian tak lulus` : '\nLULUS: siling video berasingan aktif')
process.exit(gagal ? 1 : 0)
