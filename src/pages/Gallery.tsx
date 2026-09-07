import { useEffect, useState } from 'react'
import { getGallery, type GalleryItem } from '../lib/supabase'

export default function Gallery() {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getGallery().then((g) => {
      setItems(g)
      setLoading(false)
    })
  }, [])

  return (
    <section className="page section">
      <div className="container page__inner">
        <div className="page__head">
          <div className="eyebrow">Galeri</div>
          <h1>Hasil Kerja Kami</h1>
          <div className="divider" />
          <p>Gambaran sebenar setup majlis kami — tema rustic, minimalist &amp; floral.</p>
        </div>

        {loading ? (
          <p className="gallery__empty">Memuatkan…</p>
        ) : items.length === 0 ? (
          <p className="gallery__empty">
            Galeri masih kosong. Ikuti kami di Instagram &amp; TikTok untuk preview terkini.
          </p>
        ) : (
          <div className="gallery-grid">
            {items.map((it) => (
              <figure className="gallery-item" key={it.id}>
                <img src={it.url} alt={it.caption} loading="lazy" />
                {it.caption && <figcaption>{it.caption}</figcaption>}
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
