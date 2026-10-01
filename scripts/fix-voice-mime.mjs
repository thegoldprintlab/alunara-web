#!/usr/bin/env node
/**
 * Migrasi: betulkan Content-Type nota suara lama.
 *
 * Punca: MediaRecorder Safari/iOS rakam dalam format audio/mp4 (AAC dalam
 * container MP4), tapi kod lama hardcode semuanya sebagai audio/webm.
 * Akibatnya R2 hidang Content-Type: audio/webm untuk fail yang sebenarnya
 * MP4 → browser (terutama Safari) tak boleh play.
 *
 * Skrip ni buat dua perkara:
 *   1. UPDATE mime_type di DB Supabase → audio/mp4 untuk voice notes lama
 *   2. (selepas deploy) panggil endpoint /api/guestbook-sign action=fix-mime
 *      untuk betulkan Content-Type di R2
 *
 * Gunaan:
 *   node scripts/fix-voice-mime.mjs            # DB sahaja
 *   node scripts/fix-voice-mime.mjs --r2 TOKEN # DB + R2 (selepas deploy)
 */
import pg from 'pg'

const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 6543,
  user: 'postgres.sdzjlekydkwtxjjtrwrh',
  password: '92Wbs@5x-5vYKtH',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

async function main() {
  await c.connect()

  // 1. Senaraikan voice media lama yang mime_type bermasalah
  const q = await c.query(`
    SELECT id, storage_path, mime_type, bytes
    FROM public.alunara_guestbook_media
    WHERE media_type = 'voice' AND hidden = false
    ORDER BY created_at
  `)
  console.log(`Voice media dijumpai: ${q.rows.length}`)

  // 2. Tukar mime_type di DB → audio/mp4
  //    (semua fail voice lama sebenarnya MP4/AAC, bukan WebM)
  let dbFixed = 0
  const untukR2 = []
  for (const row of q.rows) {
    if (row.mime_type !== 'audio/mp4') {
      await c.query(
        `UPDATE public.alunara_guestbook_media SET mime_type = 'audio/mp4' WHERE id = $1`,
        [row.id],
      )
      dbFixed++
      console.log(`  DB fix: ${row.storage_path}  (${row.mime_type} → audio/mp4)`)
    }
    untukR2.push({ path: row.storage_path, mime: 'audio/mp4' })
  }
  console.log(`DB dibaiki: ${dbFixed} baris`)

  // 3. Sekiranya --r2 TOKEN diberi, panggil endpoint fix-mime
  const r2Flag = process.argv.includes('--r2')
  const token = process.argv[process.argv.indexOf('--r2') + 1]
  if (r2Flag && token && token !== '--r2') {
    console.log('\nMemanggil endpoint fix-mime di R2...')
    const r = await fetch('https://alunara.my/api/guestbook-sign', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'fix-mime', fix: untukR2 }),
    })
    const j = await r.json()
    if (!r.ok) {
      console.error('RALAT:', j.ralat || r.statusText)
      process.exit(1)
    }
    let ok = 0
    let gagal = 0
    for (const h of j.hasil) {
      if (h.ok) ok++
      else {
        gagal++
        console.error(`  R2 gagal: ${h.path} — ${h.ralat}`)
      }
    }
    console.log(`R2 dibaiki: ${ok} ok, ${gagal} gagal`)
  } else {
    console.log('\nUntuk betulkan R2 (selepas deploy):')
    console.log(`  node scripts/fix-voice-mime.mjs --r2 <ADMIN_JWT>`)
  }

  await c.end()
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
