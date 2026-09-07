import type { Settings } from '../lib/supabase'

export default function Contact({ settings }: { settings: Settings }) {
  const socials = [
    settings.instagram && { name: 'Instagram', url: settings.instagram, note: '@Alunara.melaka' },
    settings.tiktok && { name: 'TikTok', url: settings.tiktok, note: '@Alunara.melaka' },
    settings.threads && { name: 'Threads', url: settings.threads, note: '@Alunara.melaka' },
  ].filter(Boolean) as { name: string; url: string; note: string }[]

  return (
    <section className="page section">
      <div className="container page__inner">
        <div className="page__head">
          <div className="eyebrow">Contact</div>
          <h1>Hubungi Kami</h1>
          <div className="divider" />
          <p>Sebarang pertanyaan tentang pakej, tarikh, atau tema — kami sedia bantu.</p>
        </div>

        <div className="contact-grid">
          <div className="contact-card">
            <h3>WhatsApp</h3>
            {settings.phone && <p>{settings.phone}</p>}
            {settings.whatsapp && (
              <a
                className="btn btn--solid"
                href={`https://wa.me/${settings.whatsapp}`}
                target="_blank"
                rel="noreferrer"
              >
                Chat on WhatsApp
              </a>
            )}
          </div>

          <div className="contact-card">
            <h3>Location</h3>
            <p>{settings.location || 'Melaka, Malaysia'}</p>
            <p className="contact-card__note">Servis tertumpu di sekitar Melaka.</p>
          </div>

          <div className="contact-card">
            <h3>Follow Us</h3>
            <div className="contact-card__socials">
              {socials.map((s) => (
                <a key={s.name} href={s.url} target="_blank" rel="noreferrer">
                  {s.name} <span className="contact-card__handle">{s.note}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
