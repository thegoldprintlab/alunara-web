/**
 * cari-koneksi-db.mjs — cari kombinasi kredensial DB yang berfungsi.
 * Cetak nama kombinasi sahaja, JANGAN cetak password.
 *
 * CARA GUNA: node scripts/cari-koneksi-db.mjs
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import pg from 'pg'

const REF = 'gtblmwijohoetczqngpr'

/** Ambil kredensial dari fail env gold-plan-web. */
function dariEnv() {
  const out = {}
  for (const f of ['/gold-plan-web/.env.production', '/gold-plan-web/.env.local']) {
    let teks = ''
    try {
      teks = readFileSync(homedir() + f, 'utf8')
    } catch {
      continue
    }
    for (const baris of teks.split('\n')) {
      const m = /^([A-Z_0-9]+)=(.*)$/.exec(baris.trim())
      if (!m) continue
      const v = m[2].trim().replace(/^["']|["']$/g, '')
      // Langkau placeholder dari `vercel env pull`.
      if (!v || v === '[SENSITIVE]') continue
      out[m[1]] = v
    }
  }
  return out
}

const env = dariEnv()
const pw = env.POSTGRES_PASSWORD || env.SUPABASE_DB_PASSWORD || null

const CALON = []
if (pw) {
  CALON.push({ nama: 'pooler/postgres.ref/env', host: 'aws-0-ap-northeast-2.pooler.supabase.com', port: 6543, user: `postgres.${REF}`, password: pw })
  CALON.push({ nama: 'pooler/postgres/env', host: 'aws-0-ap-northeast-2.pooler.supabase.com', port: 6543, user: 'postgres', password: pw })
  CALON.push({ nama: 'direct/db.ref/env', host: `db.${REF}.supabase.co`, port: 5432, user: 'postgres', password: pw })
}
// Sandaran: password yang tercatat dalam docs repo (bukan env).
CALON.push({ nama: 'pooler/postgres.ref/docs', host: 'aws-0-ap-northeast-2.pooler.supabase.com', port: 6543, user: `postgres.${REF}`, password: 'K4Ka4wkAPFLFgAgu' })

console.log('kredensial dari env:', pw ? 'ada POSTGRES_PASSWORD' : 'TIADA')
console.log('cuba', CALON.length, 'kombinasi\n')

for (const c of CALON) {
  const cl = new pg.Client({ host: c.host, port: c.port, user: c.user, password: c.password, database: 'postgres', ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 })
  try {
    await cl.connect()
    const r = await cl.query('select current_user, current_database()')
    console.log(`✓ BERJAYA  ${c.nama}  →  ${r.rows[0].current_user} @ ${r.rows[0].current_database}`)
    await cl.end()
  } catch (e) {
    console.log(`✗ gagal   ${c.nama}  →  ${String(e.message).slice(0, 70)}`)
    try {
      await cl.end()
    } catch {
      /* abaikan */
    }
  }
}
