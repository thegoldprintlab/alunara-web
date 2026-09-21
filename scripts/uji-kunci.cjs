// Ujian gate kandungan /checklist:
//  1. Tanpa buka kunci -> hanya 3 langkah nampak, borang kunci ada
//  2. Validasi: hantar kosong -> ralat; nombor pendek -> ralat
//  3. Isi sah -> 16 langkah terbuka, boleh tanda, kunci hilang
//  4. Refresh -> masih terbuka (localStorage)
//  5. Tukar tab -> kunci semula (setiap majlis berasingan)
// SENGAJA tidak hantar borang yang sah? TIDAK — di sini kita hantar, sebab
// inilah satu-satunya cara sahkan kunci betul-betul berfungsi. Guna nama ujian
// yang jelas supaya bos nampak ia lead ujian, bukan pelanggan.
const { spawn } = require('node:child_process')

const PORT = 9344
const URL_HALAMAN = process.argv[2] || 'http://localhost:4173/checklist'
const PADAN_HOST = process.argv[3] || ""
const tidur = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn('chromium', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  `--remote-debugging-port=${PORT}`,
  'about:blank',
])

let ws, id = 0
const tunggu = new Map()

function hantar(method, params = {}) {
  return new Promise((resolve) => {
    const n = ++id
    tunggu.set(n, resolve)
    ws.send(JSON.stringify({ id: n, method, params }))
  })
}

async function nilai(expr) {
  const r = await hantar('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  })
  return r.result?.result?.value
}

async function buka(url) {
  await hantar('Page.navigate', { url })
  await tidur(1600)
}

;(async () => {
  let target
  for (let i = 0; i < 40 && !target; i++) {
    await tidur(400)
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      target = list.find((t) => t.type === 'page')
    } catch {}
  }
  if (!target) throw new Error('chromium tak sedia')

  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && tunggu.has(d.id)) {
      tunggu.get(d.id)(d)
      tunggu.delete(d.id)
    }
  }
  await hantar('Runtime.enable')
  await hantar('Page.enable')

  const hasil = {}
  await buka(URL_HALAMAN)

  hasil.kunciAda = await nilai('!!document.querySelector(".kunci")')
  hasil.langkahNampak = await nilai('document.querySelectorAll(".ck__item").length')
  hasil.tajukKunci = await nilai('document.querySelector(".kunci__box h3")?.textContent.trim()')
  hasil.progressTersembunyi = await nilai('!document.querySelector(".ck__prog-wrap")')
  hasil.adaBorangWA = await nilai('!!document.querySelector(".kunci__nota a")')

  // validasi kosong
  await nilai('document.querySelector(".kunci__form button[type=submit]").click()')
  await tidur(250)
  hasil.ralatKosong = await nilai('document.querySelector(".kunci__ralat")?.textContent')

  // validasi nombor pendek
  await nilai(`
    (() => {
      const set = (id, v) => {
        const el = document.querySelector(id)
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        s.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
      set('#k-nama', 'Ujian Hermes')
      set('#k-tel', '123')
    })()
  `)
  await tidur(250)
  await nilai('document.querySelector(".kunci__form button[type=submit]").click()')
  await tidur(300)
  hasil.ralatNomborPendek = await nilai('document.querySelector(".kunci__ralat")?.textContent')

  // nombor sah
  await nilai(`
    (() => {
      const el = document.querySelector('#k-tel')
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, '0123456789')
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })()
  `)
  await tidur(250)
  await nilai('document.querySelector(".kunci__form button[type=submit]").click()')
  await tidur(700)

  hasil.selepasBuka_langkah = await nilai('document.querySelectorAll(".ck__item").length')
  hasil.selepasBuka_kunciHilang = await nilai('!document.querySelector(".kunci")')
  hasil.selepasBuka_progress = await nilai('document.querySelector(".ck__prog-top span")?.textContent.trim()')
  hasil.selepasBuka_tipAda = await nilai('!!document.querySelector(".ck__tip")')
  hasil.storageBuka = await nilai('localStorage.getItem("alunara:checklist:buka:birthday")')
  hasil.leadTersimpan = await nilai(
    'JSON.parse(localStorage.getItem("alunara_lead_v1")||"[]").slice(-1)[0]?.nama',
  )
  hasil.leadSumber = await nilai(
    'JSON.parse(localStorage.getItem("alunara_lead_v1")||"[]").slice(-1)[0]?.sumber',
  )

  // tanda berfungsi selepas buka
  await nilai('document.querySelector(".ck__item input").click()')
  await tidur(250)
  hasil.tandaSelepasBuka = await nilai('document.querySelector(".ck__prog-top span")?.textContent.trim()')

  // refresh -> masih terbuka
  await buka(URL_HALAMAN)
  hasil.refresh_langkah = await nilai('document.querySelectorAll(".ck__item").length')
  hasil.refresh_kunciHilang = await nilai('!document.querySelector(".kunci")')

  // tukar tab -> kunci semula
  await nilai('document.querySelectorAll(".ck-tab")[1].click()')
  await tidur(500)
  hasil.tabTunang_langkah = await nilai('document.querySelectorAll(".ck__item").length')
  hasil.tabTunang_kunciAda = await nilai('!!document.querySelector(".kunci")')

  hasil.overflowMendatar = await nilai(
    'document.documentElement.scrollWidth - document.documentElement.clientWidth',
  )

  console.log(JSON.stringify(hasil, null, 2))
  ws.close()
  chrome.kill()
  process.exit(0)
})().catch((e) => {
  console.error('RALAT:', e.message)
  chrome.kill()
  process.exit(1)
})
