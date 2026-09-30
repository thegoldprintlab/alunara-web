/**
 * apply-fn-ucapan.mjs — apply HANYA fungsi alunara_gb_ucapan.
 *
 * KENAPA SKRIP BERASINGAN
 *   migrate-guestbook-v2.mjs jalankan SELURUH fail v2.sql termasuk DDL dan
 *   migrasi data — terlalu berisiko untuk satu fungsi baru. Skrip ini ambil
 *   definisi fungsi sahaja dari fail .sql dan CREATE OR REPLACE.
 *
 * CARA GUNA
 *   cd ~/alunara-web
 *   PG_PW='<password DB>' node scripts/apply-fn-ucapan.mjs          # tunjuk, tak apply
 *   PG_PW='<password DB>' node scripts/apply-fn-ucapan.mjs --apply  # betul-betul apply
 *
 * JANGAN tulis password DB dalam fail ini — skrip ini di-commit ke repo.
 * Ambil dari env PG_PW sahaja.
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const DB = {
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 6543,
  user: 'postgres.sdzjlekydkwtxjjtrwrh',
  password: process.env.PG_PW,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
}

if (!DB.password) {
  console.error("ABORT: set PG_PW dulu — cth. PG_PW='...' node scripts/apply-fn-ucapan.mjs")
  process.exit(1)
}

const sql = readFileSync(new URL('../supabase/alunara_gb_ucapan.sql', import.meta.url), 'utf8')
const mula = sql.indexOf('create or replace function public.alunara_gb_ucapan(')
if (mula === -1) {
  console.error('ABORT: definisi fungsi tak jumpa dalam alunara_gb_ucapan.sql')
  process.exit(1)
}
const tamat = sql.indexOf('\n$$;', mula)
if (tamat === -1) {
  console.error('ABORT: hujung fungsi tak jumpa')
  process.exit(1)
}
const badan = sql.slice(mula, tamat + 4)

if (!badan.includes('gu.wish')) {
  console.error('ABORT: blok fungsi tak sentuh gu.wish — semak fail SQL.')
  process.exit(1)
}

if (!process.argv.includes('--apply')) {
  console.log('--- DRY RUN (tambah --apply untuk betul-betul jalankan) ---')
  console.log(badan)
  process.exit(0)
}

const c = new pg.Client(DB)
await c.connect()
await c.query(badan)
const r = await c.query(
  `select proname from pg_proc where proname = 'alunara_gb_ucapan'`,
)
console.log('OK — fungsi wujud:', r.rows.map((x) => x.proname).join(', ') || '(TIADA)')
const t = await c.query(
  `select count(*)::int as n from public.alunara_guestbook_guests
    where coalesce(trim(wish), '') <> ''`,
)
console.log('Tetamu dengan ucapan dalam DB:', t.rows[0].n)
await c.end()
