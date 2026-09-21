// Debug gate MuatGate di /checklist
const { spawn } = require('node:child_process')
const PORT = 9336
const tidur = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn('chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${PORT}`, '--window-size=1280,1600', 'http://localhost:4173/checklist'], { stdio: 'ignore' })

async function main() {
  let p
  for (let i = 0; i < 40; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      p = l.find((t) => t.type === 'page' && t.url.includes('localhost'))
      if (p) break
    } catch {}
    await tidur(250)
  }
  const ws = new WebSocket(p.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0; const tunggu = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && tunggu.has(m.id)) { tunggu.get(m.id)(m); tunggu.delete(m.id) } }
  const nilai = (expr) => new Promise((res) => {
    const i = ++id; tunggu.set(i, (m) => res(m.result?.result?.value ?? JSON.stringify(m.result?.exceptionDetails)))
    ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }))
  })
  await tidur(2000)
  console.log('butang katalog__file--btn:', await nilai('document.querySelectorAll(".katalog__file--btn").length'))
  console.log('teks butang:', await nilai('[...document.querySelectorAll(".katalog__file--btn")].map(b=>b.textContent.trim()).join(" | ")'))
  console.log('klik:', await nilai('(()=>{const b=document.querySelector(".katalog__file--btn"); if(!b) return "TIADA"; b.click(); return "OK"})()'))
  await tidur(800)
  console.log('gate__box:', await nilai('!!document.querySelector(".gate__box")'))
  console.log('semua .gate*:', await nilai('[...document.querySelectorAll("[class^=gate]")].map(e=>e.className).join(" | ")'))
  console.log('ralat console?', await nilai('window.__err||"-"'))
  console.log('butang selepas klik:', await nilai('document.querySelector(".katalog__file--btn")?.className'))
  ws.close(); chrome.kill()
}
main().catch((e) => { console.error(e); chrome.kill() })
