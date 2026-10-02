/**
 * apply-had-video-2.mjs — apply siling video berasingan + RPC baki.
 *
 * APA YANG DIUBAH (vs apply-fn-had-video.mjs, yang hanya apply satu fungsi)
 *   1. Dua lajur baru pada alunara_guestbook_events:
 *        max_video_per_guest  (default 3)
 *        max_video_bytes      (default 50 MB)
 *   2. CREATE OR REPLACE alunara_gb_add_media   — semak bilangan + saiz video
 *   3. CREATE OR REPLACE alunara_gb_baki_saya   — fungsi baru (baki kuota)
 *
 * KENAPA BUKAN migrate-guestbook-v2.mjs: skrip itu jalankan SELURUH fail
 * v2.sql termasuk migrasi data lama. Untuk perubahan bersasar, itu terlalu
 * berisiko. Skrip ini ambil definisi dari fail .sql supaya SQL tak
 * bercanggah dua tempat, dan hanya jalankan yang perlu.
 *
 * CARA GUNA
 *   cd ~/alunara-web
 *   PG_PW='<password DB>' node scripts/apply-had-video-2.mjs           # tunjuk
 *   PG_PW='<password DB>' node scripts/apply-had-video-2.mjs --apply   # betul
 *
 * Kalau PG_PW tak diberi, skrip cuba baca dari env PG_PW sahaja — fail
 * .env.production TIDAK boleh dipercayai (Vercel tulis "[SENSITIVE]").
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const REF = 'sdzjlekydkwtxjjtrwrh'
const sql = readFileSync(new URL('../supabase/alunara_guestbook_v2.sql', import.meta.url), 'utf8')

/** Ambil satu blok `create or replace function public.<nama>(...) ... $$;`. */
function ambilFungsi(sumber, nama) {
  const mula = sumber.indexOf(`create or replace function public.${nama}(`)
  if (mula === -1) throw new Error(`Fungsi ${nama} tak jumpa dalam SQL`)
  const tamat = sumber.indexOf('\n$$;', mula)
  if (tamat === -1) throw new Error(`Hujung fungsi ${nama} tak jumpa`)
  return sumber.slice(mula, tamat + 4)
}

/** Ambil blok `alter table public.alunara_guestbook_events ... ;` yang ada kata kunci. */
function ambilAlter(kata) {
  const baris = sql.split('\n')
  for (let i = 0; i < baris.length; i++) {
    if (baris[i].startsWith('alter table public.alunara_guestbook_events') && baris[i + 1]?.includes(kata)) {
      let j = i
      while (!baris[j].includes(';')) j++
      return baris.slice(i, j + 1).join('\n')
    }
  }
  throw new Error(`ALTER untuk "${kata}" tak jumpa dalam SQL`)
}

const ALTER_VIDEO_N = ambilAlter('max_video_per_guest')
const ALTER_VIDEO_B = ambilAlter('max_video_bytes')
const FN_ADD = ambilFungsi(sql, 'alunara_gb_add_media')
const FN_BAKI = ambilFungsi(sql, 'alunara_gb_baki_saya')

/** Buang versi LAMA yang p_bytes integer — kalau tidak ia jadi OVERLOAD. */
const DROP_LAMA =
  'drop function if exists public.alunara_gb_add_media' +
  '(uuid,text,text,text,integer,integer,integer,numeric,text,numeric);'

// Semakan keselamatan: jangan apply kalau blok yang diambil bukan yang kita sangka.
for (const [nama, blok, mesti] of [
  ['ALTER max_video_per_guest', ALTER_VIDEO_N, 'max_video_per_guest integer'],
  ['ALTER max_video_bytes', ALTER_VIDEO_B, 'max_video_bytes bigint'],
  ['fn add_media', FN_ADD, 'had % video untuk sesi ini'],
  ['fn add_media saiz', FN_ADD, 'Video terlalu besar'],
  ['fn add_media bigint', FN_ADD, 'p_bytes        bigint'],
  ['fn baki_saya', FN_BAKI, 'video_maks_bytes'],
]) {
  if (!blok.includes(mesti)) {
    console.error(`ABORT: blok "${nama}" tak mengandungi "${mesti}" — semak fail SQL.`)
    process.exit(1)
  }
}

const APPLY = process.argv.includes('--apply')

if (!APPLY) {
  console.log('--- MOD CUBA (tak apply). Guna --apply untuk betul-betul jalan. ---\n')
  console.log(ALTER_VIDEO_N + '\n')
  console.log(ALTER_VIDEO_B + '\n')
  console.log('fn alunara_gb_add_media: semakan video ->')
  console.log(FN_ADD.split('\n').filter((l) => /video|bytes/i.test(l)).join('\n'))
  console.log('\nfn alunara_gb_baki_saya: ' + (FN_BAKI.match(/returns table[\s\S]*?\)/)?.[0] || ''))
  process.exit(0)
}

const pw = process.env.PG_PW
if (!pw) {
  console.error("PG_PW tak set. Contoh: PG_PW='...' node scripts/apply-had-video-2.mjs --apply")
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
console.log('connected')

// 1. Lajur baru (idempotent — ADD COLUMN IF NOT EXISTS).
await c.query(ALTER_VIDEO_N)
await c.query(ALTER_VIDEO_B)
console.log('lajur max_video_per_guest + max_video_bytes OK')

// 2. Fungsi. Buang versi lama DAHULU, kalau tidak bigint cipta overload.
await c.query(DROP_LAMA)
await c.query(FN_ADD)
await c.query(FN_BAKI)
console.log('CREATE OR REPLACE add_media + baki_saya selesai')

// 2b. Sahkan TIADA overload tertinggal — ini yang buat fix senyap gagal.
const overload = await c.query(
  `select p.oid::regprocedure::text as sig
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='alunara_gb_add_media'
    order by 1`,
)
console.log('tandatangan add_media:', overload.rows.map((r) => r.sig))
if (overload.rows.length !== 1) {
  console.error('AMARAN: ada ' + overload.rows.length + ' versi add_media — patut 1 sahaja.')
  process.exitCode = 1
}

// 3. Sahkan dari katalog, bukan dari andaian.
const kol = await c.query(
  `select column_name, data_type, column_default
     from information_schema.columns
    where table_schema='public' and table_name='alunara_guestbook_events'
      and column_name in ('max_video_per_guest','max_video_bytes')
    order by column_name`,
)
console.log('lajur disahkan:', kol.rows)

const fn = await c.query(
  `select p.proname, p.prosrc like '%had % video untuk sesi ini%' as ada_had_video
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname in ('alunara_gb_add_media','alunara_gb_baki_saya')
    order by 1`,
)
console.log('fungsi disahkan:', fn.rows)

await c.end()
