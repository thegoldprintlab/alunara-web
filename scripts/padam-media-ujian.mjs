/**
 * padam-media-ujian.mjs — padam baris media ujian dari majlis BUANGAN.
 *
 * KENAPA: skrip ujian (uji-had-server.mjs, uji-muatnaik-video.mjs) MENINGGALKAN
 * baris dalam DB. Kalau tak dibersihkan, majlis buangan jadi penuh sampah dan
 * angka "N kenangan dikongsi" jadi mengelirukan.
 *
 * KESELAMATAN: hanya padam baris yang laluannya mengandungi 'ujian-' ATAU
 * datang dari sesi bernama 'Uji ...'. Ia TIDAK padam media tetamu sebenar.
 *
 * CARA GUNA:
 *   cd ~/alunara-web
 *   PG_PW='<password DB>' node scripts/padam-media-ujian.mjs [slug]         # lihat
 *   PG_PW='<password DB>' node scripts/padam-media-ujian.mjs [slug] --apply # padam
 */
import pg from 'pg'

const REF = 'sdzjlekydkwtxjjtrwrh'
const slug = process.argv[2] || 'CUBA24'
const APPLY = process.argv.includes('--apply')

const pw = process.env.PG_PW
if (!pw) {
  console.error('PG_PW tak set.')
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

// Cari media ujian: laluan ada 'ujian-' ATAU nama tetamu bermula 'Uji '.
const q = `
  select m.id, m.media_type, m.storage_path, g.name, m.created_at
  from public.alunara_guestbook_media m
  join public.alunara_guestbook_events e on e.id = m.event_id
  join public.alunara_guestbook_galleries gal on gal.id = e.gallery_id
  left join public.alunara_guestbook_guests g on g.id = m.guest_id
  where lower(gal.slug) = lower($1)
    and (m.storage_path like '%ujian-%' or g.name like 'Uji %')
  order by m.created_at desc`

const r = await c.query(q, [slug])
console.log(`majlis ${slug}: ${r.rows.length} baris media ujian`)
for (const x of r.rows) {
  console.log(`  ${x.media_type} · ${x.name ?? '?'} · ${x.storage_path.split('/').pop()}`)
}

if (!r.rows.length) {
  await c.end()
  process.exit(0)
}

if (!APPLY) {
  console.log('\nCUBA sahaja. Tambah --apply untuk padam.')
  await c.end()
  process.exit(0)
}

const ids = r.rows.map((x) => x.id)
// Padam baris media dulu (rujukan), kemudian tetamu ujian.
await c.query(`delete from public.alunara_guestbook_media where id = any($1::uuid[])`, [ids])
const g = await c.query(
  `delete from public.alunara_guestbook_guests
   where event_id in (
     select e.id from public.alunara_guestbook_events e
     join public.alunara_guestbook_galleries gal on gal.id = e.gallery_id
     where lower(gal.slug) = lower($1)
   ) and name like 'Uji %' returning id`,
  [slug],
)
console.log(`dipadam: ${ids.length} media, ${g.rowCount} tetamu ujian`)

await c.end()
