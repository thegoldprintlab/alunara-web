// /api/lead — terima lead dari laman ALUNARA dan hantar terus ke Telegram (Jojobotobot).
//
// Kenapa perlu server, bukan panggil Telegram terus dari browser:
//   Token bot tak boleh masuk dalam bundle JS (sesiapa boleh baca dan kawal bot).
//   Token duduk dalam env var Vercel (TELEGRAM_BOT_TOKEN), bukan dalam kod.
//
// Keselamatan:
//   - Token & chat id HANYA dibaca dari env. Fungsi ni tak pernah pulangkan
//     token dalam response atau ralat.
//   - Had 6 hantar / 10 minit ikut IP (ingatan proses) — elak orang spam bos.
//     Vercel serverless sejuk: had ini longgar, bukan perlindungan kuat.
//
// Env yang perlu diset di Vercel (Production):
//   TELEGRAM_BOT_TOKEN     token bot @Jojobotobot
//   TELEGRAM_LEAD_CHAT_ID  chat id penerima lead (bos): 346850554
//   SUPABASE_URL           https://<ref>.supabase.co   (project Gold Plan)
//   SUPABASE_ANON_KEY      anon key projek yang sama
//
// Kenapa lead disimpan ke DB juga (bukan Telegram sahaja):
//   Mesej Telegram senang tertimbus dalam sembang, dan kalau bos terlepas
//   satu mesej, lead itu hilang terus. Salinan dalam jadual alunara_leads
//   boleh dilihat di /admin → tab "Lead Web". Penghantaran ke Telegram
//   KEKAL jadi keutamaan; simpanan DB bersifat best-effort (kalau DB tak
//   dapat dihubungi, lead tetap sampai ke Telegram dan kita balas ok).

const HAD = 6;
const TEMPOH_MS = 10 * 60 * 1000;
const jejak = new Map();

function kenaHad(ip) {
  const now = Date.now();
  const rekod = (jejak.get(ip) ?? []).filter((t) => now - t < TEMPOH_MS);
  if (rekod.length >= HAD) {
    jejak.set(ip, rekod);
    return true;
  }
  rekod.push(now);
  jejak.set(ip, rekod);
  if (jejak.size > 500) jejak.clear();
  return false;
}

const esc = (s) =>
  String(s ?? '-')
    .slice(0, 300)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * Buang aksara yang boleh menyuntik baris HTML ke dalam mesej Telegram.
 * Nama/nota datang dari orang awam — jangan percaya bulat-bulat.
 */
const baris = (label, nilai, kod) => {
  const v = esc(nilai);
  return `<b>${label}:</b> ${kod ? `<code>${v}</code>` : v}`;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, ralat: 'Hanya POST.' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_LEAD_CHAT_ID;
  if (!token || !chatId) {
    // Jangan dedah nama env yang hilang secara terperinci kepada awam.
    console.error('[lead] env tidak lengkap: TELEGRAM_BOT_TOKEN / TELEGRAM_LEAD_CHAT_ID');
    return res.status(503).json({ ok: false, ralat: 'Hantar gagal (endpoint belum siap).' });
  }

  // body sudah di-parse oleh Vercel untuk application/json
  const b = typeof req.body === 'string' ? safeJson(req.body) : (req.body ?? {});
  if (!b || typeof b !== 'object') {
    return res.status(400).json({ ok: false, ralat: 'Body tak sah.' });
  }

  const nama = String(b.nama ?? '').trim();
  const tele = String(b.telefon ?? '').trim();
  const digit = tele.replace(/\D/g, '');
  if (nama.length < 2 || digit.length < 9 || digit.length > 13) {
    return res.status(400).json({ ok: false, ralat: 'Nama / nombor tak sah.' });
  }

  const ip =
    (req.headers['x-forwarded-for'] ?? '').toString().split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'tidak-diketahui';
  if (kenaHad(ip)) {
    return res.status(429).json({ ok: false, ralat: 'Terlalu banyak cubaan. Cuba lagi sekejap.' });
  }

  const jenis = String(b.jenis ?? 'Belum pasti').slice(0, 60);
  const tajuk =
    b.sumber === 'katalog' ? '📗 LEAD KATALOG (ALUNARA)' : '📄 LEAD CHECKLIST (ALUNARA)';

  const teks = [
    `<b>${tajuk}</b>`,
    '',
    baris('Nama', nama),
    baris('WhatsApp', tele, true),
    baris('Tarikh majlis', b.tarikh),
    baris('Jenis majlis', jenis),
    baris('Pakej / tema', b.checklist),
    baris('Halaman', b.asal),
    '',
    `<i>${new Date().toLocaleString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur' })}</i>`,
    'Balas WhatsApp customer — tekan nombor di atas.',
  ].join('\n');

  try {
    // Simpan salinan ke DB dan hantar ke Telegram serentak. Kegagalan DB tak
    // menghalang penghantaran Telegram (dan sebaliknya).
    const [, r] = await Promise.all([
      simpanLead(b, nama, tele),
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: teks,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      }),
    ]);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) {
      console.error('[lead] Telegram tolak:', r.status, j?.description);
      return res.status(502).json({ ok: false, ralat: 'Telegram tolak. Cuba lagi.' });
    }
    // message_id dipulangkan supaya penghantaran boleh disahkan (bukan rahsia).
    return res.status(200).json({ ok: true, mid: j.result?.message_id ?? null });
  } catch (e) {
    console.error('[lead] ralat rangkaian:', e?.message);
    return res.status(502).json({ ok: false, ralat: 'Rangkaian gagal.' });
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * Simpan salinan lead ke pangkalan data (best-effort).
 *
 * Kenapa guna RPC `alunara_public_lead` dan bukan insert terus:
 *   Jadual `alunara_leads` dikunci RLS (admin sahaja). Fungsi RPC itu
 *   SECURITY DEFINER — ia menyemak nama dan had 5 lead/24 jam untuk no.
 *   telefon yang sama, kemudian barulah insert. Jadi anon key yang ada di
 *   sini TIDAK boleh menyuntik apa-apa ke dalam DB dengan cara lain.
 *
 * Kegagalan di sini SENGAJA tidak menggagalkan permintaan: lead sudah
 * sampai ke Telegram, dan itu yang paling penting.
 */
async function simpanLead(b, nama, tele) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return;

  const tarikh = /^\d{4}-\d{2}-\d{2}$/.test(String(b.tarikh ?? '')) ? b.tarikh : null;

  try {
    const r = await fetch(`${url}/rest/v1/rpc/alunara_public_lead`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        p_name: nama,
        p_phone: tele,
        p_event_date: tarikh,
        p_event_type: String(b.jenis ?? 'Belum pasti').slice(0, 60),
        p_interest: String(b.checklist ?? '').slice(0, 120) || null,
        p_source: String(b.sumber ?? 'web').slice(0, 40),
        p_source_page: String(b.asal ?? '').slice(0, 200) || null,
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      console.error('[lead] simpan DB gagal:', r.status, t.slice(0, 200));
    }
  } catch (e) {
    console.error('[lead] simpan DB ralat rangkaian:', e?.message);
  }
}
