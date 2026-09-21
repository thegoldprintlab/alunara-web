// Sahkan gate PDF di /checklist: butang wujud, modal buka, validasi borang jalan.
// SENGAJA tidak hantar borang yang sah — itu akan hantar lead sebenar ke Telegram bos.
const { spawn } = require('node:child_process')
const PORT = 9337
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
    const i = ++id
    tunggu.set(i, (m) => res(m.result?.exceptionDetails ? 'EXC:' + JSON.stringify(m.result.exceptionDetails) : m.result?.result?.value))
    ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }))
  })
  await tidur(2000)

  const out = {}
  out.butangGate = await nilai('document.querySelectorAll(".katalog__file--btn").length')
  out.teksButang = await nilai('[...document.querySelectorAll(".katalog__file--btn")].map(b=>b.textContent.trim()).join(" | ")')
  out.metaButang = await nilai('[...document.querySelectorAll(".katalog__file--btn .katalog__file-meta")].map(b=>b.textContent.trim()).join(" | ")')

  out.klik = await nilai('(()=>{const b=document.querySelector(".katalog__file--btn");if(!b)return "TIADA";b.click();return "OK"})()')
  await tidur(600)
  out.gateTerbuka = await nilai('!!document.querySelector(".gate__box")')
  out.gateTajuk = await nilai('document.querySelector("#gate-tajuk")?.textContent.trim()')
  out.medan = await nilai('document.querySelectorAll(".gate__form input, .gate__form select").length')
  out.pilihanJenis = await nilai('[...document.querySelectorAll("#g-jenis option")].map(o=>o.value).join("|")')

  // Hantar KOSONG -> mesti keluar ralat, bukan hantar lead
  await nilai('document.querySelector(".gate__form button[type=submit]")?.click()')
  await tidur(400)
  out.ralatKosong = await nilai('document.querySelector(".gate__ralat")?.textContent')

  // Isi nama + telefon SALAH -> ralat telefon
  await nilai(`(()=>{
    const set=(el,v)=>{const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}))}
    set(document.querySelector('#g-nama'),'Ujian')
    set(document.querySelector('#g-tel'),'123')
    return 'OK'
  })()`)
  await tidur(200)
  await nilai('document.querySelector(".gate__form button[type=submit]")?.click()')
  await tidur(400)
  out.ralatTelefon = await nilai('document.querySelector(".gate__ralat")?.textContent')

  // Tutup modal (Esc)
  await nilai('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}))')
  await tidur(400)
  out.gateTutup = await nilai('!document.querySelector(".gate__box")')

  console.log(JSON.stringify(out, null, 2))
  ws.close(); chrome.kill()
}
main().catch((e) => { console.error('RALAT:', e.message); chrome.kill(); process.exit(1) })
