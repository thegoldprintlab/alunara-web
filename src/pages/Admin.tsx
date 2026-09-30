import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  bacaSesi,
  type Sesi,
  db,
  dbSedia,
  logKeluar,
  logMasuk,
  sahkanAdmin,
  sesiSah,
  tarikhSibukSet,
} from '../lib/admin'
import type { Booking, Klien, Lead, Majlis, Entri, UnlockCode, Galeri } from '../lib/admin'
import { PAKEJ } from '../content'
import { IconWhatsApp } from '../components/Icons'

/* ---------------------------------------------------------------------------
 * Panel admin ALUNARA — ganti kerja manual edit src/content.ts + deploy.
 *
 * Batasan yang disengajakan: ini alat DALAMAN. Ia bergantung pada RLS
 * (profiles.role = 'admin') untuk perlindungan data, bukan pada UI ini.
 * ------------------------------------------------------------------------- */

const STATUS: Record<string, string> = {
  enquiry: 'Pertanyaan',
  pending: 'Menunggu Deposit',
  confirmed: 'Disahkan',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}

const ASAL: Record<string, string> = {
  baru: 'Baru',
  dihubungi: 'Dah Dihubungi',
  tempah: 'Dah Tempah',
  mati: 'Mati',
}

const ADDON_HARGA = 59
const DEPOSIT_PIAWAI = 50

/* ------------------------------- UTIL ------------------------------- */

const rm = (n: number) =>
  'RM ' + Number(n || 0).toLocaleString('ms-MY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

function tarikhMs(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso)
  return d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Baki hari sebelum majlis. Negatif = dah lepas. */
function bakiHari(iso: string): number {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  const hariIni = new Date()
  hariIni.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - hariIni.getTime()) / 86400000)
}

function waNombor(p: string | null): string {
  const digit = (p ?? '').replace(/\D/g, '')
  if (!digit) return ''
  // Buang 0 depan untuk guna format antarabangsa 60.
  return digit.startsWith('60') ? digit : '6' + digit
}

function waLink(phone: string | null, teks: string): string {
  return `https://wa.me/${waNombor(phone)}?text=${encodeURIComponent(teks)}`
}

const kosPakej = (id: string | null): { nama: string; harga: number } => {
  const p = PAKEJ.find((x) => x.id === id)
  return p ? { nama: p.nama, harga: p.hargaNum } : { nama: id ?? '—', harga: 0 }
}

/* ------------------------------ SKRIN LOG MASUK ------------------------------ */

function Login({ onMasuk }: { onMasuk: () => void }) {
  const [email, setEmail] = useState('')
  const [kata, setKata] = useState('')
  const [ralat, setRalat] = useState('')
  const [sibuk, setSibuk] = useState(false)

  async function hantar(e: React.FormEvent) {
    e.preventDefault()
    setSibuk(true)
    setRalat('')
    const res = await logMasuk(email.trim(), kata)
    if (!res.ok) {
      setSibuk(false)
      return setRalat(res.ralat ?? 'Log masuk gagal.')
    }
    const sah = await sahkanAdmin()
    setSibuk(false)
    if (!sah.ok) {
      logKeluar()
      return setRalat(sah.ralat ?? 'Akaun ini bukan admin.')
    }
    onMasuk()
  }

  return (
    <section className="page section">
      <div className="container container--narrow">
        <div className="page__head">
          <div className="eyebrow">ALUNARA</div>
          <h1>Log Masuk Admin</h1>
          <div className="divider" />
        </div>

        {!dbSedia && (
          <p className="adm__ralat">
            VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tak diset dalam build ini. Panel admin takkan
            boleh sambung ke pangkalan data.
          </p>
        )}

        <form onSubmit={hantar} className="adm__kad">
          <div className="field">
            <label htmlFor="a-email">Email</label>
            <input
              id="a-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label htmlFor="a-kata">Kata Laluan</label>
            <input
              id="a-kata"
              type="password"
              autoComplete="current-password"
              value={kata}
              onChange={(e) => setKata(e.target.value)}
              required
            />
          </div>
          {ralat && <p className="adm__ralat">{ralat}</p>}
          <button type="submit" className="btn btn--gold btn--block" disabled={sibuk}>
            {sibuk ? 'Menyemak…' : 'Log Masuk'}
          </button>
        </form>

        <p className="adm__nota">
          Panel dalaman. Data pelanggan dilindungi oleh RLS Supabase — akaun tanpa peranan{' '}
          <code>admin</code> takkan nampak apa-apa pun. <Link to="/">Balik ke laman</Link>
        </p>
      </div>
    </section>
  )
}

/* ------------------------------ TAB: TEMPAHAN ------------------------------ */

type BorangTempahan = {
  id?: string
  client_id: string
  event_date: string
  customer_name: string
  customer_phone: string
  event_type: string
  package_id: string
  addon: boolean
  theme: string
  venue: string
  location: string
  setup_time: string
  status: string
  deposit_amount: number
  paid_amount: number
  notes: string
}

const BORANG_KOSONG: BorangTempahan = {
  client_id: '',
  event_date: '',
  customer_name: '',
  customer_phone: '',
  event_type: 'Hari Jadi',
  package_id: 'bayu',
  addon: false,
  theme: 'Floral',
  venue: '',
  location: 'Melaka',
  setup_time: '',
  status: 'confirmed',
  deposit_amount: DEPOSIT_PIAWAI,
  paid_amount: 0,
  notes: '',
}

function TabTempahan({ sesi }: { sesi: NonNullable<ReturnType<typeof bacaSesi>> }) {
  const [senarai, setSenarai] = useState<Booking[]>([])
  const [klien, setKlien] = useState<Klien[]>([])
  const [muat, setMuat] = useState(true)
  const [ralat, setRalat] = useState('')
  const [pesan, setPesan] = useState('')
  const [tapisan, setTapisan] = useState('aktif')
  const [cari, setCari] = useState('')
  const [borang, setBorang] = useState<BorangTempahan | null>(null)

  const muatSemula = useCallback(async () => {
    setMuat(true)
    const [t, k] = await Promise.all([db.tempahan(sesi), db.klien(sesi)])
    setMuat(false)
    if (!t.ok) return setRalat(t.ralat ?? 'Gagal muat tempahan.')
    if (!k.ok) return setRalat(k.ralat ?? 'Gagal muat klien.')
    setSenarai(t.data ?? [])
    setKlien(k.data ?? [])
    setRalat('')
  }, [sesi])

  useEffect(() => {
    void muatSemula()
  }, [muatSemula])

  const tapis = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return senarai.filter((b) => {
      if (tapisan === 'aktif' && ['cancelled', 'completed'].includes(b.status)) return false
      if (tapisan !== 'aktif' && tapisan !== 'semua' && b.status !== tapisan) return false
      if (!q) return true
      return (
        b.customer_name.toLowerCase().includes(q) ||
        (b.customer_phone ?? '').includes(q) ||
        (b.venue ?? '').toLowerCase().includes(q)
      )
    })
  }, [senarai, tapisan, cari])

  const ringkas = useMemo(() => {
    const aktif = senarai.filter((b) => !['cancelled', 'completed'].includes(b.status))
    const bakal = aktif
      .filter((b) => new Date(b.event_date.slice(0, 10) + 'T00:00:00') >= new Date(new Date().toDateString()))
      .reduce((a, b) => a + Number(b.total_amount || 0), 0)
    const belumKutip = aktif.reduce(
      (a, b) => a + Math.max(0, Number(b.total_amount || 0) - Number(b.paid_amount || 0)),
      0,
    )
    const bulanIni = senarai.filter((b) => {
      const d = new Date(b.event_date.slice(0, 10) + 'T00:00:00')
      const n = new Date()
      return b.status !== 'cancelled' && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
    }).length
    return { aktif: aktif.length, bakal, belumKutip, bulanIni }
  }, [senarai])

  function bukaBaru() {
    setPesan('')
    setBorang({ ...BORANG_KOSONG })
  }

  function bukaEdit(b: Booking) {
    setPesan('')
    setBorang({
      id: b.id,
      client_id: b.client_id ?? '',
      event_date: b.event_date.slice(0, 10),
      customer_name: b.customer_name,
      customer_phone: b.customer_phone ?? '',
      event_type: b.event_type ?? 'Hari Jadi',
      package_id: b.package_id ?? b.package_tier ?? 'bayu',
      addon: Boolean(b.addon),
      theme: b.theme ?? 'Floral',
      venue: b.venue ?? '',
      location: b.location ?? 'Melaka',
      setup_time: b.setup_time ?? '',
      status: b.status,
      deposit_amount: Number(b.deposit_amount || 0),
      paid_amount: Number(b.paid_amount || 0),
      notes: b.notes ?? '',
    })
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault()
    if (!borang) return
    if (!borang.event_date) return setPesan('Tarikh majlis wajib diisi.')
    if (borang.customer_name.trim().length < 2) return setPesan('Nama klien terlalu pendek.')

    const pakej = kosPakej(borang.package_id)
    const jumlah = pakej.harga + (borang.addon ? ADDON_HARGA : 0)

    // Tag nama dalam jadual booking sengaja disalin dari klien — supaya senarai
    // tempahan kekal boleh dibaca walaupun klien dipadam kemudian.
    const muatan = {
      client_id: borang.client_id || null,
      event_date: borang.event_date,
      customer_name: borang.customer_name.trim(),
      customer_phone: borang.customer_phone.trim() || null,
      event_type: borang.event_type,
      package_id: borang.package_id,
      package_tier: borang.package_id,
      addon: borang.addon,
      theme: borang.theme,
      venue: borang.venue.trim() || null,
      location: borang.location.trim() || null,
      setup_time: borang.setup_time.trim() || null,
      status: borang.status,
      total_amount: jumlah,
      deposit_amount: Number(borang.deposit_amount || 0),
      paid_amount: Number(borang.paid_amount || 0),
      notes: borang.notes.trim() || null,
    }

    const res = borang.id
      ? await db.kemasTempahan(sesi, borang.id, muatan)
      : await db.tambahTempahan(sesi, muatan)

    if (!res.ok) return setPesan(res.ralat ?? 'Gagal simpan.')

    // Kalau tarikh itu dah dipakai tempahan lain yang belum dibatal, DB tolak
    // (unique index). Di sini kita cuma laporkan bila pulangan kosong.
    if (!borang.id && (!res.data || res.data.length === 0)) {
      return setPesan('Tarikh itu dah ada tempahan aktif. Batalkan yang lama dulu.')
    }

    // Auto-cipta klien kalau booking baru tak dikaitkan dengan klien sedia ada.
    // Ini pastikan klien muncul di tab "Klien" tanpa langkah tambahan.
    if (!borang.id && !borang.client_id) {
      try {
        const k = await db.tambahKlien(sesi, {
          name: borang.customer_name.trim(),
          phone: borang.customer_phone.trim() || null,
          source: 'booking',
        })
        // Link booking tadi ke klien baru.
        if (k.ok && k.data?.[0]?.id && res.data?.[0]?.id) {
          await db.kemasTempahan(sesi, res.data[0].id, { client_id: k.data[0].id })
        }
      } catch {
        /* best-effort — klien boleh ditambah manual nanti */
      }
    }

    setPesan('Disimpan.')
    setBorang(null)
    await muatSemula()
  }

  async function tukarStatus(b: Booking, status: string) {
    const res = await db.kemasTempahan(sesi, b.id, { status })
    if (!res.ok) return setPesan(res.ralat ?? 'Gagal tukar status.')
    await muatSemula()
  }

  async function buang(b: Booking) {
    if (!confirm(`Padam tempahan ${b.customer_name} (${tarikhMs(b.event_date)})?`)) return
    const res = await db.buangTempahan(sesi, b.id)
    if (!res.ok) return setPesan(res.ralat ?? 'Gagal padam.')
    await muatSemula()
  }

  const sibukTarikh = tarikhSibukSet(senarai)

  return (
    <>
      <div className="adm__strip">
        <div className="adm__kpi">
          <span className="adm__kpi-angka">{ringkas.aktif}</span>
          <span className="adm__kpi-label">Tempahan Aktif</span>
        </div>
        <div className="adm__kpi">
          <span className="adm__kpi-angka">{ringkas.bulanIni}</span>
          <span className="adm__kpi-label">Majlis Bulan Ini</span>
        </div>
        <div className="adm__kpi">
          <span className="adm__kpi-angka">{rm(ringkas.bakal)}</span>
          <span className="adm__kpi-label">Nilai Bakal</span>
        </div>
        <div className="adm__kpi">
          <span className="adm__kpi-angka">{rm(ringkas.belumKutip)}</span>
          <span className="adm__kpi-label">Belum Kutip</span>
        </div>
      </div>

      <div className="adm__bar">
        <button className="btn btn--gold btn--sm" onClick={bukaBaru}>
          + Tempahan Baru
        </button>
        <input
          className="adm__cari"
          placeholder="Cari nama / telefon / lokasi…"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
        <select value={tapisan} onChange={(e) => setTapisan(e.target.value)} className="adm__tapisan">
          <option value="aktif">Aktif sahaja</option>
          <option value="semua">Semua</option>
          <option value="pending">Menunggu Deposit</option>
          <option value="confirmed">Disahkan</option>
          <option value="completed">Selesai</option>
          <option value="cancelled">Dibatalkan</option>
        </select>
      </div>

      {pesan && <p className="adm__pesan">{pesan}</p>}
      {ralat && <p className="adm__ralat">{ralat}</p>}

      {borang && (
        <form className="adm__kad" onSubmit={simpan}>
          <h3>{borang.id ? 'Kemas Tempahan' : 'Tempahan Baru'}</h3>
          <div className="adm__grid">
            <div className="field">
              <label htmlFor="b-tarikh">Tarikh majlis *</label>
              <input
                id="b-tarikh"
                type="date"
                value={borang.event_date}
                onChange={(e) => setBorang({ ...borang, event_date: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="b-klien">Klien sedia ada</label>
              <select
                id="b-klien"
                value={borang.client_id}
                onChange={(e) => {
                  const k = klien.find((x) => x.id === e.target.value)
                  setBorang({
                    ...borang,
                    client_id: e.target.value,
                    // Isi nama/telefon automatik bila pilih klien lama.
                    customer_name: k ? k.name : borang.customer_name,
                    customer_phone: k?.phone ?? borang.customer_phone,
                    location: k?.area ?? borang.location,
                  })
                }}
              >
                <option value="">— klien baru —</option>
                {klien.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} {k.phone ? `(${k.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="b-nama">Nama klien *</label>
              <input
                id="b-nama"
                value={borang.customer_name}
                onChange={(e) => setBorang({ ...borang, customer_name: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="b-tel">No. WhatsApp</label>
              <input
                id="b-tel"
                type="tel"
                value={borang.customer_phone}
                onChange={(e) => setBorang({ ...borang, customer_phone: e.target.value })}
                placeholder="cth. 012-3456789"
              />
            </div>
            <div className="field">
              <label htmlFor="b-jenis">Jenis majlis</label>
              <select
                id="b-jenis"
                value={borang.event_type}
                onChange={(e) => setBorang({ ...borang, event_type: e.target.value })}
              >
                {['Hari Jadi', 'Kahwin / Tunang', 'Aqiqah / Cukur Jambul', 'Korporat', 'Lain-lain'].map(
                  (j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="field">
              <label htmlFor="b-pakej">Pakej</label>
              <select
                id="b-pakej"
                value={borang.package_id}
                onChange={(e) => setBorang({ ...borang, package_id: e.target.value })}
              >
                {PAKEJ.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} — {p.harga}
                  </option>
                ))}
                <option value="custom">Custom / lain</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="b-tema">Tema</label>
              <select
                id="b-tema"
                value={borang.theme}
                onChange={(e) => setBorang({ ...borang, theme: e.target.value })}
              >
                {['Floral', 'Minimalist', 'Rustic'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="b-venue">Nama dewan / alamat</label>
              <input
                id="b-venue"
                value={borang.venue}
                onChange={(e) => setBorang({ ...borang, venue: e.target.value })}
                placeholder="cth. Dewan Kampung Bukit Katil"
              />
            </div>
            <div className="field">
              <label htmlFor="b-lokasi">Kawasan (untuk caj hantar)</label>
              <input
                id="b-lokasi"
                value={borang.location}
                onChange={(e) => setBorang({ ...borang, location: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="b-setup">Masa setup</label>
              <input
                id="b-setup"
                value={borang.setup_time}
                onChange={(e) => setBorang({ ...borang, setup_time: e.target.value })}
                placeholder="cth. sehari sebelum, 4 petang"
              />
            </div>
            <div className="field">
              <label htmlFor="b-status">Status</label>
              <select
                id="b-status"
                value={borang.status}
                onChange={(e) => setBorang({ ...borang, status: e.target.value })}
              >
                {Object.entries(STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="b-deposit">Deposit (RM)</label>
              <input
                id="b-deposit"
                type="number"
                min={0}
                value={borang.deposit_amount}
                onChange={(e) => setBorang({ ...borang, deposit_amount: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label htmlFor="b-bayar">Dah Bayar (RM)</label>
              <input
                id="b-bayar"
                type="number"
                min={0}
                value={borang.paid_amount}
                onChange={(e) => setBorang({ ...borang, paid_amount: Number(e.target.value) })}
              />
            </div>
          </div>

          <label className="adm__semak">
            <input
              type="checkbox"
              checked={borang.addon}
              onChange={(e) => setBorang({ ...borang, addon: e.target.checked })}
            />
            <span>Tambahan Majlis (+{rm(ADDON_HARGA)}: tapak kek, bekas air, kipas)</span>
          </label>

          <div className="field">
            <label htmlFor="b-nota">Nota</label>
            <textarea
              id="b-nota"
              className="adm__input--area"
              rows={3}
              value={borang.notes}
              onChange={(e) => setBorang({ ...borang, notes: e.target.value })}
            />
          </div>

          <p className="adm__hint">
            Jumlah dikira automatik: {kosPakej(borang.package_id).nama}{' '}
            {borang.addon ? `+ add-on ${rm(ADDON_HARGA)}` : ''} ={' '}
            <strong>{rm(kosPakej(borang.package_id).harga + (borang.addon ? ADDON_HARGA : 0))}</strong>
          </p>

          <div className="adm__aksi">
            <button type="submit" className="btn btn--solid btn--sm">
              Simpan
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setBorang(null)}>
              Batal
            </button>
          </div>
        </form>
      )}

      {muat ? (
        <p className="muted">Memuat…</p>
      ) : tapis.length === 0 ? (
        <p className="muted">Tiada tempahan untuk tapisan ini.</p>
      ) : (
        <div className="adm__jadual-bungkus">
          <table className="adm__jadual">
            <thead>
              <tr>
                <th>Tarikh</th>
                <th>Klien</th>
                <th>Pakej</th>
                <th>Lokasi</th>
                <th>Bayaran</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tapis.map((b) => {
                const hari = bakiHari(b.event_date)
                const pakej = kosPakej(b.package_id ?? b.package_tier)
                const baki = Number(b.total_amount || 0) - Number(b.paid_amount || 0)
                return (
                  <tr key={b.id} className={b.status === 'cancelled' ? 'adm__baris--mati' : ''}>
                    <td>
                      <div className="adm__tarikh">{tarikhMs(b.event_date)}</div>
                      {b.status !== 'cancelled' && (
                        <div className="adm__kecil">
                          {hari < 0 ? `${Math.abs(hari)} hari lepas` : hari === 0 ? 'Hari ini' : `${hari} hari lagi`}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="adm__nama">{b.customer_name}</div>
                      <div className="adm__kecil">{b.customer_phone ?? '—'}</div>
                    </td>
                    <td>
                      <div>
                        {pakej.nama}
                        {b.addon ? ' + add-on' : ''}
                      </div>
                      <div className="adm__kecil">
                        {b.theme ?? '—'} · {rm(b.total_amount)}
                      </div>
                    </td>
                    <td>
                      <div>{b.venue ?? b.location ?? '—'}</div>
                      <div className="adm__kecil">{b.setup_time ?? ''}</div>
                    </td>
                    <td>
                      <div className={baki > 0 ? 'adm__baki' : 'adm__lunas'}>
                        {baki > 0 ? `Baki ${rm(baki)}` : 'Lunas'}
                      </div>
                      <div className="adm__kecil">Bayar {rm(b.paid_amount)}</div>
                    </td>
                    <td>
                      <select
                        className="adm__status"
                        value={b.status}
                        onChange={(e) => tukarStatus(b, e.target.value)}
                      >
                        {Object.entries(STATUS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="adm__aksi-sel">
                      <button className="adm__pautan" onClick={() => bukaEdit(b)}>
                        Edit
                      </button>
                      {b.customer_phone && (
                        <a
                          className="adm__pautan"
                          href={waLink(
                            b.customer_phone,
                            `Hi ${b.customer_name}, ALUNARA di sini pasal majlis ${tarikhMs(b.event_date)}.`,
                          )}
                          target="_blank"
                          rel="noreferrer noopener"
                          title="WhatsApp klien"
                        >
                          <IconWhatsApp />
                        </a>
                      )}
                      <button className="adm__pautan adm__pautan--bahaya" onClick={() => buang(b)}>
                        Padam
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="adm__nota">
        Tarikh yang dipakai tempahan aktif ({sibukTarikh.size} tarikh) akan dipaparkan sebagai penuh
        di kalendar awam /tempah.
      </p>
    </>
  )
}

/* ------------------------------ TAB: KLIEN ------------------------------ */

type BorangKlien = {
  id?: string
  name: string
  phone: string
  email: string
  source: string
  area: string
  notes: string
}

const KLIEN_KOSONG: BorangKlien = { name: '', phone: '', email: '', source: 'WhatsApp', area: '', notes: '' }

function TabKlien({ sesi }: { sesi: NonNullable<ReturnType<typeof bacaSesi>> }) {
  const [senarai, setSenarai] = useState<Klien[]>([])
  const [muat, setMuat] = useState(true)
  const [ralat, setRalat] = useState('')
  const [pesan, setPesan] = useState('')
  const [borang, setBorang] = useState<BorangKlien | null>(null)
  const [cari, setCari] = useState('')

  const muatSemula = useCallback(async () => {
    setMuat(true)
    const r = await db.klien(sesi)
    setMuat(false)
    if (!r.ok) return setRalat(r.ralat ?? 'Gagal muat klien.')
    setSenarai(r.data ?? [])
    setRalat('')
  }, [sesi])

  useEffect(() => {
    void muatSemula()
  }, [muatSemula])

  const tapis = useMemo(() => {
    const q = cari.trim().toLowerCase()
    if (!q) return senarai
    return senarai.filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        (k.phone ?? '').includes(q) ||
        (k.area ?? '').toLowerCase().includes(q),
    )
  }, [senarai, cari])

  async function simpan(e: React.FormEvent) {
    e.preventDefault()
    if (!borang) return
    if (borang.name.trim().length < 2) return setPesan('Nama terlalu pendek.')
    const muatan = {
      name: borang.name.trim(),
      phone: borang.phone.trim() || null,
      email: borang.email.trim() || null,
      source: borang.source,
      area: borang.area.trim() || null,
      notes: borang.notes.trim() || null,
    }
    const res = borang.id
      ? await db.kemasKlien(sesi, borang.id, muatan)
      : await db.tambahKlien(sesi, muatan)
    if (!res.ok) return setPesan(res.ralat ?? 'Gagal simpan.')
    setPesan('Disimpan.')
    setBorang(null)
    await muatSemula()
  }

  async function buang(k: Klien) {
    if (!confirm(`Padam klien ${k.name}? Tempahan dia kekal, cuma tak lagi berpaut.`)) return
    const res = await db.buangKlien(sesi, k.id)
    if (!res.ok) return setPesan(res.ralat ?? 'Gagal padam.')
    await muatSemula()
  }

  return (
    <>
      <div className="adm__bar">
        <button className="btn btn--gold btn--sm" onClick={() => { setPesan(''); setBorang({ ...KLIEN_KOSONG }) }}>
          + Klien Baru
        </button>
        <input
          className="adm__cari"
          placeholder="Cari nama / telefon / kawasan…"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
      </div>

      {pesan && <p className="adm__pesan">{pesan}</p>}
      {ralat && <p className="adm__ralat">{ralat}</p>}

      {borang && (
        <form className="adm__kad" onSubmit={simpan}>
          <h3>{borang.id ? 'Kemas Klien' : 'Klien Baru'}</h3>
          <div className="adm__grid">
            <div className="field">
              <label htmlFor="k-nama">Nama *</label>
              <input
                id="k-nama"
                value={borang.name}
                onChange={(e) => setBorang({ ...borang, name: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="k-tel">No. WhatsApp</label>
              <input
                id="k-tel"
                type="tel"
                value={borang.phone}
                onChange={(e) => setBorang({ ...borang, phone: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="k-email">Email</label>
              <input
                id="k-email"
                type="email"
                value={borang.email}
                onChange={(e) => setBorang({ ...borang, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="k-kawasan">Kawasan</label>
              <input
                id="k-kawasan"
                value={borang.area}
                onChange={(e) => setBorang({ ...borang, area: e.target.value })}
                placeholder="cth. Ayer Keroh"
              />
            </div>
            <div className="field">
              <label htmlFor="k-asal">Dari mana</label>
              <select
                id="k-asal"
                value={borang.source}
                onChange={(e) => setBorang({ ...borang, source: e.target.value })}
              >
                {['WhatsApp', 'Instagram', 'Threads', 'TikTok', 'Web', 'Referral', 'Walk-in'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="k-nota">Nota</label>
            <textarea
              id="k-nota"
              className="adm__input--area"
              rows={2}
              value={borang.notes}
              onChange={(e) => setBorang({ ...borang, notes: e.target.value })}
            />
          </div>
          <div className="adm__aksi">
            <button type="submit" className="btn btn--solid btn--sm">
              Simpan
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setBorang(null)}>
              Batal
            </button>
          </div>
        </form>
      )}

      {muat ? (
        <p className="muted">Memuat…</p>
      ) : tapis.length === 0 ? (
        <p className="muted">Tiada klien lagi. Tekan “Klien Baru” atau biar lead masuk dari laman.</p>
      ) : (
        <div className="adm__jadual-bungkus">
          <table className="adm__jadual">
            <thead>
              <tr>
                <th>Nama</th>
                <th>WhatsApp</th>
                <th>Kawasan</th>
                <th>Dari</th>
                <th>Nota</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tapis.map((k) => (
                <tr key={k.id}>
                  <td className="adm__nama">{k.name}</td>
                  <td>
                    {k.phone ? (
                      <a
                        className="adm__pautan"
                        href={waLink(k.phone, `Hi ${k.name}, ALUNARA di sini.`)}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {k.phone}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{k.area ?? '—'}</td>
                  <td>{k.source ?? '—'}</td>
                  <td className="adm__kecil">{k.notes ?? '—'}</td>
                  <td className="adm__aksi-sel">
                    <button
                      className="adm__pautan"
                      onClick={() => {
                        setPesan('')
                        setBorang({
                          id: k.id,
                          name: k.name,
                          phone: k.phone ?? '',
                          email: k.email ?? '',
                          source: k.source ?? 'WhatsApp',
                          area: k.area ?? '',
                          notes: k.notes ?? '',
                        })
                      }}
                    >
                      Edit
                    </button>
                    <button className="adm__pautan adm__pautan--bahaya" onClick={() => buang(k)}>
                      Padam
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

/* ------------------------------ TAB: LEAD ------------------------------ */

function TabLead({ sesi }: { sesi: NonNullable<ReturnType<typeof bacaSesi>> }) {
  const [senarai, setSenarai] = useState<Lead[]>([])
  const [muat, setMuat] = useState(true)
  const [ralat, setRalat] = useState('')
  const [pesan, setPesan] = useState('')
  const [jenis, setJenis] = useState('baru')

  const muatSemula = useCallback(async () => {
    setMuat(true)
    const r = await db.leads(sesi)
    setMuat(false)
    if (!r.ok) return setRalat(r.ralat ?? 'Gagal muat lead.')
    setSenarai(r.data ?? [])
    setRalat('')
  }, [sesi])

  useEffect(() => {
    void muatSemula()
  }, [muatSemula])

  const tapis = useMemo(
    () => (jenis === 'semua' ? senarai : senarai.filter((l) => l.status === jenis)),
    [senarai, jenis],
  )

  async function tukarStatus(l: Lead, status: string) {
    const res = await db.kemasLead(sesi, l.id, { status })
    if (!res.ok) return setPesan(res.ralat ?? 'Gagal kemas kini.')
    await muatSemula()
  }

  async function buang(l: Lead) {
    if (!confirm(`Padam lead ${l.name}?`)) return
    const res = await db.buangLead(sesi, l.id)
    if (!res.ok) return setPesan(res.ralat ?? 'Gagal padam.')
    await muatSemula()
  }

  return (
    <>
      <div className="adm__bar">
        <select value={jenis} onChange={(e) => setJenis(e.target.value)} className="adm__tapisan">
          <option value="baru">Baru</option>
          <option value="dihubungi">Dah Dihubungi</option>
          <option value="tempah">Dah Tempah</option>
          <option value="mati">Mati</option>
          <option value="semua">Semua</option>
        </select>
        <button className="btn btn--ghost btn--sm" onClick={() => void muatSemula()}>
          Muat semula
        </button>
      </div>

      {pesan && <p className="adm__pesan">{pesan}</p>}
      {ralat && <p className="adm__ralat">{ralat}</p>}

      {muat ? (
        <p className="muted">Memuat…</p>
      ) : tapis.length === 0 ? (
        <p className="muted">Tiada lead dalam kategori ini.</p>
      ) : (
        <div className="adm__jadual-bungkus">
          <table className="adm__jadual">
            <thead>
              <tr>
                <th>Masuk</th>
                <th>Nama</th>
                <th>Tarikh majlis</th>
                <th>Minat</th>
                <th>Dari</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tapis.map((l) => (
                <tr key={l.id}>
                  <td className="adm__kecil">{tarikhMs(l.created_at)}</td>
                  <td>
                    <div className="adm__nama">{l.name}</div>
                    <div className="adm__kecil">{l.phone ?? '—'}</div>
                  </td>
                  <td>{l.event_date ? tarikhMs(l.event_date) : '—'}</td>
                  <td className="adm__kecil">{l.interest ?? '—'}</td>
                  <td className="adm__kecil">
                    {l.source ?? '—'}
                    <br />
                    {l.source_page ?? ''}
                  </td>
                  <td>
                    <select
                      className="adm__status"
                      value={l.status}
                      onChange={(e) => tukarStatus(l, e.target.value)}
                    >
                      {Object.entries(ASAL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="adm__aksi-sel">
                    {l.phone && (
                      <a
                        className="adm__pautan"
                        href={waLink(
                          l.phone,
                          `Hi ${l.name}, ALUNARA di sini. Terima kasih tanya pasal sewa meja & kerusi bertema.`,
                        )}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        <IconWhatsApp />
                      </a>
                    )}
                    <button className="adm__pautan adm__pautan--bahaya" onClick={() => buang(l)}>
                      Padam
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

/* ------------------------------ SHELL ------------------------------ */

/* ---------------------------- TAB BUKU TAMU ----------------------------
 * Bos buat satu "majlis" → dapat kod → kod tu jadi QR. Tetamu scan, upload.
 * Gambar dalam bucket privat; kita papar guna signed URL (jana di server).
 * ---------------------------------------------------------------------- */

function TabTamu({ sesi }: { sesi: Sesi }) {
  const [majlis, setMajlis] = useState<Majlis[]>([])
  const [pilih, setPilih] = useState<string>('')
  const [entri, setEntri] = useState<Entri[]>([])
  const [muat, setMuat] = useState(true)
  const [ralat, setRalat] = useState('')
  const [baru, setBaru] = useState({ title: '', host_name: '', event_date: '' })
  const [buat, setBuat] = useState(false)
  const [urls, setUrls] = useState<Record<string, string>>({})

  // unlock code (self-serve)
  const [unlockList, setUnlockList] = useState<UnlockCode[]>([])
  const [unlockBaru, setUnlockBaru] = useState('')
  const [unlockBuat, setUnlockBuat] = useState(false)

  // gallery v2 (self-serve) — papar sub-event, tambah sub-event
  const [galeri, setGaleri] = useState<Galeri[]>([])
  const [galeriPilih, setGaleriPilih] = useState('')
  const [subEvents, setSubEvents] = useState<Majlis[]>([])
  const [subBaru, setSubBaru] = useState({ label: '', event_type: 'wedding', event_date: '' })
  const [subBuat, setSubBuat] = useState(false)

  const muatUnlock = useCallback(async () => {
    try {
      const r = await db.unlockCodes(sesi)
      if (r.ok) setUnlockList(r.data ?? [])
    } catch {
      /* abaikan */
    }
  }, [sesi])

  useEffect(() => {
    void muatUnlock()
  }, [muatUnlock])

  // --- gallery v2 ---
  const muatGaleri = useCallback(async () => {
    try {
      const r = await db.galeri(sesi)
      if (r.ok) {
        const g = r.data ?? []
        setGaleri(g)
        setGaleriPilih((kini) => kini || g[0]?.id || '')
      }
    } catch {
      /* abaikan */
    }
  }, [sesi])

  useEffect(() => {
    void muatGaleri()
  }, [muatGaleri])

  useEffect(() => {
    if (!galeriPilih) return
    let batal = false
    void (async () => {
      const r = await db.galeriEvent(sesi, galeriPilih)
      if (!batal && r.ok) setSubEvents(r.data ?? [])
    })()
    return () => {
      batal = true
    }
  }, [galeriPilih, sesi])

  async function tambahSubEvent() {
    if (subBaru.label.trim().length < 2) {
      setRalat('Isi label sub-event dulu (cth. Resepsi Lelaki).')
      return
    }
    setSubBuat(true)
    setRalat('')
    try {
      const r = await db.tambahSubEvent(sesi, galeriPilih, {
        label: subBaru.label.trim(),
        event_type: subBaru.event_type,
        event_date: subBaru.event_date || undefined,
      })
      if (!r.ok) {
        setRalat(r.ralat ?? 'Gagal tambah sub-event')
        return
      }
      setSubBaru({ label: '', event_type: 'wedding', event_date: '' })
      const r2 = await db.galeriEvent(sesi, galeriPilih)
      if (r2.ok) setSubEvents(r2.data ?? [])
    } catch (e) {
      setRalat(e instanceof Error ? e.message : 'Gagal tambah sub-event')
    } finally {
      setSubBuat(false)
    }
  }

  async function janaUnlock(isPro: boolean) {
    setUnlockBuat(true)
    setRalat('')
    try {
      const r = await db.janaUnlockCode(sesi, isPro, '')
      if (!r.ok || typeof r.data !== 'string') {
        setRalat(r.ralat ?? 'Gagal jana kod')
        return
      }
      setUnlockBaru(r.data)
      await muatUnlock()
    } catch (e) {
      setRalat(e instanceof Error ? e.message : 'Gagal jana kod')
    } finally {
      setUnlockBuat(false)
    }
  }

  const muatMajlis = useCallback(async () => {
    setMuat(true)
    setRalat('')
    try {
      const r = await db.majlis(sesi)
      if (!r.ok) {
        setRalat(r.ralat ?? 'Gagal muat majlis')
        return
      }
      const m = r.data ?? []
      setMajlis(m)
      setPilih((kini) => kini || m[0]?.id || '')
    } catch (e) {
      setRalat(e instanceof Error ? e.message : 'Gagal muat majlis')
    } finally {
      setMuat(false)
    }
  }, [sesi])

  useEffect(() => {
    void muatMajlis()
  }, [muatMajlis])

  /** Ambil signed URL untuk semua gambar dalam majlis terpilih. */
  useEffect(() => {
    if (!pilih) return
    let batal = false
    ;(async () => {
      try {
        const r = await db.entri(sesi, pilih)
        if (batal) return
        if (!r.ok) {
          setRalat(r.ralat ?? 'Gagal muat entri')
          return
        }
        const e = r.data ?? []
        setEntri(e)
        if (!e.length) return
        const res = await fetch('/api/guestbook-sign', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${sesi.access_token}`,
          },
          body: JSON.stringify({ action: 'read', laluan: e.map((x) => x.storage_path) }),
        })
        const j = (await res.json()) as { urls?: Record<string, string>; ralat?: string }
        if (batal) return
        if (j.urls) setUrls(j.urls)
        else if (j.ralat) setRalat(j.ralat)
      } catch (err) {
        if (!batal) setRalat(err instanceof Error ? err.message : 'Gagal muat entri')
      }
    })()
    return () => {
      batal = true
    }
  }, [pilih, sesi])

  const majlisPilih = majlis.find((m) => m.id === pilih)

  const pautan = majlisPilih
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/buku-tamu/${majlisPilih.code}`
    : ''

  async function ciptaMajlis() {
    if (baru.title.trim().length < 2) {
      setRalat('Isi nama majlis dulu (cth. Aina & Haikal).')
      return
    }
    setBuat(true)
    setRalat('')
    try {
      // Kod dijana fungsi SQL (semak langgar) — jangan guna Math.random.
      const k = await db.kodMajlis(sesi)
      if (!k.ok || !k.data) {
        setRalat(k.ralat ?? 'Gagal jana kod')
        return
      }
      const r = await db.tambahMajlis(sesi, {
        code: k.data,
        title: baru.title.trim(),
        host_name: baru.host_name.trim() || null,
        event_date: baru.event_date || null,
        active: true,
      })
      if (!r.ok) {
        setRalat(r.ralat ?? 'Gagal cipta majlis')
        return
      }
      setBaru({ title: '', host_name: '', event_date: '' })
      setPilih(r.data?.[0]?.id ?? '')
      await muatMajlis()
    } catch (e) {
      setRalat(e instanceof Error ? e.message : 'Gagal cipta majlis')
    } finally {
      setBuat(false)
    }
  }

  async function toggleAktif(m: Majlis) {
    try {
      await db.kemasMajlis(sesi, m.id, { active: !m.active })
      await muatMajlis()
    } catch (e) {
      setRalat(e instanceof Error ? e.message : 'Gagal kemas kini')
    }
  }

  async function toggleSembunyi(e: Entri) {
    try {
      await db.kemasEntri(sesi, e.id, { hidden: !e.hidden })
      setEntri((sen) => sen.map((x) => (x.id === e.id ? { ...x, hidden: !x.hidden } : x)))
    } catch (err) {
      setRalat(err instanceof Error ? err.message : 'Gagal kemas kini')
    }
  }

  /**
   * Muat turun pukal sebagai ZIP. Server kumpul semua media, zip, hantar
   * satu fail. Jauh lebih baik dari buka tab per gambar (cara lama).
   */
  async function muatTurunSemua() {
    const senarai = entri.filter((x) => !x.hidden)
    if (!senarai.length) return
    setRalat('')
    try {
      const res = await fetch('/api/guestbook-zip', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${sesi.access_token}`,
        },
        body: JSON.stringify({ event_id: pilih }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { ralat?: string }
        throw new Error(j.ralat || 'Gagal muat turun ZIP')
      }
      // Terima blob, simpan sebagai fail.
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `buku-tamu-${majlisPilih?.code ?? pilih.slice(0, 8)}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setRalat(e instanceof Error ? e.message : 'Gagal muat turun ZIP')
    }
  }

  if (muat && !majlis.length) return <p className="adm__kecil">Memuatkan…</p>

  return (
    <>
      {ralat && <p className="adm__ralat">{ralat}</p>}

      {/* --- Cipta majlis baru --- */}
      <div className="adm__kad">
        <h3 className="adm__sub">Majlis Baru</h3>
        <div className="adm__baris">
          <input
            className="adm__input"
            placeholder="Nama majlis (cth. Aina & Haikal)"
            value={baru.title}
            onChange={(e) => setBaru({ ...baru, title: e.target.value })}
          />
          <input
            className="adm__input"
            placeholder="Tuan rumah (pilihan)"
            value={baru.host_name}
            onChange={(e) => setBaru({ ...baru, host_name: e.target.value })}
          />
          <input
            className="adm__input"
            type="date"
            value={baru.event_date}
            onChange={(e) => setBaru({ ...baru, event_date: e.target.value })}
          />
          <button className="btn btn--sm" disabled={buat} onClick={() => void ciptaMajlis()}>
            {buat ? 'Mencipta…' : 'Cipta Kod'}
          </button>
        </div>
      </div>

      {/* --- Unlock code (self-serve) --- */}
      <div className="adm__kad">
        <h3 className="adm__sub">Kod Akses (Self-Serve)</h3>
        <p className="adm__kecil">
          Customer bayar via WhatsApp → jana kod → hantar. Customer buka{' '}
          <code>/buku-tamu/buat</code>, masukkan kod, cipta gallery sendiri.
        </p>
        <div className="adm__baris">
          <button className="btn btn--sm" disabled={unlockBuat} onClick={() => void janaUnlock(false)}>
            {unlockBuat ? 'Menjana…' : '+ Jana Kod Standard'}
          </button>
          <button className="btn btn--sm btn--ghost" disabled={unlockBuat} onClick={() => void janaUnlock(true)}>
            + Jana Kod Pro
          </button>
        </div>
        {unlockBaru && (
          <p className="adm__kecil" style={{ marginTop: 8 }}>
            Kod baru: <code style={{ fontWeight: 700 }}>{unlockBaru}</code>
            <button
              className="btn btn--ghost btn--sm"
              style={{ marginLeft: 8 }}
              onClick={() => void navigator.clipboard?.writeText(unlockBaru)}
            >
              Salin
            </button>
          </p>
        )}
        {unlockList.length > 0 && (
          <table className="adm__jadual" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Kod</th>
                <th>Jenis</th>
                <th>Status</th>
                <th>Luput</th>
              </tr>
            </thead>
            <tbody>
              {unlockList.map((u) => (
                <tr key={u.id}>
                  <td><code>{u.code}</code></td>
                  <td>{u.is_pro ? 'Pro' : 'Standard'}</td>
                  <td>{u.used_at ? 'Dah guna' : 'Aktif'}</td>
                  <td>{u.expires_at ? new Date(u.expires_at).toLocaleDateString('ms-MY') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* --- Galeri v2 (self-serve) + sub-event --- */}
      {galeri.length > 0 && (
        <div className="adm__kad">
          <h3 className="adm__sub">Galeri (Self-Serve)</h3>
          <div className="adm__baris">
            <select
              className="adm__input"
              value={galeriPilih}
              onChange={(e) => setGaleriPilih(e.target.value)}
            >
              {galeri.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nickname} — {g.slug}
                </option>
              ))}
            </select>
          </div>

          {galeriPilih && (
            <div style={{ marginTop: 12 }}>
              <p className="adm__kecil" style={{ marginBottom: 8 }}>
                Sub-event (filter majlis dalam galeri). Tetamu filter ikut jenis majlis.
              </p>
              {subEvents.length > 0 && (
                <table className="adm__jadual">
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Jenis</th>
                      <th>Tarikh</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subEvents.map((e) => (
                      <tr key={e.id}>
                        <td>{e.label || e.title}</td>
                        <td>{e.event_type ?? '—'}</td>
                        <td>{e.event_date ? new Date(e.event_date).toLocaleDateString('ms-MY') : '—'}</td>
                        <td>{e.active ? 'Aktif' : 'Mati'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="adm__baris" style={{ marginTop: 10 }}>
                <input
                  className="adm__input"
                  placeholder="Label (cth. Resepsi Lelaki)"
                  value={subBaru.label}
                  onChange={(e) => setSubBaru({ ...subBaru, label: e.target.value })}
                />
                <select
                  className="adm__input"
                  value={subBaru.event_type}
                  onChange={(e) => setSubBaru({ ...subBaru, event_type: e.target.value })}
                >
                  <option value="wedding">Wedding / Nikah</option>
                  <option value="resepsi_lelaki">Resepsi Lelaki</option>
                  <option value="resepsi_wanita">Resepsi Wanita</option>
                  <option value="bertunang">Bertunang</option>
                  <option value="hari_jadi">Hari Jadi</option>
                  <option value="lain">Lain-lain</option>
                </select>
                <input
                  className="adm__input"
                  type="date"
                  value={subBaru.event_date}
                  onChange={(e) => setSubBaru({ ...subBaru, event_date: e.target.value })}
                />
                <button className="btn btn--sm" disabled={subBuat} onClick={() => void tambahSubEvent()}>
                  {subBuat ? 'Menambah…' : '+ Tambah Sub-Event'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- Pilih majlis --- */}
      {majlis.length > 0 && (
        <div className="adm__kad">
          <h3 className="adm__sub">Pilih Majlis</h3>
          <div className="adm__baris">
            <select
              className="adm__input"
              value={pilih}
              onChange={(e) => {
                setPilih(e.target.value)
                setUrls({})
                setEntri([])
              }}
            >
              {majlis.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} — {m.code} {m.active ? '' : '(mati)'}
                </option>
              ))}
            </select>
            {majlisPilih && (
              <button className="btn btn--ghost btn--sm" onClick={() => void toggleAktif(majlisPilih)}>
                {majlisPilih.active ? 'Matikan' : 'Hidupkan'}
              </button>
            )}
          </div>

          {pautan && (
            <div className="adm__qr">
              <span className="adm__kecil">Pautan tetamu (jadikan QR):</span>
              <code>{pautan}</code>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => void navigator.clipboard?.writeText(pautan)}
              >
                Salin
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- Entri --- */}
      {pilih && (
        <div className="adm__kad">
          <div className="adm__baris adm__baris--antara">
            <h3 className="adm__sub">
              Gambar ({entri.filter((e) => !e.hidden).length} aktif
              {entri.some((e) => e.hidden) ? `, ${entri.filter((e) => e.hidden).length} disembunyi` : ''})
            </h3>
            {entri.length > 0 && (
              <button className="btn btn--sm" onClick={() => void muatTurunSemua()}>
                Muat Turun Semua
              </button>
            )}
          </div>

          {!entri.length ? (
            <p className="adm__kecil">Belum ada tetamu upload. Kongsi pautan di atas.</p>
          ) : (
            <div className="adm__tamu-grid">
              {entri.map((e) => (
                <figure key={e.id} className={'adm__tamu' + (e.hidden ? ' adm__tamu--sembunyi' : '')}>
                  {urls[e.storage_path] ? (
                    <img
                      src={urls[e.storage_path]}
                      alt={`Gambar dari ${e.alunara_guestbook_guests?.name ?? 'tetamu'}`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="adm__tamu-tunggu">…</div>
                  )}
                  <figcaption>
                    <strong>{e.alunara_guestbook_guests?.name ?? 'Tetamu'}</strong>
                    <span className="adm__kecil">
                      {e.stock}
                      {e.width && e.height ? ` · ${e.width}×${e.height}` : ''}
                    </span>
                    {e.alunara_guestbook_guests?.wish && (
                      <p className="adm__tamu-ucap">"{e.alunara_guestbook_guests.wish}"</p>
                    )}
                    <button className="btn btn--ghost btn--sm" onClick={() => void toggleSembunyi(e)}>
                      {e.hidden ? 'Tunjuk' : 'Sembunyi'}
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

type Tab = 'tempahan' | 'klien' | 'lead' | 'tamu'

export default function Admin() {
  const [sesi, setSesi] = useState(bacaSesi())
  const [sedia, setSedia] = useState(false)
  const [ralat, setRalat] = useState('')
  const [tab, setTab] = useState<Tab>('tempahan')

  useEffect(() => {
    // Semak sesi tersimpan pada muat pertama: segarkan token kalau perlu dan
    // pastikan akaun ini benar-benar admin.
    let hidup = true
    void (async () => {
      if (!sesi) return setSedia(true)
      const s = await sesiSah()
      if (!hidup) return
      if (!s) {
        setSesi(null)
        return setSedia(true)
      }
      const sah = await sahkanAdmin()
      if (!hidup) return
      if (!sah.ok) {
        setRalat(sah.ralat ?? '')
        logKeluar()
        setSesi(null)
      }
      setSedia(true)
    })()
    return () => {
      hidup = false
    }
    // sengaja hanya pada muat pertama
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!sedia) {
    return (
      <section className="page section">
        <div className="container container--narrow">
          <p className="muted">Menyemak sesi…</p>
        </div>
      </section>
    )
  }

  if (!sesi) return <Login onMasuk={() => { setRalat(''); setSesi(bacaSesi()) }} />

  return (
    <section className="page section section--tight">
      <div className="container">
        <div className="adm__kepala">
          <div>
            <div className="eyebrow">Panel Dalaman</div>
            <h1>Tempahan ALUNARA</h1>
          </div>
          <div className="adm__kepala-kanan">
            <span className="adm__kecil">{sesi.email}</span>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => {
                logKeluar()
                setSesi(null)
              }}
            >
              Log Keluar
            </button>
          </div>
        </div>

        {ralat && <p className="adm__ralat">{ralat}</p>}

        <nav className="adm__tab">
          {(
            [
              ['tempahan', 'Tempahan'],
              ['klien', 'Klien'],
              ['lead', 'Lead Web'],
              ['tamu', 'Buku Tamu'],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              className={`adm__tab-btn${tab === k ? ' adm__tab-btn--aktif' : ''}`}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === 'tempahan' && <TabTempahan sesi={sesi} />}
        {tab === 'klien' && <TabKlien sesi={sesi} />}
        {tab === 'lead' && <TabLead sesi={sesi} />}
        {tab === 'tamu' && <TabTamu sesi={sesi} />}
      </div>
    </section>
  )
}
