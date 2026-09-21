// ALUNARA — kandungan laman. SEMUA harga/teks bisnes ada di sini sahaja.
// Bos edit fail ni untuk tukar harga / pakej / teks.

/* ---------------------------------------------------------------------------
 * NOMBOR WHATSAPP: 018-956 4604 (60189564604).
 * Dikonfirmasi oleh bos 2026-09-20. Nombor 018-256 4604 dalam jadual
 * alunara_settings (Supabase) adalah SALAH — jadual itu sudah tidak dipakai.
 * ------------------------------------------------------------------------- */
export const WA = '60189564604'
export const WA_DISPLAY = '018-956 4604'

/* ---------------------------------------------------------------------------
 * TARIKH YANG DAH DI-LOCK — bos edit SENARAI INI sahaja.
 *
 * Bila customer confirm (deposit masuk), tambah tarikh ke senarai TARIKH_LOCK.
 * Format: 'YYYY-MM-DD'. Tarikh dalam senarai ni akan jadi kelabu dan tak
 * boleh diklik oleh customer di halaman /tempah.
 *
 * Contoh:
 *   export const TARIKH_LOCK: string[] = [
 *     '2026-10-04',
 *     '2026-10-11',
 *     '2026-11-22',
 *   ]
 *
 * Lepas edit, save fail ni. Kalau laman dah deploy dari GitHub, commit + push.
 * Kalau deploy terus dari PC ni, jalankan: npm run build && npx vercel --prod
 * ------------------------------------------------------------------------- */
export const TARIKH_LOCK: string[] = [
  '2026-09-20', // 20/9
  '2026-09-26', // 26/9
  '2026-10-10', // 10/10
]

/** Tarikh dinyatakan sebagai YYYY-MM-DD. */
export function tarikhLockSet(): Set<string> {
  return new Set(TARIKH_LOCK)
}

/** Bina link WhatsApp dengan mesej pembuka siap taip. */
export function waLink(msg?: string): string {
  return msg
    ? `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/${WA}`
}

export const MSG = {
  am:
    'Hi ALUNARA! Saya jumpa laman web ni. Saya nak tanya pasal sewa meja & kerusi bertema untuk majlis saya.',
  pakej: (nama: string, harga: string) =>
    `Hi ALUNARA! Saya nak tanya Pakej ${nama} (${harga}) untuk majlis saya. Masih ada tarikh kosong?`,
  tema: (nama: string) =>
    `Hi ALUNARA! Saya suka tema ${nama}. Boleh tunjuk contoh setup yang dah siap?`,
  tarikh: (t: string) => `Hi ALUNARA! Tarikh majlis saya ${t}. Tarikh tu masih kosong?`,
  katalog: 'Hi ALUNARA! Saya nak katalog penuh 3 tema (PDF) dengan harga sekali.',
  checklist: 'Hi ALUNARA! Saya nak checklist pelan majlis (PDF percuma). Saya tengah plan majlis jenis: ',
  lokasi: (k: string, caj: string) =>
    `Hi ALUNARA! Majlis saya di ${k}. Caj penghantaran ${caj} — boleh confirm?`,
  deposit: 'Hi ALUNARA! Saya nak bayar deposit RM50 untuk lock tarikh majlis saya.',
} as const

/* ------------------------------- PAKEJ ---------------------------------- */
export interface Pakej {
  id: string
  nama: string
  harga: string
  hargaNum: number
  meja: number
  kerusi: number
  blurb: string
  dapat: string[]
  popular?: boolean
}

export const PAKEJ: Pakej[] = [
  {
    id: 'sari',
    nama: 'Sari',
    harga: 'RM 109',
    hargaNum: 109,
    meja: 1,
    kerusi: 6,
    blurb: 'Untuk majlis kecil — cukup untuk satu meja utama yang nampak mahal.',
    dapat: [
      '1 meja + 6 kerusi bersarung bertema',
      'Meja hidangan PERCUMA',
      'Hiasan meja + riben percuma',
      'Hantar & setup kemas',
    ],
  },
  {
    id: 'bayu',
    nama: 'Bayu',
    harga: 'RM 149',
    hargaNum: 149,
    meja: 2,
    kerusi: 12,
    blurb: 'Pilihan paling ramai ambil — cukup untuk majlis hari jadi & tunang.',
    popular: true,
    dapat: [
      '2 meja + 12 kerusi bersarung bertema',
      'Meja hidangan PERCUMA',
      'Hiasan meja + riben percuma',
      'Hantar & setup kemas',
    ],
  },
  {
    id: 'anggun',
    nama: 'Anggun',
    harga: 'RM 199',
    hargaNum: 199,
    meja: 3,
    kerusi: 18,
    blurb: 'Set penuh kami — semua stok, satu majlis, tiada kompromi.',
    dapat: [
      '3 meja + 18 kerusi bersarung bertema',
      'Meja hidangan PERCUMA',
      'Hiasan meja + riben percuma',
      'Hantar & setup kemas',
    ],
  },
]

export const ADDON = {
  nama: 'Tambahan Majlis',
  harga: 'RM 59',
  isi: ['Tapak kek', 'Bekas air', 'Kipas + extension'],
}

/* -------------------------------- TEMA ---------------------------------- */
export interface Tema {
  id: string
  nama: string
  tagline: string
  desc: string
  sesuai: string
  cover: string
  gambar: string[]
}

export const TEMA: Tema[] = [
  {
    id: 'rustic',
    nama: 'Rustic',
    tagline: 'Ton bumi yang hangat dan mesra',
    desc:
      'Meja berlindung kain coklat terracotta dengan alas krim bertekstur kasar. Ton bumi yang hangat membuatkan majlis di halaman rumah kelihatan seperti majlis yang dirancang rapi — bukan sekadar susunan meja pinjaman.',
    sesuai: 'Kenduri · Majlis keluarga · Makan-makan santai · Syukuran',
    cover: '/img/tema-rustic-cover.webp',
    gambar: [
      '/img/tema-rustic-1.webp',
      '/img/tema-rustic-2.webp',
      '/img/tema-rustic-3.webp',
    ],
  },
  {
    id: 'minimalist',
    nama: 'Minimalist',
    tagline: 'Bersih, elegan, tak sesak',
    desc:
      'Alas putih penuh dengan garisan yang bersih dan hiasan yang dipilih betul-betul. Ruang nampak lapang dan mahal tanpa perlu penuh dengan barang. Sesuai untuk majlis yang mahu nampak tenang dan tersusun.',
    sesuai: 'Pertunangan · Majlis formal · Doa selamat · Jamuan korporat',
    cover: '/img/tema-minimalist-cover.webp',
    gambar: [
      '/img/tema-minimalist-1.webp',
      '/img/tema-minimalist-2.webp',
      '/img/tema-minimalist-3.webp',
    ],
  },
  {
    id: 'floral',
    nama: 'Floral',
    tagline: 'Segar, ceria, penuh warna',
    desc:
      'Alas putih penuh dengan alas maroon bertekstur dan susunan bunga di tengah meja. Kontras putih dan maroon membuatkan ruang kelihatan segar dan meriah tanpa perlu tambahan hiasan lain.',
    sesuai: 'Hari jadi · Majlis siang · Baby shower · Aqiqah',
    cover: '/img/tema-floral-cover.webp',
    gambar: [
      '/img/tema-floral-1.webp',
      '/img/tema-floral-2.webp',
      '/img/tema-floral-3.webp',
    ],
  },
]

/* ------------------------------ MENGAPA KAMI ---------------------------- */
export const SEBAB = [
  {
    tajuk: '3 meja, 18 kerusi — itu sahaja',
    ayat:
      'Kami sengaja tak beli lebih. Sebab itu satu tarikh hanya untuk satu majlis, dan setiap majlis dapat perhatian penuh.',
  },
  {
    tajuk: 'Meja hidangan percuma',
    ayat:
      'Semua pakej sudah termasuk meja hidangan. Kedai lain biasanya caj berasingan — kami masukkan sekali.',
  },
  {
    tajuk: 'Hantar & setup kami uruskan',
    ayat:
      'Awak tak payah angkat meja. Kami sampai, kami susun, kami kemas — sebelum tetamu datang.',
  },
  {
    tajuk: 'Deposit RM50 sahaja',
    ayat:
      'Bukan 50% macam kebanyakan kedai. RM50 untuk lock tarikh, selebihnya bila majlis dah dekat.',
  },
]

/* ------------------------------ KIRAAN PITCH ---------------------------- */
export const PITCH = {
  orangLain: [
    { label: 'Kerusi bersarung di kedai lain', nilai: 'RM 9.60 / unit' },
    { label: '18 kerusi', nilai: 'RM 172.80' },
    { label: 'Meja', nilai: 'belum kira' },
    { label: 'Hiasan meja', nilai: 'belum kira' },
    { label: 'Meja hidangan', nilai: 'belum kira' },
  ],
  kita: [
    { label: '18 kerusi bersarung bertema', nilai: 'termasuk' },
    { label: '3 meja berhias', nilai: 'termasuk' },
    { label: 'Meja hidangan', nilai: 'percuma' },
    { label: 'Hiasan + riben', nilai: 'termasuk' },
    { label: 'Hantar & setup', nilai: 'termasuk' },
  ],
  punch: 'Harga kerusi bersarung di kedai lain = satu majlis penuh di ALUNARA.',
}

/* -------------------------------- FAQ ----------------------------------- */
export const FAQ = [
  {
    q: 'Kawasan mana yang awak cover?',
    a: 'Melaka sahaja. Penghantaran PERCUMA dalam 10 km dari pusat operasi kami (Taman Rambai Jaya). Melebihi 10 km, caj bermula RM20 + RM1.00 setiap km berikutnya (15 km = RM25, 25 km = RM35, 40 km = RM50).',
  },
  {
    q: 'Deposit macam mana?',
    a: 'Deposit RM50 — bukan 50% daripada harga pakej. RM50 sahaja untuk lock tarikh. Baki dibayar sebelum majlis.',
  },
  {
    q: 'Tarikh saya masih kosong tak?',
    a: 'Sebab kami hanya ada 3 meja & 18 kerusi, satu tarikh hanya boleh untuk satu majlis. Semak kalendar di halaman Tempah, atau WhatsApp terus — kami balas cepat.',
  },
  {
    q: 'Kalau hujan macam mana?',
    a: 'Semua alas dan sarung kami tahan cuaca biasa. Kalau majlis di luar rumah, beritahu kami awal supaya kami boleh susun atur yang lebih selamat.',
  },
  {
    q: 'Boleh tengok setup dulu sebelum tempah?',
    a: 'Boleh. Kami ada katalog penuh 3 tema dalam PDF — minta melalui WhatsApp dan kami hantar terus. Kalau nak, kami boleh hantar gambar setup sebenar yang paling dekat dengan tema pilihan awak.',
  },
  {
    q: 'Berapa lama setup? Bila awak sampai?',
    a: 'Biasanya kami sampai lebih awal untuk setup dan siapkan sebelum tetamu datang. Kami akan confirm masa dengan awak bila tarikh dah lock.',
  },
  {
    q: 'Boleh tukar tarikh selepas tempah?',
    a: 'Boleh, selagi tarikh baru masih kosong. Beritahu kami seberapa awal yang boleh.',
  },
  {
    q: 'Ada tambahan lain tak?',
    a: 'Ada — Tapak Kek + Bekas Air + Kipas & extension, RM59 untuk satu set.',
  },
]

/* --------------------------- PENGHANTARAN ------------------------------- */
/*
 * Jarak jalan (km) dari pusat operasi Alunara: Taman Rambai Jaya, 2.2637103, 102.1867127.
 *
 * SUMBER: diukur 2026-09-20 guna OSM (Nominatim) + OSRM jarak pemanduan,
 * pusat kawasan ke pusat kawasan — BUKAN jarak ke rumah pelanggan.
 * Jalankan semula: scripts/ukur-jarak-penghantaran.py
 *
 * POLISI BUNDAR: dibundarkan KE ATAS ke km penuh. Buffer kecil supaya caj tak
 * tersasar ke bawah untuk rumah di pinggir kawasan yang lebih jauh dari pusat.
 * Kalau rumah pelanggan lebih jauh, confirm semula dalam WhatsApp dulu.
 *
 * 'Melaka Tengah' DIBUANG — itu daerah pentadbiran (25+ km lebar), bukan lokasi
 * majlis, jadi mustahil diberi satu nombor jarak yang adil.
 */
export const LOKASI: { nama: string; km: number }[] = [
  { nama: 'Cheng', km: 6 },
  { nama: 'Pantai Kundor', km: 8 },
  { nama: 'Klebang', km: 8 },
  { nama: 'Batu Berendam', km: 9 },
  { nama: 'Bachang', km: 10 },
  { nama: 'Sungai Udang', km: 10 },
  { nama: 'Pokok Mangga', km: 11 },
  { nama: 'Bukit Baru', km: 14 },
  { nama: 'Semabok', km: 15 },
  { nama: 'Ayer Keroh', km: 15 },
  { nama: 'Bandar Hilir', km: 16 },
  { nama: 'Durian Tunggal', km: 17 },
  { nama: 'Ujong Pasir', km: 18 },
  { nama: 'Alor Gajah', km: 19 },
  { nama: 'Masjid Tanah', km: 20 },
  { nama: 'Telok Mas', km: 22 },
  { nama: 'Umbai', km: 25 },
  { nama: 'Bemban', km: 26 },
  { nama: 'Kuala Sungai Baru', km: 30 },
  { nama: 'Tampin', km: 31 },
  { nama: 'Jasin', km: 33 },
  { nama: 'Merlimau', km: 38 },
  { nama: 'Nyalas', km: 46 },
]

export const JARAK_PERCUMA_KM = 10
export const CAJ_BASE = 20
export const CAJ_PER_KM = 1

/** Caj penghantaran: percuma ≤10 km, lepas tu RM20 + RM1/km. */
export function cajHantar(km: number): number {
  if (km <= JARAK_PERCUMA_KM) return 0
  return CAJ_BASE + Math.round((km - JARAK_PERCUMA_KM) * CAJ_PER_KM)
}

export function cajHantarText(km: number): string {
  const c = cajHantar(km)
  return c === 0 ? 'PERCUMA' : `RM${c}`
}

/* --------------------------------- LINK --------------------------------- */
export const SOSIAL = [
  { nama: 'Instagram', url: 'https://instagram.com/alunara_melaka', handle: '@alunara_melaka' },
  { nama: 'TikTok', url: 'https://tiktok.com/@alunara_melaka', handle: '@alunara_melaka' },
  { nama: 'Threads', url: 'https://threads.net/@alunara_melaka', handle: '@alunara_melaka' },
]

export const KATALOG = [
  { nama: 'Rustic', fail: '/katalog/Alunara-Katalog-Rustic.pdf' },
  { nama: 'Minimalist', fail: '/katalog/Alunara-Katalog-Minimalist.pdf' },
  { nama: 'Semua Tema', fail: '/katalog/Alunara-Katalog.pdf' },
]

/* Checklist lead magnet — 4 muka setiap satu, percuma */
export const CHECKLIST = [
  { nama: 'Birthday', fail: '/katalog/Alunara-Checklist-Birthday.pdf', tema: 'Tema Floral' },
  { nama: 'Tunang', fail: '/katalog/Alunara-Checklist-Tunang.pdf', tema: 'Tema Minimalist' },
  { nama: 'Kenduri', fail: '/katalog/Alunara-Checklist-Kenduri.pdf', tema: 'Tema Rustic' },
]

/* ---------------------------------------------------------------------------
 * KANDUNGAN CHECKLIST — versi laman web (boleh tanda, boleh share).
 *
 * Sumber: ~/vault-web/scripts/build-alunara-checklist.py (PDF 4 muka).
 * Kalau bos tukar senarai dalam skrip PDF tu, salin juga ke sini supaya
 * laman web & PDF tak lari.
 * ------------------------------------------------------------------------- */

export interface ChecklistMeta {
  /** id anchor untuk tab */
  id: string
  /** Nama penuh untuk paparan */
  nama: string
  /** Baris kecil bawah tajuk */
  sub: string
  /** Tema ALUNARA yang padan */
  temaId: string
  temaNama: string
  /** Untuk siapa checklist ni */
  sesuai: string
  /** Ayat pembuka (sama macam PDF muka 2) */
  lede: string
  /** Ringkasan apa yang diliputi */
  ada: string
  /** Tip ALUNARA di hujung senarai */
  tip: string
  /** Langkah-langkah, ikut urutan. */
  langkah: string[]
}

export const CHECKLIST_META: ChecklistMeta[] = [
  {
    id: 'birthday',
    nama: 'Checklist Birthday',
    sub: 'Tema · Kek · Tetamu · Goodie Bag',
    temaId: 'floral',
    temaNama: 'Floral',
    sesuai: 'Hari jadi kecil · Majlis siang · Baby shower · Aqiqah',
    lede:
      'Hari jadi kecil pun nak kena teratur. Satu benda lupa, habis kecoh hari tu. Checklist ni susun ikut urutan — dari tetapkan tarikh sampai hari majlis.',
    ada:
      'Dari tetapkan tarikh, senarai tetamu, tempah kek, sampai hiasan dan backup plan hujan. Semua dijejak — takde benda tertinggal.',
    tip:
      'Meja hidangan tema Floral — letak kek di tengah dan goodie bag beratur. Nampak penuh dan kemas dalam gambar.',
    langkah: [
      'Tetapkan tarikh & masa majlis',
      'Senaraikan tetamu (kira bilangan orang)',
      'Tentukan lokasi — rumah, dewan atau kafe',
      'Pilih tema & warna (Rustic / Floral / Minimalist)',
      'Hantar jemputan (WhatsApp / e-card)',
      'Tempah kek mengikut tema',
      'Rancang menu — makanan & minuman',
      'Tempah meja & kerusi ikut bilangan tetamu',
      'Sediakan meja hidangan untuk kek & goodie bag',
      'Hiasan — belon, banner, backdrop',
      'Goodie bag / door gift untuk tetamu',
      'Rancang aktiviti atau games',
      'Lantik siapa ambil gambar / video',
      'Pakaian tema untuk keluarga terdekat',
      'Backup plan kalau hujan',
      'Semak semula butiran majlis dengan tuan rumah',
    ],
  },
  {
    id: 'tunang',
    nama: 'Checklist Tunang',
    sub: 'Hantaran · Pelamin · Katering',
    temaId: 'minimalist',
    temaNama: 'Minimalist',
    sesuai: 'Pertunangan · Merisik · Majlis formal · Doa selamat',
    lede:
      'Hari tunang sekali seumur hidup. Jangan biar benda kecil rosakkan mood. Checklist ni cover dari dulang hantaran sampai sesi bergambar.',
    ada:
      'Dari tempah lokasi, dulang hantaran, katering, sampai pelamin dan doorgift. Semua teratur dari awal sampai habis majlis.',
    tip:
      'Meja hidangan tema Minimalist paling kuat untuk sesi bergambar dulang hantaran — nampak elegan dan tak mengganggu fokus.',
    langkah: [
      'Tetapkan tarikh & masa (semak kalendar keluarga)',
      'Tempah lokasi / dewan',
      'Senaraikan tetamu',
      'Sediakan dulang hantaran (bilangan ikut adat)',
      'Pilih tema & warna dewan',
      'Tempah katering / makanan',
      'Tempah meja & kerusi bersarung tema',
      'Sediakan meja hidangan untuk hantaran & kek',
      'Pelamin / backdrop untuk sesi bergambar',
      'Doorgift untuk tetamu',
      'Tempah jurugambar',
      'Sediakan cincin tunang',
      'Susun agenda — merisik → tunang → makan',
      'Senarai wakil / jurucakap kedua-dua pihak',
      'Atur pakej solek & pakaian',
    ],
  },
  {
    id: 'kenduri',
    nama: 'Checklist Kenduri',
    sub: 'Menu · Meja Hidangan · Agenda Doa',
    temaId: 'rustic',
    temaNama: 'Rustic',
    sesuai: 'Kenduri · Tahlil · Doa selamat · Syukuran · Makan-makan santai',
    lede:
      'Tahlil, doa selamat atau syukuran — tetamu ramai, urusan jangan tunggang. Checklist ni susun dari menu sampai agenda doa.',
    ada:
      'Dari tentukan jenis majlis, menu, meja hidangan buffet, sampai tempah dewan dan hubungi ustaz. Semua siap sebelum tetamu sampai.',
    tip:
      'Tema Rustic sesuai untuk majlis santai — nampak mesra dan homey. Padan dengan kenduri di halaman rumah.',
    langkah: [
      'Tetapkan tarikh & masa',
      'Tentukan jenis majlis — tahlil, doa selamat, syukuran',
      'Senaraikan tetamu',
      'Rancang menu — nasi+lauk, BBQ atau potluck',
      'Tempah meja & kerusi',
      'Sediakan meja hidangan (buffet style)',
      'Sediakan pinggan mangkuk / pakai buang',
      'Sediakan minuman',
      'Tempah dewan / khemah jika perlu',
      'Hubungi tetamu kehormat (ustaz / imam)',
      'Susun agenda & waktu doa',
      'Lantik orang ambil gambar',
      'Atur tempat letak kereta & aliran tetamu',
      'Sediakan bekas tapau untuk lebihan makanan',
      'Senarai tugasan keluarga / AJK',
    ],
  },
]

/** Countdown yang sama seperti muka 3 PDF. */
export const CHECKLIST_COUNTDOWN: { n: string; bila: string; apa: string }[] = [
  { n: '4', bila: 'minggu sebelum', apa: 'Lock tarikh · senarai tetamu · tempah lokasi · tempah meja & kerusi' },
  { n: '3', bila: 'minggu sebelum', apa: 'Pilih tema & warna · tempah katering · tempah jurugambar' },
  { n: '2', bila: 'minggu sebelum', apa: 'Hantar jemputan · susun menu · beli hiasan & doorgift' },
  { n: '1', bila: 'minggu sebelum', apa: 'Confirm semula semua tempahan · senarai semak barang' },
  { n: '3', bila: 'hari sebelum', apa: 'Confirm lokasi & masa setup · sediakan pakaian' },
  { n: 'H', bila: 'hari majlis', apa: 'Setup awal · ambil gambar sebelum tetamu sampai · nikmati majlis' },
]

/** Cari fail PDF bagi satu checklist (untuk MuatGate). */
export function checklistFail(nama: string) {
  return CHECKLIST.find((c) => c.nama === nama)
}
