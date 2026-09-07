import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBookedDates, submitBooking } from '../lib/supabase'

const PACKAGES = [
  { id: 'champagne', label: 'Champagne — RM 99' },
  { id: 'signature', label: 'Signature — RM 149' },
  { id: 'luxury', label: 'Luxury — RM 199' },
]

const EVENT_TYPES = ['Birthday', 'Wedding / Engagement', 'Aqiqah / Cukur Jambul', 'Corporate', 'Other']

export default function Booking() {
  const navigate = useNavigate()
  const [booked, setBooked] = useState<string[]>([])
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [eventType, setEventType] = useState(EVENT_TYPES[0])
  const [pkg, setPkg] = useState('signature')
  const [location, setLocation] = useState('Melaka')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    getBookedDates().then(setBooked)
  }, [])

  const minDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toISOString().split('T')[0]
  }, [])

  const isBooked = (d: string) => booked.includes(d)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isBooked(date)) {
      setStatus('error')
      setMessage('Tarikh ini sudah ditempah. Sila pilih tarikh lain.')
      return
    }
    setStatus('loading')
    setMessage('')
    const res = await submitBooking({
      event_date: date,
      customer_name: name,
      customer_phone: phone,
      event_type: eventType,
      package_tier: pkg,
      location,
      notes,
    })
    if (res.ok) {
      setStatus('success')
      navigate('/payment', { state: { booked: true } })
    } else {
      setStatus('error')
      setMessage(res.error || 'Ralat tidak diketahui.')
    }
  }

  return (
    <section className="page section">
      <div className="container page__inner">
        <div className="page__head">
          <div className="eyebrow">Reservation</div>
          <h1>Book Your Date</h1>
          <div className="divider" />
          <p>
            Pilih tarikh majlis anda. Setiap tarikh hanya untuk satu majlis — tempahan
            anda akan di-lock sementara menunggu bayaran QR.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="book-form">
          <div className="field">
            <label htmlFor="date">Tarikh Majlis</label>
            <input
              id="date"
              type="date"
              min={minDate}
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {date && isBooked(date) && (
              <p className="field__warn">⚠ Tarikh ini sudah ditempah.</p>
            )}
          </div>

          <div className="book-grid">
            <div className="field">
              <label htmlFor="name">Nama Penuh</label>
              <input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="phone">No. Telefon (WhatsApp)</label>
              <input
                id="phone"
                type="tel"
                required
                placeholder="e.g. 012-3456789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="book-grid">
            <div className="field">
              <label htmlFor="eventType">Jenis Majlis</label>
              <select id="eventType" value={eventType} onChange={(e) => setEventType(e.target.value)}>
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pkg">Pakej</label>
              <select id="pkg" value={pkg} onChange={(e) => setPkg(e.target.value)}>
                {PACKAGES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="location">Lokasi (dalam Melaka)</label>
            <input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="notes">Catatan (opsional)</label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tema pilihan, jumlah tetamu, atau sebarang permintaan khas…"
            />
          </div>

          {message && (
            <p className={'form-msg form-msg--' + status}>{message}</p>
          )}

          <button type="submit" className="btn btn--gold" disabled={status === 'loading' || !date}>
            {status === 'loading' ? 'Menyimpan…' : 'Sahkan Tempahan'}
          </button>
        </form>
      </div>
    </section>
  )
}
