import { useLocation } from 'react-router-dom'
import type { Settings } from '../lib/supabase'

export default function Payment({ settings }: { settings: Settings }) {
  const location = useLocation()
  const justBooked = (location.state as any)?.booked

  const qr = settings.qr_payment_url

  return (
    <section className="page section">
      <div className="container page__inner">
        <div className="page__head">
          <div className="eyebrow">Payment</div>
          <h1>Bayaran Tempahan</h1>
          <div className="divider" />
          {justBooked && (
            <p className="form-msg form-msg--success">
              Tempahan anda diterima! Sila selesaikan bayaran untuk sahkan tarikh anda.
            </p>
          )}
          <p>
            Bayaran diterima melalui DuitNow / Touch 'n Go eWallet. Imbas kod QR di bawah,
            kemudian hubungi kami untuk sahkan.
          </p>
        </div>

        <div className="pay-card">
          {qr ? (
            <img className="pay-card__qr" src={qr} alt="Payment QR code" />
          ) : (
            <div className="pay-card__placeholder">
              <p>Kod QR bayaran akan dipaparkan di sini tidak lama lagi.</p>
              <p className="pay-card__hint">
                Sementara itu, sila hubungi kami untuk arahan bayaran.
              </p>
            </div>
          )}
          <div className="pay-card__steps">
            <div className="step">
              <div className="step__num">1</div>
              <h3>Scan QR</h3>
              <p>Guna DuitNow atau TnG eWallet anda.</p>
            </div>
            <div className="step">
              <div className="step__num">2</div>
              <h3>Bayar Jumlah</h3>
              <p>Ikut pakej yang anda pilih.</p>
            </div>
            <div className="step">
              <div className="step__num">3</div>
              <h3>WhatsApp Kami</h3>
              <p>Hantar bukti bayaran untuk sahkan tarikh.</p>
            </div>
          </div>
          {settings.whatsapp && (
            <a
              className="btn btn--solid"
              href={`https://wa.me/${settings.whatsapp}?text=Hi%20ALUNARA%2C%20saya%20baru%20buat%20bayaran%20tempahan.`}
              target="_blank"
              rel="noreferrer"
            >
              Sahkan via WhatsApp
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
