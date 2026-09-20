import { useEffect, useState } from 'react'
import { IconX } from './Icons'

/** Lightbox mudah — tutup dengan Esc atau klik latar. */
export default function Lightbox({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <button type="button" className="shot" onClick={() => setOpen(true)} aria-label={`Besar: ${alt}`}>
        <img src={src} alt={alt} loading="lazy" decoding="async" />
      </button>
      {open && (
        <div className="lb" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setOpen(false)}>
          <button type="button" className="lb__close" onClick={() => setOpen(false)} aria-label="Tutup">
            <IconX />
          </button>
          <img className="lb__img" src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
          <div className="lb__cap">{alt}</div>
        </div>
      )}
    </>
  )
}
