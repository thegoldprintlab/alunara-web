// Ujian hujung-ke-hujung panel /admin ALUNARA.
//
// Tujuan: sahkan aliran sebenar berfungsi — log masuk, senarai tempahan,
// tambah tempahan, dan tarikh itu tersekat di kalendar awam /tempah.
//
// Ia SENGAJA guna kredensial sebenar yang dibaca dari env (bukan ditulis
// dalam fail ini). Kalau ALUNARA_ADMIN_PASS tak diset, ujian langkau bahagian
// log masuk dan hanya periksa borang log masuk wujud.
//
// Jalankan: npm run preview  (port 4173) kemudian `node scripts/uji-admin.cjs`
//
// GOTCHA: JANGAN guna `chromium` dari /snap/bin — AppArmor snap menghalang
// akses ke localhost dan ke localStorage, jadi ujian nampak macam "site can't
// be reached" walaupun server hidup. Guna chromium Playwright (tak di-sandbox).

const { spawn } = require('node:child_process')
const { existsSync } = require('node:fs')
const PORT = 9341
// Boleh uji produksi: ALUNARA_BASE=https://alunara.my node scripts/uji-admin.cjs
const BASE = process.env.ALUNARA_BASE || 'http://127.0.0.1:4188'
const tidur = (ms) => new Promise((r) => setTimeout(r, ms))

/** Cari chromium yang boleh guna. Playwright punya dulu (paling boleh harap). */
function chromiumBin() {
  const calon = [
    '/home/mozacsuck48/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
    process.env.CHROME_BIN,
    '/usr/bin/google-chrome',
  ].filter(Boolean)
  for (const c of calon) if (existsSync(c)) return c
  return 'chromium'
}

const EMAIL = process.env.ALUNARA_ADMIN_EMAIL || 'arfasyrf@gmail.com'
const PASS = process.env.ALUNARA_ADMIN_PASS || ''

const chrome = spawn(
  chromiumBin(),
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    '--window-size=1400,1800',
    `${BASE}/admin`,
  ],
  { stdio: 'ignore' },
)

async function main() {
  let p
  for (let i = 0; i < 60; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      p = l.find((t) => t.type === 'page' && t.url.startsWith(BASE))
      if (p) break
    } catch {}
    await tidur(250)
  }
  const ws = new WebSocket(p.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0
  const tunggu = new Map()
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && tunggu.has(m.id)) {
      tunggu.get(m.id)(m)
      tunggu.delete(m.id)
    }
  }
  const nilai = (expr) =>
    new Promise((res) => {
      const i = ++id
      tunggu.set(i, (m) =>
        res(
          m.result?.exceptionDetails
            ? 'EXC:' + JSON.stringify(m.result.exceptionDetails).slice(0, 300)
            : m.result?.result?.value,
        ),
      )
      ws.send(
        JSON.stringify({
          id: i,
          method: 'Runtime.evaluate',
          params: { expression: expr, returnByValue: true, awaitPromise: true },
        }),
      )
    })

  const ralatConsole = []
  ws.send(JSON.stringify({ id: ++id, method: 'Runtime.enable', params: {} }))
  ws.onmessage = ((asli) => (e) => {
    const m = JSON.parse(e.data)
    if (m.method === 'Runtime.exceptionThrown') {
      ralatConsole.push(String(m.params?.exceptionDetails?.text ?? 'exception'))
    }
    if (m.id && tunggu.has(m.id)) {
      tunggu.get(m.id)(m)
      tunggu.delete(m.id)
    }
  })()

  await tidur(4000)
  const out = {}

  out.tajuk = await nilai('document.querySelector("h1")?.textContent.trim()')
  out.adaBorangLogin = await nilai('!!document.querySelector("#a-email")')
  out.navAwamTersembunyi = await nilai('!document.querySelector(".nav")')
  out.consoleRalat = ralatConsole.slice()

  if (!PASS) {
    out.nota = 'ALUNARA_ADMIN_PASS tak diset — ujian log masuk dilangkau.'
    return siap(out)
  }

  // Isi borang log masuk
  const setNilai = (sel, v) => `(()=>{
    const el=document.querySelector("${sel}");
    if(!el) return "TIADA ${sel}";
    const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    s.call(el,${JSON.stringify(v)});
    el.dispatchEvent(new Event('input',{bubbles:true}));
    return "OK";
  })()`

  out.isiEmail = await nilai(setNilai('#a-email', EMAIL))
  out.isiKata = await nilai(setNilai('#a-kata', PASS))
  await nilai('document.querySelector("form button[type=submit]").click()')
  await tidur(4500)

  out.selepasLoginTajuk = await nilai('document.querySelector("h1")?.textContent.trim()')
  out.adaTab = await nilai(
    '[...document.querySelectorAll(".adm__tab-btn")].map(b=>b.textContent.trim()).join(" | ")',
  )
  out.kpi = await nilai(
    '[...document.querySelectorAll(".adm__kpi")].map(k=>k.textContent.trim().replace(/\\s+/g," ")).join(" || ")',
  )
  out.ralat = await nilai('document.querySelector(".adm__ralat")?.textContent.trim()')
  out.sesiDisimpan = await nilai('!!localStorage.getItem("alunara_admin_sesi_v1")')

  // --- Pilih tarikh ujian dari kalendar awam sendiri ---
  // Jangan hardcode tarikh: kalendar cuma papar bulan semasa, jadi tarikh
  // hardcode (cth. tahun depan) tak akan ada elemen dan ujian jadi palsu.
  await nilai('window.location.href = "/tempah"')
  await tidur(4500)
  const tarikhUjian = await nilai(`(()=>{
    const c=[...document.querySelectorAll('.kal__cell:not(.kal__cell--luar):not(:disabled)')];
    return c.length ? c[0].dataset.tarikh : null;
  })()`)
  out.tarikhUjian = tarikhUjian
  if (!tarikhUjian) {
    out.nota = 'TIADA tarikh boleh pilih dalam kalendar — ujian tempahan dilangkau.'
    return siap(out)
  }
  out.sebelumTempahan = await nilai(`(()=>{
    const sel=document.querySelector('[data-tarikh="${tarikhUjian}"]');
    return sel ? JSON.stringify({disabled:sel.disabled,kelas:sel.className}) : 'TIADA';
  })()`)

  await nilai('window.location.href = "/admin"')
  await tidur(4500)

  // Tambah tempahan ujian
  out.klikBaru = await nilai(
    '(()=>{const b=[...document.querySelectorAll("button")].find(x=>x.textContent.includes("Tempahan Baru"));if(!b)return "TIADA";b.click();return "OK"})()',
  )
  await tidur(700)
  out.adaBorang = await nilai('!!document.querySelector("#b-tarikh")')

  await nilai(setNilai('#b-tarikh', tarikhUjian))
  await nilai(setNilai('#b-nama', 'UJIAN HERMES ADMIN'))
  await nilai(setNilai('#b-tel', '0123456789'))
  await nilai(setNilai('#b-venue', 'Dewan Ujian'))
  await tidur(300)
  out.hintJumlah = await nilai('document.querySelector(".adm__hint")?.textContent.trim()')
  out.simpan = await nilai(
    '(()=>{const f=document.querySelector("form.adm__kad");const b=f?.querySelector("button[type=submit]");if(!b)return "TIADA";b.click();return "OK"})()',
  )
  await tidur(4000)
  out.pesanSelepasSimpan = await nilai('document.querySelector(".adm__pesan")?.textContent.trim()')
  out.barisJadual = await nilai('document.querySelectorAll(".adm__jadual tbody tr").length')
  out.adaUjianDalamJadual = await nilai(
    'document.body.textContent.includes("UJIAN HERMES ADMIN")',
  )

  // Kalendar awam patut tandakan tarikh itu sebagai penuh
  await nilai('window.location.href = "/tempah"')
  await tidur(5000)
  out.tempahDimuat = await nilai('document.querySelector("h1")?.textContent.trim()')
  out.tarikhTersekat = await nilai(`(()=>{
    const sel=document.querySelector('[data-tarikh="${tarikhUjian}"]');
    if(!sel) return "TIADA ELEMEN";
    return JSON.stringify({disabled: sel.disabled, kelas: sel.className});
  })()`)
  out.kalendarDariDb = await nilai(
    'document.body.textContent.includes("UJIAN HERMES ADMIN")?"BOCOR NAMA!":"nama tak bocor (betul)"',
  )

  return siap(out)
}

function siap(out) {
  console.log(JSON.stringify(out, null, 2))
  try { chrome.kill() } catch {}
  process.exit(0)
}

main().catch((e) => {
  console.log('RALAT:', e.message)
  try { chrome.kill() } catch {}
  process.exit(1)
})
