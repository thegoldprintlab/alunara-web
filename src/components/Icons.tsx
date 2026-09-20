// Ikon SVG ringkas (bukan emoji) — stroke ikut currentColor.
type P = { className?: string }

export const IconWhatsApp = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.16 8.16 0 0 1-1.25-4.36c0-4.54 3.7-8.24 8.25-8.24a8.19 8.19 0 0 1 8.24 8.25c0 4.54-3.7 8.21-8.25 8.21Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.84-.2-.48-.41-.42-.56-.42h-.47c-.16 0-.43.06-.65.31-.23.25-.86.85-.86 2.06 0 1.21.88 2.38 1 2.55.13.17 1.73 2.65 4.19 3.72.59.25 1.04.4 1.4.51.59.19 1.12.16 1.55.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.22-.17-.47-.29Z" />
  </svg>
)

export const IconInstagram = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
  </svg>
)

export const IconTikTok = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.6 2h-3.1v13.2a2.6 2.6 0 1 1-2.2-2.57V9.4a5.8 5.8 0 1 0 5.3 5.77V8.9a7.3 7.3 0 0 0 4.4 1.47V7.2a4.3 4.3 0 0 1-4.4-4.4V2Z" />
  </svg>
)

export const IconThreads = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.3 22h-.05C8.8 21.98 6.1 20.9 4.3 18.8 2.7 16.93 1.85 14.2 1.8 10.7v-.02C1.85 7.18 2.7 4.45 4.3 2.58 6.1.47 8.8-.6 12.26-.62h.06c2.32.02 4.34.6 5.98 1.74 1.5 1.04 2.63 2.5 3.36 4.35l-1.83.75c-.6-1.52-1.5-2.7-2.7-3.53-1.32-.92-3-1.39-4.85-1.4-2.87.01-5.06.86-6.51 2.53C4.25 5.5 3.57 7.8 3.53 10.7c.04 2.9.72 5.2 2.02 6.86 1.45 1.86 3.64 2.72 6.5 2.73h.05c2.6-.01 4.4-.83 5.72-2.55.65-.87.85-1.9.85-2.6 0-.9-.24-1.7-.7-2.36-.3 1.9-1.02 3.4-2.14 4.47-1.5 1.44-3.5 2.1-5.6 2.06-1.6-.04-3.02-.54-4.13-1.48-1.03-.88-1.6-2.05-1.62-3.3-.02-1.28.53-2.45 1.55-3.33 1.05-.9 2.5-1.4 4.2-1.45 1.25-.03 2.4.05 3.46.24-.14-.83-.43-1.5-.86-1.98-.6-.66-1.53-1-2.77-1.02-1.24 0-2.28.28-3.1 1.02l-1.2-1.42C7.7 5.02 9.1 4.6 10.72 4.6h.05c2.02.02 3.6.62 4.66 1.8.4.45.72 1 1 1.6.13-.02.26-.03.4-.03.95 0 1.78.2 2.47.6.86.5 1.44 1.24 1.7 2.16l-1.9.5c-.3-.94-1.05-1.5-2.14-1.5h-.03c.24.6.38 1.25.38 1.95v.03c0 1.1-.3 2.6-1.3 3.94C15.03 20.8 12.6 22 12.3 22Zm-.2-9.75h-.06c-1.1.03-1.98.32-2.62.85-.62.5-.92 1.14-.9 1.86.03 1.44 1.5 2.32 3.34 2.36h.08c1.4.02 2.79-.42 3.8-1.4.86-.83 1.4-2.1 1.62-3.8a12.6 12.6 0 0 0-2.9-.33c-.5 0-.96.02-1.4.05Z" transform="translate(0 0.6) scale(0.94)" />
  </svg>
)

export const IconArrow = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
)

export const IconCheck = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12.5 9.5 18 20 6.5" />
  </svg>
)

export const IconX = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const IconMinus = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M5 12h14" />
  </svg>
)

export const IconPlus = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconPin = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="2.8" />
  </svg>
)

export const IconPhone = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1.1 1A17 17 0 0 1 4 5.1 1 1 0 0 1 5 4Z" />
  </svg>
)

export const IconTruck = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 6.5A1.5 1.5 0 0 1 3.5 5H13a1 1 0 0 1 1 1v9H2V6.5Z" />
    <path d="M14 8.5h3.6a1 1 0 0 1 .83.44L21.7 12v3h-7.7V8.5Z" />
    <circle cx="6.5" cy="17" r="2" /><circle cx="17.5" cy="17" r="2" />
  </svg>
)

export const IconSparkle = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.5l1.7 5.6 5.3 1.9-5.3 1.9L12 17.5l-1.7-5.6L5 10l5.3-1.9L12 2.5ZM19 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z" />
  </svg>
)

export const IconGrid = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" />
  </svg>
)
