import pg from 'pg'
const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 6543,
  user: 'postgres.sdzjlekydkwtxjjtrwrh',
  password: '92Wbs@5x-5vYKtH',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})
await c.connect()
const r = await c.query("SELECT pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname='is_admin'")
console.log(r.rows[0].def)
await c.end()
