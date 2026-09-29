/**
 * /api/guestbook-sign — jana signed URL untuk buku tamu ALUNARA.
 *
 * KENAPA ENDPOINT INI WUJUD
 *   Bucket `alunara-guestbook` adalah PRIVAT. Tetamu tak log masuk, jadi dia
 *   tak boleh upload atau baca terus. Kalau kita beri anon key akses storage,
 *   sesiapa boleh teroka gambar majlis orang lain dengan meneka laluan.
 *
 *   Jadi: service role key TINGGAL DI SINI, di server. Browser hanya dapat
 *   URL bertandatangan yang luput dalam beberapa minit, untuk SATU fail
 *   tertentu sahaja.
 *
 * KESELAMATAN
 *   * `action=upload` — semak sesi tetamu betul & belum capai had, kemudian
 *     beri URL upload untuk laluan dalam folder majlis DIA sahaja.
 *   * `action=read`   — hanya benarkan laluan yang benar-benar ada dalam
 *     jadual untuk majlis itu dan tidak hidden. Jangan percaya laluan dari
 *     klien tanpa semak.
 *   * `action=download` — sama seperti read, TETAPI mesti admin sebenar
 *     (Bearer access_token) kerana ia untuk panel /admin. URL hayat 1 jam.
 *   * Had kadar ikut sesi supaya endpoint tak jadi mesin penjana URL.
 */

const BUCKET = 'alunara-guestbook'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

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
  // Buang entri lama supaya Map tak membengkak.
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

/** Semak sesi tetamu → pulangkan baris {id, event_id} atau null. */
async function sesiSah(session) {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRe.test(session || '')) return null

  const { ok, data } = await sb(
    `/rest/v1/alunara_guestbook_guests?session=eq.${session}` +
      `&select=id,event_id,alunara_guestbook_events!inner(id,active,upload_until,max_uploads_per_guest)`
  )
  if (!ok || !Array.isArray(data) || !data.length) return null

  const baris = data[0]
  const ev = baris.alunara_guestbook_events
  if (!ev?.active) return null
  if (new Date(ev.upload_until).getTime() < Date.now()) return null

  return { guest: baris.id, event: baris.event_id, had: ev.max_uploads_per_guest }
}

/**
 * Sahkan token admin. Guna token PENGGUNA itu sendiri (bukan service role)
 * untuk panggil `is_admin()` — jadi RLS + peranan yang menentukan, bukan kita.
 */
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

/** Sahkan laluan wujud dalam DB, tidak hidden, dan majlisnya masih ada. */
async function laluanDibenarkan(laluan) {
  const senarai = laluan.map((p) => `"${String(p).replace(/"/g, '')}"`).join(',')
  const { ok, data } = await sb(
    `/rest/v1/alunara_guestbook_photos?storage_path=in.(${encodeURIComponent(senarai)})` +
      `&hidden=eq.false&select=storage_path`
  )
  if (!ok || !Array.isArray(data)) return null
  const dibenarkan = new Set(data.map((r) => r.storage_path))
  return laluan.filter((p) => dibenarkan.has(p))
}

/** Jana signed URL baca untuk senarai laluan yang dah disahkan. */
async function signedUrls(sah) {
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ralat: 'Kaedah tak dibenarkan' })
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    // Jangan bocorkan nama env yang hilang — cuma kata ia belum siap.
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

    // Kira upload sedia ada. Padam gambar = dapat balik slot (adil).
    const { ok, data } = await sb(
      `/rest/v1/alunara_guestbook_photos?guest_id=eq.${sesi.guest}&select=id`
    )
    if (!ok) return res.status(502).json({ ralat: 'Gagal semak had' })
    if (data.length >= sesi.had) {
      return res.status(409).json({ ralat: `Dah capai had ${sesi.had} gambar` })
    }

    // Laluan DIJANA server — klien tak boleh pilih folder majlis lain.
    const nama = String(body?.nama || 'gambar')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(-40)
    const laluan = `${sesi.event}/${sesi.guest}-${Date.now()}-${nama || 'gambar'}.jpg`

    const { ok: okSign, data: signData } = await sb(
      `/storage/v1/object/upload/sign/${BUCKET}/${laluan}`,
      { method: 'POST', body: JSON.stringify({ expiresIn: 300 }) }
    )
    if (!okSign) return res.status(502).json({ ralat: 'Gagal jana URL muat naik' })

    // Supabase pulangkan {url: '/object/upload/sign/...?token=...'} relatif.
    const url = signData.url?.startsWith('http')
      ? signData.url
      : `${SUPABASE_URL}/storage/v1${signData.url}`

    return res.status(200).json({ laluan, url, token: signData.token ?? null })
  }

  // ------------------------------------------------------------------ READ
  if (action === 'read') {
    const laluan = Array.isArray(body?.laluan) ? body.laluan.slice(0, 300) : []
    if (!laluan.length) return res.status(400).json({ ralat: 'Tiada laluan' })

    // Jangan percaya laluan dari klien: sahkan setiap satu wujud dalam DB,
    // tidak hidden, dan majlisnya aktif. Kalau tidak, seseorang boleh minta
    // signed URL untuk gambar majlis orang lain.
    const sah = await laluanDibenarkan(laluan)
    if (sah === null) return res.status(502).json({ ralat: 'Gagal semak laluan' })
    if (!sah.length) return res.status(403).json({ ralat: 'Tiada laluan dibenarkan' })

    const peta = await signedUrls(sah)
    if (!peta) return res.status(502).json({ ralat: 'Gagal jana URL baca' })

    return res.status(200).json({ urls: peta })
  }

  // -------------------------------------------------------------- DOWNLOAD
  // Panel /admin. Sama seperti read, tetapi WAJIB token admin — kalau tidak
  // sesiapa boleh ambil senarai URL gambar majlis.
  if (action === 'download') {
    if (!(await adminSah(req.headers.authorization))) {
      return res.status(403).json({ ralat: 'Hanya admin' })
    }

    const laluan = Array.isArray(body?.laluan) ? body.laluan.slice(0, 300) : []
    if (!laluan.length) return res.status(400).json({ ralat: 'Tiada laluan' })

    const sah = await laluanDibenarkan(laluan)
    if (sah === null) return res.status(502).json({ ralat: 'Gagal semak laluan' })
    if (!sah.length) return res.status(403).json({ ralat: 'Tiada laluan dibenarkan' })

    const peta = await signedUrls(sah)
    if (!peta) return res.status(502).json({ ralat: 'Gagal jana URL muat turun' })

    return res.status(200).json({ urls: peta })
  }

  return res.status(400).json({ ralat: 'action tak dikenali' })
}
