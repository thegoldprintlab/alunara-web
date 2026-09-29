/**
 * Jalankan migration buku tamu ALUNARA terhadap Supabase.
 *
 * CARA GUNA
 *   cd ~/gold-plan-web            # `pg` ada di sini, bukan di alunara-web
 *   PG_PW='<db password>' node ~/alunara-web/scripts/migrate-guestbook.mjs
 *
 * KENAPA BUKAN DATABASE_URL
 *   `DATABASE_URL` dalam gold-plan-web/.env.production sudah dipangkas dan tak
 *   boleh dipakai. Host direct `db.<ref>.supabase.co` pula IPv6-only dan mesin
 *   ini tiada laluan IPv6. Jadi kita guna transaction pooler IPv4 dengan user
 *   `postgres.<ref>` (port 6543 = transaction mode, sesuai untuk DDL).
 *
 * Idempotent — selamat dijalankan berulang. Skrip ini hanya menjalankan
 * supabase/alunara_guestbook.sql dan mencetak semakan.
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const REF = 'gtblmwijohoetczqngpr'
const sql = readFileSync(new URL('../supabase/alunara_guestbook.sql', import.meta.url), 'utf8')

if (!process.env.PG_PW) {
  console.error('PG_PW tak diset. Guna: PG_PW=... node scripts/migrate-guestbook.mjs')
  process.exit(1)
}

const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 6543,
  user: `postgres.${REF}`,
  password: process.env.PG_PW,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

await c.connect()
console.log('connected')
try {
  await c.query(sql)
  console.log('MIGRATION OK')
} catch (e) {
  console.error('MIGRATION FAIL:', e.message)
  if (e.position) console.error('at position', e.position)
  process.exitCode = 1
}

// verify
try {
  const t = await c.query(
    `select table_name from information_schema.tables
      where table_schema='public' and table_name like 'alunara_guestbook%'
      order by table_name`
  )
  console.log('tables:', t.rows.map((r) => r.table_name).join(', '))

  const f = await c.query(
    `select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and proname like 'alunara_guestbook%' order by proname`
  )
  console.log('functions:', f.rows.map((r) => r.proname).join(', '))

  const b = await c.query(`select id, public, file_size_limit from storage.buckets where id='alunara-guestbook'`)
  console.log('bucket:', JSON.stringify(b.rows[0]))

  const pol = await c.query(
    `select policyname, tablename from pg_policies
      where tablename like 'alunara_guestbook%' order by tablename`
  )
  console.log('policies:', pol.rows.map((r) => `${r.tablename}.${r.policyname}`).join(', '))

  // anon TIDAK boleh sentuh jadual langsung — inilah yang menghalang tetamu
  // daripada meneroka gambar majlis orang lain.
  const anon = await c.query(
    `select count(*)::int as n from information_schema.table_privileges
      where table_name like 'alunara_guestbook%' and grantee='anon'`
  )
  console.log('anon table grants (mesti 0):', anon.rows[0].n)
} catch (e) {
  console.error('VERIFY FAIL:', e.message)
}

await c.end()
