// Ujian interaksi halaman /checklist guna CDP terus (chromium headless + WebSocket asli Node).
const { spawn } = require('node:child_process')
const fs = require('node:fs')

const PORT = 9333
const URL_HALAMAN = process.argv[2] || 'http://localhost:4173/checklist'

const chrome = spawn('chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, '--window-size=1280,2000', URL_HALAMAN,
], { stdio: 'ignore' })

const tidur = (ms) => new Promise((r) => setTimeout(r, ms))

async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const list = await r.json()
      const p = list.find((t) => t.type === 'page' && t.url.includes('localhost'))
      if (p) return p
    } catch {}
    await tidur(250)
  }
  throw new Error('tiada target CDP')
}

async function main() {
  const t = await target()
  const ws = new WebSocket(t.webSocketDebuggerUrl)
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
  const hantar = (method, params = {}) =>
    new Promise((res) => {
      const i = ++id
      tunggu.set(i, res)
      ws.send(JSON.stringify({ id: i, method, params }))
    })

  const nilai = async (expr) => {
    const r = await hantar('Runtime.evaluate', {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
    })
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails))
    return r.result.result.value
  }

  await tidur(1500)

  const hasil = {}
  hasil.tajukH1 = await nilai('document.querySelector("h1")?.textContent')
  hasil.bilanganTab = await nilai('document.querySelectorAll(".ck-tab").length')
  hasil.bilanganLangkah = await nilai('document.querySelectorAll(".ck__item").length')
  hasil.kounterAwal = await nilai('document.querySelector(".ck__prog-top span")?.textContent.trim()')
  hasil.lebarBarAwal = await nilai('document.querySelector(".ck__prog-bar")?.style.width')

  // Tanda 3 langkah
  await nilai(`
    (() => {
      const boxes = [...document.querySelectorAll('.ck__box')]
      ;[0,1,2].forEach(i => boxes[i].click())
      return boxes.length
    })()
  `)
  await tidur(400)
  hasil.kounterSelepasTanda3 = await nilai('document.querySelector(".ck__prog-top span")?.textContent.trim()')
  hasil.lebarBarSelepas = await nilai('document.querySelector(".ck__prog-bar")?.style.width')
  hasil.itemOk = await nilai('document.querySelectorAll(".ck__item--ok").length')
  hasil.storage = await nilai('localStorage.getItem("alunara:checklist:birthday")')

  // Tukar tab -> Tunang
  await nilai('document.querySelectorAll(".ck-tab")[1].click()')
  await tidur(500)
  hasil.tabTunangTajuk = await nilai('document.querySelector(".ck__main h2")?.textContent')
  hasil.tabTunangJumlah = await nilai('document.querySelectorAll(".ck__item").length')
  hasil.tabTunangKounter = await nilai('document.querySelector(".ck__prog-top span")?.textContent.trim()')
  hasil.tabTunangTema = await nilai('document.querySelector(".ck__tema-link")?.textContent.trim()')

  // Balik ke Birthday — tanda mesti kekal
  await nilai('document.querySelectorAll(".ck-tab")[0].click()')
  await tidur(500)
  hasil.kembaliKounter = await nilai('document.querySelector(".ck__prog-top span")?.textContent.trim()')
  hasil.kembaliItemOk = await nilai('document.querySelectorAll(".ck__item--ok").length')

  // Countdown accordion
  await nilai('document.querySelector(".ck-cd__toggle").click()')
  await tidur(300)
  hasil.countdownBaris = await nilai('document.querySelectorAll(".ck-cd__row").length')

  // Reset
  await nilai('document.querySelector(".ck__reset").click()')
  await tidur(300)
  hasil.selepasReset = await nilai('document.querySelector(".ck__prog-top span")?.textContent.trim()')

  // Gate PDF (MuatGate) — butang buka modal, borang ada 4 medan
  await nilai('document.querySelector(".katalog__file--btn")?.click()')
  await tidur(400)
  hasil.gateTerbuka = await nilai('!!document.querySelector(".gate__box")')
  hasil.gateTajuk = await nilai('document.querySelector("#gate-tajuk")?.textContent.trim()')
  hasil.gateMedan = await nilai('document.querySelectorAll(".gate__form input, .gate__form select").length')

  // Validasi: hantar kosong -> mesti keluar ralat
  await nilai('document.querySelector(".gate__form button[type=submit]")?.click()')
  await tidur(300)
  hasil.gateRalat = await nilai('document.querySelector(".gate__ralat")?.textContent')

  // Overlap check: promo box & ck grid
  hasil.overflowMendatar = await nilai(
    'document.documentElement.scrollWidth - document.documentElement.clientWidth',
  )

  console.log(JSON.stringify(hasil, null, 2))
  ws.close()
  chrome.kill()
}

main().catch((e) => {
  console.error('RALAT:', e.message)
  chrome.kill()
  process.exit(1)
})
