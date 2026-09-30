/**
 * apply-fn-had-video.mjs — apply HANYA fungsi alunara_gb_add_media (had 60s).
 *
 * KENAPA BUKAN migrate-guestbook-v2.mjs
 *   Skrip itu jalankan SELURUH fail v2.sql, termasuk DDL dan migrasi data.
 *   Untuk satu perubahan fungsi, itu terlalu berisiko. Skrip ini ambil
 *   definisi fungsi sahaja dari fail .sql dan CREATE OR REPLACE.
 *
 * CARA GUNA
 *   cd ~/alunara-web
 *   PG_PW='<password DB>' node scripts/apply-fn-had-video.mjs          # tunjuk, tak apply
 *   PG_PW='<password DB>' node scripts/apply-fn-had-video.mjs --apply  # betul-betul apply
 *
 * Password DB: guna env PG_PW. Fail .env.production dalam ~/gold-plan-web
 * TIDAK boleh dipercayai — Vercel tulis "[SENSITIVE]" sebagai placeholder
 * untuk secret, jadi nilainya bukan password sebenar.
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const REF = 'sdzjlekydkwtxjjtrwrh'
const sql = readFileSync(new URL('../supabase/alunara_guestbook_v2.sql', import.meta.url), 'utf8')

/** Ambil satu blok `create or replace function <nama>(...) ... $$;` dari fail. */
function ambilFungsi(sumber, nama) {
  const mula = sumber.indexOf(`create or replace function public.${nama}(`)
  if (mula === -1) throw new Error(`Fungsi ${nama} tak jumpa dalam SQL`)
  const tamat = sumber.indexOf('\n$$;', mula)
  if (tamat === -1) throw new Error(`Hujung fungsi ${nama} tak jumpa`)
  return sumber.slice(mula, tamat + 4)
}

const badan = ambilFungsi(sql, 'alunara_gb_add_media')

if (!badan.includes('maksimum 60 saat')) {
  console.error('ABORT: blok fungsi tak mengandungi semakan 60 saat — semak fail SQL.')
  process.exit(1)
}

const pw = process.env.PG_PW
if (!pw) {
  console.error('PG_PW tak set. Contoh: PG_PW=\'...\' node scripts/apply-fn-had-video.mjs --apply')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')
if (!APPLY) {
  console.log('--- MOD CUBA (tak apply). Guna --apply untuk betul-betul jalan. ---')
  console.log(badan.slice(0, 400))
  console.log('...')
  console.log('--- semakan had ---')
  console.log(badan.split('\n').filter((l) => l.includes('60')).join('\n'))
  process.exit(0)
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

const sebelum = await c.query(
  `select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.proname='alunara_gb_add_media'`,
)
console.log('ada semakan 60s SEBELUM:', (sebelum.rows[0]?.prosrc || '').includes('60 saat'))

await c.query(badan)
console.log('CREATE OR REPLACE selesai')

const selepas = await c.query(
  `select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.proname='alunara_gb_add_media'`,
)
console.log('ada semakan 60s SELEPAS:', (selepas.rows[0]?.prosrc || '').includes('60 saat'))

await c.end()
