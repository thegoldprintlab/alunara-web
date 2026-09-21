// Sahkan gate kandungan kini ada 4 medan (nama, tel, tarikh, jenis) sama macam gate PDF.
const { spawn } = require('node:child_process')
const PORT = 9361
const tidur = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn('chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/cdp-kunci4',
  'about:blank',
], { stdio: 'ignore' })

let target = null
async function cariTarget() {
  for (let i = 0; i < 40 && !target; i++) {
    await tidur(400)
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      target = l.find((t) => t.type === 'page')
    } catch {}
  }
  if (!target) throw new Error('chromium tak sedia')
}
const ws = () => new WebSocket(target.webSocketDebuggerUrl)
let sock, id = 0
const tunggu = new Map()
function buka() {
  sock = ws()
  sock.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && tunggu.has(d.id)) { tunggu.get(d.id)(d); tunggu.delete(d.id) }
  }
  return new Promise((res) => { sock.onopen = res })
}
function cmd(method, params = {}) {
  const i = ++id
  sock.send(JSON.stringify({ id: i, method, params }))
  return new Promise((res) => tunggu.set(i, res))
}
async function nilai(expr) {
  const r = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  return r.result?.result?.value
}
async function isi(sel, val) {
  await nilai(`(() => {
    const el = document.querySelector('${sel}')
    if (!el) return false
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement : HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set
    setter.call(el, ${JSON.stringify(val)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  await tidur(120)
}

;(async () => {
  await cariTarget()
  await buka()
  await cmd('Page.enable')
  await cmd('Runtime.enable')
  const url = process.argv[2] || 'http://localhost:4173/checklist'
  await cmd('Page.navigate', { url })
  await tidur(2500)

  const hasil = {}
  hasil.kunciAda = await nilai('!!document.querySelector(".kunci")')
  hasil.langkahNampak = await nilai('document.querySelectorAll(".ck__item").length')
  hasil.jumlahMedan = await nilai(
    'document.querySelectorAll(".kunci__form input, .kunci__form select").length',
  )
  hasil.label = await nilai(
    '[...document.querySelectorAll(".kunci__form label")].map(l=>l.textContent.trim()).join(" | ")',
  )
  hasil.adaTarikh = await nilai('!!document.querySelector("#k-tarikh")')
  hasil.adaJenis = await nilai('!!document.querySelector("#k-jenis")')
  hasil.pilihanJenis = await nilai(
    '[...document.querySelectorAll("#k-jenis option")].map(o=>o.value).join("|")',
  )

  // Validasi: hantar kosong
  await nilai('document.querySelector(".kunci__form button[type=submit]").click()')
  await tidur(300)
  hasil.ralatKosong = await nilai('document.querySelector(".kunci__ralat")?.textContent')

  // Isi nama + tel sahaja, TARIKH kosong -> mesti tolak
  await isi('#k-nama', 'Ujian Medan')
  await isi('#k-tel', '0123456789')
  await nilai('document.querySelector(".kunci__form button[type=submit]").click()')
  await tidur(300)
  hasil.ralatTanpaTarikh = await nilai('document.querySelector(".kunci__ralat")?.textContent')

  // Isi tarikh -> lulus
  await isi('#k-tarikh', '2026-12-05')
  await nilai('document.querySelector(".kunci__form button[type=submit]").click()')
  await tidur(600)
  hasil.selepasBuka_langkah = await nilai('document.querySelectorAll(".ck__item").length')
  hasil.selepasBuka_kunciHilang = await nilai('!document.querySelector(".kunci")')
  hasil.leadTersimpan = await nilai(
    '(JSON.parse(localStorage.getItem("alunara_lead_v1")||"[]").slice(-1)[0]||{}).nama',
  )
  hasil.leadTarikh = await nilai(
    '(JSON.parse(localStorage.getItem("alunara_lead_v1")||"[]").slice(-1)[0]||{}).tarikh',
  )
  hasil.leadJenis = await nilai(
    '(JSON.parse(localStorage.getItem("alunara_lead_v1")||"[]").slice(-1)[0]||{}).jenis',
  )
  hasil.leadSumber = await nilai(
    '(JSON.parse(localStorage.getItem("alunara_lead_v1")||"[]").slice(-1)[0]||{}).sumber',
  )
  hasil.overflow = await nilai(
    'document.documentElement.scrollWidth - document.documentElement.clientWidth',
  )

  console.log(JSON.stringify(hasil, null, 2))
  chrome.kill()
  process.exit(0)
})().catch((e) => { console.error('RALAT:', e.message); chrome.kill(); process.exit(1) })
