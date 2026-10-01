#!/usr/bin/env node
/**
 * Migrasi: betulkan mime_type nota suara lama di DB.
 *
 * Punca: MediaRecorder Safari/iOS rakam audio/mp4 (AAC dalam container MP4),
 * tapi kod lama hardcode audio/webm → browser tak boleh play. Fail R2 sendiri
 * betul; hanya metadata yang salah. Content-Type masa serve dibetulkan oleh
 * presigned URL (ResponseContentType), jadi skrip ini hanya perlu betulkan DB.
 *
 * Gunaan (kredensial dari env — jangan hardcode):
 *   SUPABASE_DB_PASSWORD=... node scripts/fix-voice-mime.mjs
 *   # atau letak dalam ~/alunara-web/.env.local sebagai SUPABASE_DB_PASSWORD
 *
 * DB ref: sdzjlekydkwtxjjtrwrh (project Alunara).
 */
import pg from 'pg'

const REF = 'sdzjlekydkwtxjjtrwrh'
const pw = process.env.SUPABASE_DB_PASSWORD
if (!pw) {
  console.error('Set SUPABASE_DB_PASSWORD (password DB Supabase, bukan anon key).')
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

async function main() {
  await c.connect()

  const q = await c.query(`
    SELECT id, storage_path, mime_type, bytes
    FROM public.alunara_guestbook_media
    WHERE media_type = 'voice' AND hidden = false
    ORDER BY created_at
  `)
  console.log(`Voice media dijumpai: ${q.rows.length}`)

  // Semua fail voice lama sebenarnya MP4/AAC, bukan WebM.
  let dbFixed = 0
  for (const row of q.rows) {
    if (row.mime_type !== 'audio/mp4') {
      await c.query(
        `UPDATE public.alunara_guestbook_media SET mime_type = 'audio/mp4' WHERE id = $1`,
        [row.id],
      )
      dbFixed++
      console.log(`  DB fix: ${row.storage_path}  (${row.mime_type} → audio/mp4)`)
    }
  }
  console.log(`DB dibaiki: ${dbFixed} baris`)
  console.log('Content-Type masa serve dibetulkan automatik oleh presigned URL.')

  await c.end()
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
