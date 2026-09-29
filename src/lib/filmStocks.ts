/**
 * FILM STOCK EMULATION — untuk buku tamu ALUNARA.
 *
 * KENAPA BUKAN SEKADAR COLOR MATRIX
 *   Filter gaya "sepia / mono / warm / cool" itu color matrix 3×3 — 9 nombor,
 *   siap. Film stock sebenar TAK BOLEH dibuat macam tu. Film perlukan 4
 *   peringkat:
 *
 *     1. channel mixer   — respon dye film
 *     2. split tone      — shadow & highlight diwarna BERASINGAN
 *     3. S-curve         — shoulder + toe film (bukan contrast linear)
 *     4. grain           — per-stock, kuat di midtone
 *
 *   Peringkat 2 yang paling penting. Inilah yang buat Fuji nampak Fuji:
 *   shadow Fuji cyan/hijau, shadow Kodak hangat. Matrix global tak boleh
 *   buat ini — ia warnakan semua seragam.
 *
 * KENAPA WEBGL, BUKAN canvas 2D `ctx.filter`
 *   `CanvasRenderingContext2D.filter` disokong Safari 18+ DI BELAKANG feature
 *   flag — jadi sebahagian besar pengguna iPhone tak dapat. WebGL jalan
 *   merata. Buku tamu ni majoriti tetamu guna telefon, jadi ini bukan
 *   pilihan seni bina, ia keperluan.
 *
 * GRAIN MESTI DETERMINISTIK
 *   Kalau grain rawak setiap render, PREVIEW ≠ HASIL SIMPAN. Tetamu pilih
 *   stock, nampak satu benda, dapat benda lain. Jadi seed dikunci (SEED) dan
 *   `u_time` sentiasa 0. Jangan tukar tanpa fikir kesan ni.
 */

/** Seed tetap — jamin preview dan hasil simpan sama. */
const SEED = 0

const VERT = `attribute vec2 a_pos; varying vec2 v_uv;
void main(){ v_uv = a_pos*0.5+0.5; gl_Position = vec4(a_pos,0.0,1.0); }`

// highp, bukan mediump — mediump buat S-curve & grain nampak banding di
// sesetengah GPU telefon.
const FRAG = `precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform mat3  u_mat;
uniform vec3  u_shadowTint;
uniform vec3  u_highTint;
uniform float u_curve;
uniform float u_lift;
uniform float u_grain;
uniform float u_grainScale;
uniform float u_time;

float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }

vec3 scurve(vec3 x, float amt){
  vec3 s = x*x*(3.0 - 2.0*x);
  return mix(x, s, amt);
}

void main(){
  vec4 c = texture2D(u_tex, v_uv);
  vec3 rgb = c.rgb;

  // 1. channel mixer.
  //    NOTE: uniformMatrix3fv(transpose=false) menjadikan triplet [a0,a1,a2]
  //    KOLUM 0 dalam GLSL — jadi baris i yang kita hasratkan duduk dalam
  //    u_mat[i]. Baca whole vector. JANGAN re-index silang baris; itu
  //    mengenakan transpose secara senyap (B&W jadi hijau, Sepia jadi hitam).
  rgb = vec3(dot(rgb, u_mat[0]), dot(rgb, u_mat[1]), dot(rgb, u_mat[2]));

  // 2. split tone — shadow & highlight diwarna berasingan
  float l = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  float sw = 1.0 - smoothstep(0.0, 0.58, l);
  float hw = smoothstep(0.42, 1.0, l);
  rgb += u_shadowTint * sw + u_highTint * hw;

  // 3. S-curve, kemudian lift blacks (film tak pernah capai hitam pepejal)
  rgb = scurve(clamp(rgb, 0.0, 1.0), u_curve);
  rgb = rgb * (1.0 - u_lift) + u_lift;

  // 4. grain — kuat di midtone, mati di hitam/putih macam film sebenar
  float mid = 1.0 - abs(l * 2.0 - 1.0);
  rgb += (rand(v_uv * u_grainScale + u_time) - 0.5) * u_grain * (0.35 + 0.65 * mid);

  gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), c.a);
}`

// ---------- pembantu matriks (flat 3×3, input row-major) ----------
const ID = [1, 0, 0, 0, 1, 0, 0, 0, 1]

function satMat(s: number): number[] {
  const lr = 0.2126, lg = 0.7152, lb = 0.0722, s1 = 1 - s
  return [
    lr * s1 + s, lg * s1, lb * s1,
    lr * s1, lg * s1 + s, lb * s1,
    lr * s1, lg * s1, lb * s1 + s,
  ]
}

function mulMat(a: number[], b: number[]): number[] {
  const o = new Array(9)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]
    }
  }
  return o
}

/** + hangat / − sejuk. Lembut sengaja — film cast itu halus. */
function tempTint(t: number): number[] {
  return [1 + t * 0.10, 0, 0, 0, 1, 0, 0, 0, 1 - t * 0.12]
}

/** + hijau / − magenta (ciri hijau Fuji). */
function greenShift(g: number): number[] {
  return [1, 0, 0, 0, 1 + g * 0.08, 0, 0, 0, 1 - g * 0.06]
}

export type FilmStock = {
  id: string
  nama: string
  /** Nama pendek untuk chip di UI. */
  pendek: string
  /** Keterangan rasa warna — untuk bos pilih, dan untuk tooltip tetamu. */
  nota: string
  mat: number[]
  sh: [number, number, number]
  hi: [number, number, number]
  curve: number
  lift: number
  grain: number
  grainScale: number
}

/**
 * 9 stock. Semua kongsi SATU shader — stock baru = tambah data, bukan kod.
 *
 * grainScale diukur pada imej ~1200px lebar. Renderer skala ikut saiz imej
 * supaya butiran grain sama kasar tak kira resolusi.
 */
export const STOCKS: FilmStock[] = [
  {
    id: 'none',
    nama: 'None',
    pendek: 'None',
    nota: 'Warna asal kamera. Tiada sentuhan.',
    mat: ID, sh: [0, 0, 0], hi: [0, 0, 0],
    curve: 0, lift: 0, grain: 0, grainScale: 0,
  },

  // --- KODAK: hangat, condong kuning, pemaaf pada kulit ---
  {
    id: 'portra-400',
    nama: 'Kodak Portra 400',
    pendek: 'Portra',
    nota: 'Hangat lembut, pastel. Paling selamat untuk kulit — pilihan majlis kahwin.',
    mat: mulMat(tempTint(0.85), satMat(0.84)),
    sh: [0.006, -0.002, -0.010], hi: [0.012, 0.006, -0.008],
    curve: 0.08, lift: 0.035, grain: 0.028, grainScale: 520,
  },
  {
    id: 'gold-200',
    nama: 'Kodak Gold 200',
    pendek: 'Gold',
    nota: 'Paling hangat & saturated. Nostalgia album keluarga 90-an.',
    mat: mulMat(tempTint(1.15), satMat(1.14)),
    sh: [0.012, 0.002, -0.014], hi: [0.018, 0.008, -0.012],
    curve: 0.26, lift: 0.022, grain: 0.042, grainScale: 560,
  },
  {
    id: 'ektar-100',
    nama: 'Kodak Ektar 100',
    pendek: 'Ektar',
    nota: 'Bersih, kontras tinggi, warna tegas. Terbaik untuk dekorasi & bunga.',
    mat: mulMat(tempTint(0.35), satMat(1.32)),
    sh: [0.004, -0.002, 0.004], hi: [0.006, 0.000, -0.004],
    curve: 0.32, lift: 0.004, grain: 0.016, grainScale: 640,
  },
  {
    id: 'ultramax-400',
    nama: 'Kodak Ultramax 400',
    pendek: 'Ultramax',
    nota: 'Hangat, snap, merah kaya. Bila majlis dalam dewan lampu kuning.',
    mat: mulMat(tempTint(1.00), satMat(1.22)),
    sh: [0.010, 0.000, -0.012], hi: [0.014, 0.004, -0.010],
    curve: 0.22, lift: 0.026, grain: 0.052, grainScale: 520,
  },

  // --- FUJI: sejuk, shadow cyan/hijau, hijau punchy ---
  {
    id: 'superia-400',
    nama: 'Fuji Superia 400',
    pendek: 'Superia',
    nota: 'Sejuk, shadow cyan-hijau. Bila majlis waktu siang / luar dewan.',
    mat: mulMat(greenShift(0.7), mulMat(tempTint(-0.75), satMat(1.18))),
    sh: [-0.012, 0.002, 0.014], hi: [0.004, 0.006, -0.004],
    curve: 0.22, lift: 0.024, grain: 0.048, grainScale: 540,
  },
  {
    id: 'pro-400h',
    nama: 'Fuji Pro 400H',
    pendek: 'Pro 400H',
    nota: 'Paling sejuk & paling lembut. Rasa lembut, sesuai tema Minimalist.',
    mat: mulMat(greenShift(0.9), mulMat(tempTint(-0.85), satMat(0.82))),
    sh: [-0.016, 0.004, 0.018], hi: [0.000, 0.004, 0.002],
    curve: 0.05, lift: 0.062, grain: 0.030, grainScale: 500,
  },
  {
    id: 'velvia-50',
    nama: 'Fuji Velvia 50',
    pendek: 'Velvia',
    nota: 'Slide film: hyper-saturated. Hijau & merah meletup. Untuk landskap bunga.',
    mat: mulMat(greenShift(0.5), mulMat(tempTint(-0.45), satMat(1.58))),
    sh: [-0.006, 0.000, 0.010], hi: [0.004, 0.002, -0.002],
    curve: 0.36, lift: 0.000, grain: 0.014, grainScale: 660,
  },

  // --- CINESTILL: filem tungsten, shadow teal + halation merah ---
  {
    id: 'cinestill-800t',
    nama: 'CineStill 800T',
    pendek: 'CineStill',
    nota: 'Filem tungsten. Shadow teal, highlight merah menyala. Untuk majlis malam.',
    mat: mulMat(tempTint(-0.30), satMat(1.10)),
    sh: [-0.018, 0.000, 0.026], hi: [0.022, 0.002, -0.006],
    curve: 0.20, lift: 0.032, grain: 0.058, grainScale: 480,
  },
]

export const STOCK_DEFAULT = 'portra-400'

export function cariStock(id: string): FilmStock {
  return STOCKS.find((s) => s.id === id) ?? STOCKS[0]
}

// ============================================================================
// RENDERER
// ============================================================================

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const o = gl.createShader(type)!
  gl.shaderSource(o, src)
  gl.compileShader(o)
  if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) {
    throw new Error('shader: ' + gl.getShaderInfoLog(o))
  }
  return o
}

export type FilmRenderer = {
  /** Lukis imej dengan stock ke atas canvas (preview atau output). */
  lukis: (imej: TexImageSource, stock: FilmStock, keamatan?: number) => void
  canvas: HTMLCanvasElement
  /** Lepaskan konteks WebGL — panggil bila komponen unmount. */
  buang: () => void
}

/**
 * Cipta renderer yang dilekat pada satu canvas.
 *
 * Keamatan (0..1) mencampur antara None dan stock penuh — supaya tetamu boleh
 * kurangkan rasa kalau terlalu kuat. Campuran dilakukan pada uniform, bukan
 * dengan render dua kali.
 */
export function ciptaRenderer(canvas: HTMLCanvasElement): FilmRenderer | null {
  const gl = canvas.getContext('webgl', {
    preserveDrawingBuffer: true, // perlu untuk toDataURL selepas lukis
    premultipliedAlpha: false,
    alpha: false,
  }) as WebGLRenderingContext | null

  if (!gl) return null // peranti tak sokong WebGL — pemanggil kena ada fallback

  const p = gl.createProgram()!
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('link: ' + gl.getProgramInfoLog(p))
  }
  gl.useProgram(p)

  const b = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, b)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(p, 'a_pos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  const U: Record<string, WebGLUniformLocation | null> = {}
  for (const n of ['u_mat', 'u_shadowTint', 'u_highTint', 'u_curve', 'u_lift', 'u_grain', 'u_grainScale', 'u_time']) {
    U[n] = gl.getUniformLocation(p, n)
  }

  return {
    canvas,
    lukis(imej, stock, keamatan = 1) {
      const w = 'width' in imej ? (imej as HTMLImageElement).width : canvas.width
      const h = 'height' in imej ? (imej as HTMLImageElement).height : canvas.height
      if (canvas.width !== w) canvas.width = w
      if (canvas.height !== h) canvas.height = h

      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imej)

      // Campur antara identiti dan stock penuh ikut keamatan.
      const k = Math.min(Math.max(keamatan, 0), 1)
      const m = stock.mat.map((v, i) => v * k + ID[i] * (1 - k))

      gl.uniformMatrix3fv(U.u_mat, false, new Float32Array(m))
      gl.uniform3fv(U.u_shadowTint, new Float32Array(stock.sh.map((v) => v * k)))
      gl.uniform3fv(U.u_highTint, new Float32Array(stock.hi.map((v) => v * k)))
      gl.uniform1f(U.u_curve, stock.curve * k)
      gl.uniform1f(U.u_lift, stock.lift * k)
      gl.uniform1f(U.u_grain, stock.grain * k)
      // Skala grain ikut saiz imej supaya butiran sama kasar pada apa resolusi.
      gl.uniform1f(U.u_grainScale, stock.grainScale ? (stock.grainScale * w) / 1200 : 1)
      gl.uniform1f(U.u_time, SEED) // tetap — preview mesti sama dengan hasil simpan

      gl.viewport(0, 0, w, h)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
    buang() {
      const ext = gl.getExtension('WEBGL_lose_context')
      ext?.loseContext()
    },
  }
}

/**
 * Muat fail gambar jadi HTMLImageElement.
 * Guna createObjectURL + decode() supaya kita tahu imej betul-betul sedia
 * sebelum lukis (kalau tidak, canvas keluar kosong pada telefon lambat).
 */
export function muatImej(fail: File): Promise<HTMLImageElement> {
  return new Promise((selesai, gagal) => {
    const url = URL.createObjectURL(fail)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      selesai(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      gagal(new Error('Gagal baca gambar'))
    }
    img.src = url
  })
}

/**
 * Hadkan saiz supaya muat naik tak makan data tetamu.
 * EXIF orientation: `createImageBitmap` dengan imageOrientation:'from-image'
 * lebih betul, tapi ia tak ada di semua pelayar lama — jadi kita guna
 * pendekatan ini dan terima bahawa gambar tegak dari sesetengah Android
 * lama mungkin perlu diputar manual. iOS moden simpan orientation betul.
 */
export function saizMuatTurun(w: number, h: number, maks = 1600): { w: number; h: number } {
  if (w <= maks && h <= maks) return { w, h }
  const nisbah = w / h
  return nisbah >= 1 ? { w: maks, h: Math.round(maks / nisbah) } : { w: Math.round(maks * nisbah), h: maks }
}

/** Tukar canvas jadi Blob JPEG. Kualiti 0.86 — cukup untuk paparan, saiz munasabah. */
export function canvasKeBlob(canvas: HTMLCanvasElement, kualiti = 0.86): Promise<Blob> {
  return new Promise((selesai, gagal) => {
    canvas.toBlob(
      (b) => (b ? selesai(b) : gagal(new Error('Gagal jana gambar'))),
      'image/jpeg',
      kualiti
    )
  })
}
