import { useState } from 'react'
import {
  adminVerify,
  adminBlockDate,
  adminListBookings,
  adminSetStatus,
  type Booking,
} from '../lib/supabase'

const PACKAGE_LABEL: Record<string, string> = {
  sari: 'Sari (RM 109)',
  bayu: 'Bayu (RM 149)',
  anggun: 'Anggun (RM 199)',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu Bayaran',
  confirmed: 'Disahkan',
  cancelled: 'Dibatalkan',
}

export default function Admin() {
  const [code, setCode] = useState('')
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)

  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [pkg, setPkg] = useState('bayu')
  const [notes, setNotes] = useState('')
  const [msg, setMsg] = useState('')

  async function refresh(c: string) {
    setLoading(true)
    const list = await adminListBookings(c)
    setBookings(list)
    setLoading(false)
  }

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    setChecking(true)
    setError('')
    const ok = await adminVerify(code)
    setChecking(false)
    if (ok) {
      setAuthed(true)
      refresh(code)
    } else {
      setError('Kod admin salah.')
    }
  }

  async function doBlock(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    if (!date) return
    const res = await adminBlockDate({ code, date, name, pkg, phone, notes })
    if (res.ok) {
      setMsg(`Tarikh ${date} berjaya di-lock.`)
      setDate('')
      setName('')
      setPhone('')
      setNotes('')
      refresh(code)
    } else {
      setMsg(res.error || 'Gagal.')
    }
  }

  async function setStatus(id: string, status: string) {
    const res = await adminSetStatus(code, id, status)
    if (res.ok) refresh(code)
    else setMsg(res.error || 'Gagal.')
  }

  if (!authed) {
    return (
      <section className="page section">
        <div className="container page__inner">
          <div className="page__head">
            <div className="eyebrow">Admin</div>
            <h1>Log Masuk Admin</h1>
            <div className="divider" />
          </div>
          <form onSubmit={doLogin} className="book-form">
            <div className="field">
              <label htmlFor="code">Kod Admin</label>
              <input
                id="code"
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
            </div>
            {error && <p className="form-msg form-msg--error">{error}</p>}
            <button type="submit" className="btn btn--gold" disabled={checking || !code}>
              {checking ? 'Menyemak…' : 'Log Masuk'}
            </button>
          </form>
        </div>
      </section>
    )
  }

  return (
    <section className="page section">
      <div className="container page__inner">
        <div className="page__head">
          <div className="eyebrow">Admin</div>
          <h1>Pengurusan Tempahan</h1>
          <div className="divider" />
        </div>

        <div className="admin-panel">
          <h2>Lock Tarikh (Tempahan Manual)</h2>
          <form onSubmit={doBlock} className="book-form">
            <div className="field">
              <label htmlFor="adate">Tarikh</label>
              <input id="adate" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="book-grid">
              <div className="field">
                <label htmlFor="aname">Nama Pelanggan</label>
                <input id="aname" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="aphone">No. Telefon</label>
                <input id="aphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="apkg">Pakej</label>
              <select id="apkg" value={pkg} onChange={(e) => setPkg(e.target.value)}>
                <option value="sari">Sari (RM 109)</option>
                <option value="bayu">Bayu (RM 149)</option>
                <option value="anggun">Anggun (RM 199)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="anotes">Catatan</label>
              <textarea id="anotes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <button type="submit" className="btn btn--solid">Lock Tarikh</button>
          </form>
          {msg && <p className="form-msg form-msg--success">{msg}</p>}
        </div>

        <div className="admin-panel">
          <h2>Senarai Tempahan</h2>
          {loading ? (
            <p>Memuatkan…</p>
          ) : bookings.length === 0 ? (
            <p>Tiada tempahan lagi.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tarikh</th>
                  <th>Nama</th>
                  <th>Telefon</th>
                  <th>Pakej</th>
                  <th>Catatan</th>
                  <th>Status</th>
                  <th>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>{b.event_date}</td>
                    <td>{b.customer_name}</td>
                    <td>{b.customer_phone}</td>
                    <td>{PACKAGE_LABEL[b.package_tier] || b.package_tier}</td>
                    <td>{b.notes}</td>
                    <td>{STATUS_LABEL[b.status] || b.status}</td>
                    <td className="admin-table__actions">
                      {b.status !== 'confirmed' && (
                        <button className="btn btn--tiny" onClick={() => setStatus(b.id, 'confirmed')}>
                          Sahkan
                        </button>
                      )}
                      {b.status !== 'cancelled' && (
                        <button className="btn btn--tiny btn--danger" onClick={() => setStatus(b.id, 'cancelled')}>
                          Batal
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  )
}
