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

/**
 * Lazily import archiver (hanya bila endpoint dipanggil).
 *
 * archiver 8.0.0 buang default export: tiada lagi `archiver('zip', ...)`,
 * ganti dengan kelas `ZipArchive`. Versi lama `arch(...)` menyebabkan
 * SETIAP muat turun ZIP gagal dengan "arch is not a function" — termasuk
 * butang di panel /admin, bukan hanya laluan tuan rumah.
 */
let ZipArchiveMod = null
async function zipKelas() {
  if (!ZipArchiveMod) ZipArchiveMod = (await import('archiver')).ZipArchive
  return ZipArchiveMod
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

/**
 * Kod unlock → senarai event_id, tapi HANYA kalau kod itu milik galeri
 * dengan slug yang diminta. Kod 1-guna sudah terikat pada gallery_id sejak
 * galeri dicipta (lihat alunara_gb_create_gallery), jadi ia berfungsi
 * sebagai kunci tuan rumah tanpa perlu login atau lajur baharu.
 *
 * TIGA QUERY, BUKAN SATU EMBED: PostgREST `!inner` embed pada lajur FK
 * nullable pulang 400 dalam produksi walaupun SQL yang sama lulus bila
 * diuji terus. Panggilan ringkas lebih membosankan tapi betul.
 *
 * Kod TIDAK ditanda guna di sini — ia kekal sah sebagai kunci host.
 * Pulangkan {eventIds, sebab}; sebab cuma untuk log, bukan untuk klien.
 */
async function kodHostSah(slug, kod) {
  const gagal = (sebab) => ({ eventIds: [], sebab })
  if (!slug || !/^[A-Za-z0-9]{4,20}$/.test(kod)) return gagal('format')

  const r1 = await sb(
    `/rest/v1/alunara_guestbook_unlock_codes?code=eq.${encodeURIComponent(kod.toUpperCase())}` +
      `&select=gallery_id`
  )
  if (!r1.ok) return gagal(`kod_http_${r1.status}`)
  const kodBaris = await r1.json()
  if (!Array.isArray(kodBaris) || !kodBaris.length) return gagal('kod_tak_jumpa')
  const galleryId = kodBaris[0]?.gallery_id
  if (!galleryId) return gagal('kod_tiada_galeri')

  const r2 = await sb(
    `/rest/v1/alunara_guestbook_galleries?id=eq.${encodeURIComponent(galleryId)}` +
      `&select=slug,active`
  )
  if (!r2.ok) return gagal(`galeri_http_${r2.status}`)
  const galeri = await r2.json()
  if (!Array.isArray(galeri) || !galeri.length) return gagal('galeri_tak_jumpa')
  const gal = galeri[0]
  if (!gal.active) return gagal('galeri_tidak_aktif')
  if (String(gal.slug).toLowerCase() !== slug.toLowerCase()) return gagal('slug_lain')

  const r3 = await sb(
    `/rest/v1/alunara_guestbook_events?gallery_id=eq.${encodeURIComponent(galleryId)}` +
      `&select=id`
  )
  if (!r3.ok) return gagal(`event_http_${r3.status}`)
  const event = await r3.json()
  if (!Array.isArray(event) || !event.length) return gagal('event_kosong')
  return { eventIds: event.map((e) => e.id), sebab: 'ok' }
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

  let body = {}
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    return res.status(400).json({ ralat: 'JSON tak sah.' })
  }

  // Dua jalan masuk:
  //   * admin  → Bearer token + event_id (panel /admin, satu sub-event)
  //   * tuan rumah → kod unlock 6 aksara + slug (tiada login, seluruh galeri)
  // Kod unlock ialah kunci host: ia terikat pada gallery_id sejak galeri
  // dicipta, jadi tiada lajur atau kod baharu perlu diedar.
  const eventId = String(body?.event_id || '')
  let eventIds = []
  let namaFail = eventId.slice(0, 8)

  if (eventId) {
    if (!(await adminSah(req.headers.authorization))) {
      return res.status(403).json({ ralat: 'Hanya admin.' })
    }
    eventIds = [eventId]
  } else {
    const slug = String(body?.slug || '').trim()
    const kod = String(body?.kod || '').trim()
    const hasil = await kodHostSah(slug, kod)
    eventIds = hasil.eventIds
    if (!eventIds.length) {
      console.warn('[guestbook-zip] kod host ditolak:', hasil.sebab)
      return res.status(403).json({ ralat: 'Kod tak sah untuk majlis ini.' })
    }
    namaFail = slug
  }

  // 1. Ambil senarai media dari DB (hidden=false).
  //    Jadual v2 — ia yang menyimpan foto + video + suara. Baca
  //    `alunara_guestbook_photos` (v1) bermakna video/suara hilang dari ZIP.
  const senaraiEvent = encodeURIComponent(eventIds.map((id) => `"${id}"`).join(','))
  const r1 = await sb(
    `/rest/v1/alunara_guestbook_media?event_id=in.(${senaraiEvent})` +
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
  const ZipArchive = await zipKelas()
  const zip = new ZipArchive({ zlib: { level: 6 } })
  res.status(200)
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="buku-tamu-${namaFail}.zip"`)

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
