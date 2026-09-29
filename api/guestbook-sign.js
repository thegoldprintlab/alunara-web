/**
 * /api/guestbook-sign — jana signed URL untuk buku tamu ALUNARA.
 *
 * PENYIMPANAN MEDIA: Cloudflare R2 (S3-compatible, TIADA caj egress).
 *   Sebab: Supabase Storage caj egress 7–16× lebih mahal pada volume tinggi.
 *   Kalau env R2 belum diset (R2_ACCOUNT_ID dll), fungsi ini fallback ke
 *   Supabase Storage supaya tak pecah semasa peralihan.
 *
 * KENAPA ENDPOINT INI WUJUD
 *   Media adalah PRIVAT. Tetamu tak log masuk, jadi dia tak boleh upload atau
 *   baca terus. Kita jana presigned URL (luput beberapa minit) di server untuk
 *   SATU fail tertentu sahaja, selepas semak sesi & laluan.
 *
 * KESELAMATAN
 *   * `action=upload` — semak sesi tetamu betul & belum capai had, kemudian
 *     beri URL upload untuk laluan dalam folder majlis DIA sahaja.
 *   * `action=read`   — hanya benarkan laluan yang wujud dalam jadual & tak
 *     hidden. Jangan percaya laluan dari klien tanpa semak.
 *   * `action=download` — macam read, TAPI wajib admin (Bearer token).
 *   * Had kadar ikut sesi supaya endpoint tak jadi mesin penjana URL.
 *
 * ENV (Vercel, Production)
 *   SUPABASE_URL              https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY service role key (untuk semak sesi & laluan)
 *   R2_ACCOUNT_ID             Cloudflare account id
 *   R2_ACCESS_KEY_ID          R2 API token (access key id)
 *   R2_SECRET_ACCESS_KEY      R2 API token (secret)
 *   R2_BUCKET                 nama bucket (default: alunara-guestbook)
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const BUCKET = process.env.R2_BUCKET || 'alunara-guestbook'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || ''
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || ''
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || ''
const R2_SEDIA = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY)

/** Klien S3 → R2. Dibuat lazy supaya tak crash kalau env R2 belum diset. */
let _s3 = null
function s3() {
  if (_s3) return _s3
  _s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })
  return _s3
}

/** Had ringkas dalam memori — cukup untuk hentikan penyalahgunaan kasar. */
const JEJAK = new Map()
const HAD_PER_MINIT = 60

function hadKadar(kunci) {
  const kini = Date.now()
  const rekod = JEJAK.get(kunci) || []
  const baru = rekod.filter((t) => kini - t < 60_000)
  if (baru.length >= HAD_PER_MINIT) return false
  baru.push(kini)
  JEJAK.set(kunci, baru)
  if (JEJAK.size > 5000) {
    for (const [k, v] of JEJAK) {
      if (!v.some((t) => kini - t < 60_000)) JEJAK.delete(k)
    }
  }
  return true
}

async function sb(path, init = {}) {
  const r = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const teks = await r.text()
  let data = null
  try {
    data = teks ? JSON.parse(teks) : null
  } catch {
    data = { raw: teks }
  }
  return { ok: r.ok, status: r.status, data }
}

/** Semak sesi tetamu → pulangkan {guest, event, had} atau null. */
async function sesiSah(session) {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRe.test(session || '')) return null

  const { ok, data } = await sb(
    `/rest/v1/alunara_guestbook_guests?session=eq.${session}` +
      `&select=id,event_id,alunara_guestbook_events!inner(id,active,upload_until,max_uploads_per_guest,gallery_id)`
  )
  if (!ok || !Array.isArray(data) || !data.length) return null

  const baris = data[0]
  const ev = baris.alunara_guestbook_events
  if (!ev?.active) return null
  if (new Date(ev.upload_until).getTime() < Date.now()) return null

  return { guest: baris.id, event: baris.event_id, had: ev.max_uploads_per_guest }
}

/** Sahkan token admin guna token pengguna itu sendiri. */
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

/** Sahkan laluan wujud dalam DB, tidak hidden. */
async function laluanDibenarkan(laluan) {
  const senarai = laluan.map((p) => `"${String(p).replace(/"/g, '')}"`).join(',')
  const { ok, data } = await sb(
    `/rest/v1/alunara_guestbook_media?storage_path=in.(${encodeURIComponent(senarai)})` +
      `&hidden=eq.false&select=storage_path`
  )
  if (!ok || !Array.isArray(data)) {
    return laluanDibenarkanPhotos(laluan)
  }
  const dibenarkan = new Set(data.map((r) => r.storage_path))
  return laluan.filter((p) => dibenarkan.has(p))
}

async function laluanDibenarkanPhotos(laluan) {
  const senarai = laluan.map((p) => `"${String(p).replace(/"/g, '')}"`).join(',')
  const { ok, data } = await sb(
    `/rest/v1/alunara_guestbook_photos?storage_path=in.(${encodeURIComponent(senarai)})` +
      `&hidden=eq.false&select=storage_path`
  )
  if (!ok || !Array.isArray(data)) return null
  const dibenarkan = new Set(data.map((r) => r.storage_path))
  return laluan.filter((p) => dibenarkan.has(p))
}

/** Jana presigned URL baca (R2 atau fallback Supabase). */
async function signedReadUrls(sah) {
  if (R2_SEDIA) {
    const peta = {}
    for (const p of sah) {
      try {
        const url = await getSignedUrl(
          s3(),
          new GetObjectCommand({ Bucket: BUCKET, Key: p }),
          { expiresIn: 3600 }
        )
        peta[p] = url
      } catch (e) {
        console.error('[guestbook-sign] R2 sign read gagal:', e?.message)
      }
    }
    return peta
  }
  // Fallback Supabase
  const { ok, data } = await sb(`/storage/v1/object/sign/${BUCKET}`, {
    method: 'POST',
    body: JSON.stringify({ expiresIn: 3600, paths: sah }),
  })
  if (!ok) return null
  const peta = {}
  for (const item of data || []) {
    const rel = item.signedURL || item.signedUrl
    if (!rel) continue
    peta[item.path] = rel.startsWith('http') ? rel : `${SUPABASE_URL}/storage/v1${rel}`
  }
  return peta
}

/** Jana presigned URL upload untuk satu laluan. */
async function signedUploadUrl(laluan, contentType) {
  if (R2_SEDIA) {
    const url = await getSignedUrl(
      s3(),
      new PutObjectCommand({ Bucket: BUCKET, Key: laluan, ContentType: contentType }),
      { expiresIn: 300 }
    )
    return { url, token: null }
  }
  const { ok, data } = await sb(
    `/storage/v1/object/upload/sign/${BUCKET}/${laluan}`,
    { method: 'POST', body: JSON.stringify({ expiresIn: 300 }) }
  )
  if (!ok) return null
  const url = data.url?.startsWith('http')
    ? data.url
    : `${SUPABASE_URL}/storage/v1${data.url}`
  return { url, token: data.token ?? null }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ralat: 'Kaedah tak dibenarkan' })
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('[guestbook-sign] env Supabase tak lengkap')
    return res.status(503).json({ ralat: 'Perkhidmatan belum sedia' })
  }

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ ralat: 'JSON tak sah' })
  }

  const action = body?.action
  const session = String(body?.session || '')

  if (!hadKadar(session || req.headers['x-forwarded-for'] || 'anon')) {
    return res.status(429).json({ ralat: 'Terlalu banyak permintaan. Cuba sebentar.' })
  }

  // ---------------------------------------------------------------- UPLOAD
  if (action === 'upload') {
    const sesi = await sesiSah(session)
    if (!sesi) return res.status(403).json({ ralat: 'Sesi tak sah atau dah tamat' })

    // Kira upload sedia ada (media dahulu, fallback photos).
    const { ok, data } = await sb(
      `/rest/v1/alunara_guestbook_media?guest_id=eq.${sesi.guest}&select=id`
    )
    let jumlah = Array.isArray(data) ? data.length : 0
    if (!ok) {
      const f = await sb(`/rest/v1/alunara_guestbook_photos?guest_id=eq.${sesi.guest}&select=id`)
      jumlah = Array.isArray(f.data) ? f.data.length : 0
    }
    if (jumlah >= sesi.had) {
      return res.status(409).json({ ralat: `Dah capai had ${sesi.had} media` })
    }

    // Jenis media: photo (default) | video | voice
    const mediaType = ['photo', 'video', 'voice'].includes(body?.media_type)
      ? body.media_type
      : 'photo'

    // Tentukan sambungan & content-type ikut jenis.
    let sambungan = 'jpg'
    let contentType = 'image/jpeg'
    if (mediaType === 'video') {
      sambungan = 'mp4'
      contentType = 'video/mp4'
    } else if (mediaType === 'voice') {
      sambungan = 'webm'
      contentType = 'audio/webm'
    }

    // Laluan DIJANA server — klien tak boleh pilih folder majlis lain.
    const namaAsal = String(body?.nama || mediaType)
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(-40)
    // Jangan tambah sambungan dua kali kalau nama dah ada sambungan yang sama.
    const sudahSambungan = namaAsal.toLowerCase().endsWith('.' + sambungan)
    const nama = sudahSambungan ? namaAsal : `${namaAsal || mediaType}.${sambungan}`
    const laluan = `${sesi.event}/${sesi.guest}-${Date.now()}-${nama}`

    const signed = await signedUploadUrl(laluan, contentType)
    if (!signed) return res.status(502).json({ ralat: 'Gagal jana URL muat naik' })

    return res.status(200).json({
      laluan,
      url: signed.url,
      token: signed.token ?? null,
      media_type: mediaType,
      content_type: contentType,
    })
  }

  // ------------------------------------------------------------------ READ
  if (action === 'read') {
    const laluan = Array.isArray(body?.laluan) ? body.laluan.slice(0, 300) : []
    if (!laluan.length) return res.status(400).json({ ralat: 'Tiada laluan' })

    const sah = await laluanDibenarkan(laluan)
    if (sah === null) return res.status(502).json({ ralat: 'Gagal semak laluan' })
    if (!sah.length) return res.status(403).json({ ralat: 'Tiada laluan dibenarkan' })

    const peta = await signedReadUrls(sah)
    if (!peta) return res.status(502).json({ ralat: 'Gagal jana URL baca' })

    return res.status(200).json({ urls: peta })
  }

  // -------------------------------------------------------------- DOWNLOAD
  if (action === 'download') {
    if (!(await adminSah(req.headers.authorization))) {
      return res.status(403).json({ ralat: 'Hanya admin' })
    }

    const laluan = Array.isArray(body?.laluan) ? body.laluan.slice(0, 300) : []
    if (!laluan.length) return res.status(400).json({ ralat: 'Tiada laluan' })

    const sah = await laluanDibenarkan(laluan)
    if (sah === null) return res.status(502).json({ ralat: 'Gagal semak laluan' })
    if (!sah.length) return res.status(403).json({ ralat: 'Tiada laluan dibenarkan' })

    const peta = await signedReadUrls(sah)
    if (!peta) return res.status(502).json({ ralat: 'Gagal jana URL muat turun' })

    return res.status(200).json({ urls: peta })
  }

  return res.status(400).json({ ralat: 'action tak dikenali' })
}
