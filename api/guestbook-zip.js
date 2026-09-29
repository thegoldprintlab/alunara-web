/**
 * /api/guestbook-zip — muat turun pukal (ZIP) semua media satu majlis.
 *
 * KENAPA ENDPOINT BERASINGAN
 *   Browser tak boleh bina ZIP yang efisien untuk ratusan gambar tanpa
 *   pustaka berat. Server boleh kumpul semua fail (dari R2 / Supabase),
 *   zip dalam memori, dan hantar sebagai satu fail `majlis-<kod>.zip`.
 *
 * KESELAMATAN
 *   * WAJIB admin (Bearer access_token) — host sahaja boleh muat turun.
 *   * Laluan fail diambil DARI DB (bukan dari klien) untuk satu event,
 *     jadi tak boleh minta fail majlis orang lain.
 *   * Had saiz: tolak kalau jumlah media > 2 GB (elak OOM serverless).
 */
import { Readable } from 'node:stream'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || ''
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || ''
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || ''
const R2_BUCKET = process.env.R2_BUCKET || 'alunara-guestbook'
const R2_SEDIA = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY)

let _s3 = null
function s3() {
  if (_s3) return _s3
  _s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  })
  return _s3
}

const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024 // 2 GB

/** Lazily import archiver (hanya bila endpoint dipanggil). */
let archiverMod = null
async function archiver() {
  if (!archiverMod) archiverMod = await import('archiver')
  return archiverMod.default
}

function sb(path, init = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

async function adminSah(authHeader) {
  const m = /^Bearer\s+(.+)$/i.exec(String(authHeader || ''))
  if (!m) return false
  const token = m[1].trim()
  if (!token) return false
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  if (!r.ok) return false
  return (await r.json()) === true
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ralat: 'Hanya POST.' })
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(503).json({ ralat: 'Perkhidmatan belum sedia.' })
  }

  if (!(await adminSah(req.headers.authorization))) {
    return res.status(403).json({ ralat: 'Hanya admin.' })
  }

  let body = {}
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    return res.status(400).json({ ralat: 'JSON tak sah.' })
  }

  const eventId = String(body?.event_id || '')
  if (!eventId) return res.status(400).json({ ralat: 'event_id diperlukan.' })

  // 1. Ambil senarai media dari DB (hidden=false).
  const r1 = await sb(
    `/rest/v1/alunara_guestbook_media?event_id=eq.${encodeURIComponent(eventId)}` +
      `&hidden=eq.false&select=storage_path,mime_type,bytes`
  )
  if (!r1.ok) return res.status(502).json({ ralat: 'Gagal baca media.' })
  const media = await r1.json()
  if (!Array.isArray(media) || !media.length) {
    return res.status(404).json({ ralat: 'Tiada media untuk dimuat turun.' })
  }

  const total = media.reduce((s, m) => s + (Number(m.bytes) || 0), 0)
  if (total > MAX_TOTAL_BYTES) {
    return res.status(413).json({ ralat: 'Media terlalu besar untuk ZIP.' })
  }

  // 2. Dapatkan signed URL untuk setiap fail (R2 / fallback Supabase).
  const paths = media.map((m) => m.storage_path)
  const peta = {}
  if (R2_SEDIA) {
    for (const p of paths) {
      try {
        peta[p] = await getSignedUrl(
          s3(),
          new GetObjectCommand({ Bucket: R2_BUCKET, Key: p }),
          { expiresIn: 600 }
        )
      } catch {
        /* skip fail yang tak boleh sign */
      }
    }
  } else {
    const r2 = await sb(`/storage/v1/object/sign/alunara-guestbook`, {
      method: 'POST',
      body: JSON.stringify({ expiresIn: 600, paths }),
    })
    if (r2.ok) {
      const signed = await r2.json()
      for (const it of signed || []) {
        const rel = it.signedURL || it.signedUrl
        if (!rel) continue
        peta[it.path] = rel.startsWith('http') ? rel : `${SUPABASE_URL}/storage/v1${rel}`
      }
    }
  }
  if (!Object.keys(peta).length) {
    return res.status(502).json({ ralat: 'Gagal jana URL muat turun.' })
  }

  // 3. Stream ZIP.
  const arch = await archiver()
  const zip = arch('zip', { zlib: { level: 6 } })
  res.status(200)
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="buku-tamu-${eventId.slice(0, 8)}.zip"`)

  zip.pipe(res)

  // Ambil setiap fail dan tambah ke zip. Susun ikut nama fail.
  let ke = 0
  for (const m of media) {
    const url = peta[m.storage_path]
    if (!url) continue
    const r = await fetch(url)
    if (!r.ok || !r.body) continue
    const nama = `${String(++ke).padStart(3, '0')}-${m.storage_path.split('/').pop()}`
    zip.append(Readable.fromWeb(r.body), { name: nama })
  }

  await zip.finalize()
}
