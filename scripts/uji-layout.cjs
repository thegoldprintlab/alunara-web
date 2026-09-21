// Semak susun atur (overflow + nav) halaman utama & /checklist pada beberapa lebar skrin.
const { spawn } = require('node:child_process')

const PORT = 9335
const tidur = (ms) => new Promise((r) => setTimeout(r, ms))
const LEBAR = [1280, 1225, 1221, 1200, 1024, 768, 390]
const HALAMAN = ['/', '/checklist']

const chrome = spawn('chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, '--window-size=1280,1200', 'about:blank',
], { stdio: 'ignore' })

async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const p = l.find((t) => t.type === 'page')
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
    if (m.id && tunggu.has(m.id)) { tunggu.get(m.id)(m); tunggu.delete(m.id) }
  }
  const cmd = (method, params = {}) =>
    new Promise((res) => { const i = ++id; tunggu.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
  const nilai = async (expr) => {
    const r = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    return r.result?.result?.value
  }

  const baris = []
  for (const url of HALAMAN) {
    for (const w of LEBAR) {
      await cmd('Emulation.setDeviceMetricsOverride', {
        width: w, height: 1200, deviceScaleFactor: 1, mobile: w < 700,
      })
      await cmd('Page.navigate', { url: 'http://localhost:4173' + url })
      await tidur(1200)
      const data = await nilai(`(() => {
        const de = document.documentElement
        const nav = document.querySelector('.nav__links')
        const burger = document.querySelector('.nav__burger')
        const vis = (el) => el ? getComputedStyle(el).display !== 'none' : null
        const link = document.querySelector('.nav__link--active')
        return {
          overflow: de.scrollWidth - de.clientWidth,
          navVisible: vis(nav),
          burgerVisible: vis(burger),
          navRight: nav ? Math.round(nav.getBoundingClientRect().right) : null,
          sideLeft: (() => { const s = document.querySelector('.nav__side'); return s ? Math.round(s.getBoundingClientRect().left) : null })(),
          tabs: document.querySelectorAll('.ck-tab').length,
        }
      })()`)
      baris.push({ url, w, ...data })
    }
  }

  const rusak = baris.filter((b) => b.overflow > 0)
  console.log(JSON.stringify(baris, null, 1))
  console.log('\nOVERFLOW MENDATAR (patut kosong):', JSON.stringify(rusak))
  ws.close()
  chrome.kill()
}

main().catch((e) => { console.error('RALAT:', e.message); chrome.kill(); process.exit(1) })
