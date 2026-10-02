#!/usr/bin/env python3
"""
bina-font-poster.py — bina src/lib/qrPosterFonts.ts (font terbenam untuk poster QR).

KENAPA SKRIP INI WUJUD
    Poster QR asal guna Helvetica (StandardFonts pdf-lib). Itu font generik
    pengukur — hasil cetak nampak macam resit bank, bukan kad majlis. Laman
    ALUNARA guna Cormorant Garamond (serif) + Jost (sans); poster mesti sama
    supaya cetakan dan laman nampak satu jenama.

KENAPA DI-SUBSET DAHULU, BUKAN BIAR pdf-lib SUBSET SENDIRI
    pdf-lib boleh subset masa embed, TAPI font penuh Cormorant ≈ 573 KB.
    Dibase64 ke dalam bundle pelayar, itu ~760 KB untuk setiap gaya — poster
    cuma perlu aksara ASCII (semua teks melalui `bersih()` yang buang bukan
    ASCII). Di-subset di sini: setiap gaya jatuh ke belasan KB, jadi bundle
    tetap kecil dan PDF yang dijana juga kecil.

CARA GUNA
    python3 scripts/bina-font-poster.py        # tulis src/lib/qrPosterFonts.ts

SUMBER + LESEN
    Cormorant / Cormorant Garamond — SIL Open Font License 1.1
    Jost — SIL Open Font License 1.1
    Diambil dari github.com/google/fonts (ofl/cormorant, ofl/jost), fail
    berubah (variable) kemudian di-`instance` ke berat tetap.
    OFL membenarkan benam + subset dalam dokumen; fail ini mengekalkan
    `name` table supaya atribusi font kekal dalam PDF.
"""
from __future__ import annotations

import base64
import io
import pathlib
import sys
import urllib.request

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "lib" / "qrPosterFonts.ts"
CACHE = pathlib.Path("/tmp/alunara-font-poster")

SUMBER = {
    "cormorant": "https://github.com/google/fonts/raw/main/ofl/cormorant/Cormorant%5Bwght%5D.ttf",
    "cormorant-italic": "https://github.com/google/fonts/raw/main/ofl/cormorant/Cormorant-Italic%5Bwght%5D.ttf",
    "jost": "https://github.com/google/fonts/raw/main/ofl/jost/Jost%5Bwght%5D.ttf",
}

# (kunci, sumber, paksi wght, nama eksport)
GAYA = [
    ("cormorant-600", "cormorant", 600),
    ("cormorant-italic-400", "cormorant-italic", 400),
    ("jost-400", "jost", 400),
    ("jost-500", "jost", 500),
    ("jost-600", "jost", 600),
]

# ASCII sahaja — `bersih()` dalam qrPoster.ts buang semua bukan-ASCII sebelum
# lukis, jadi aksara lain cuma membengkakkan fail.
UNICODES = list(range(0x20, 0x7F))


def muat_turun(nama: str, url: str) -> pathlib.Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / f"{nama}.ttf"
    if not f.exists():
        print(f"  muat turun {nama} …")
        with urllib.request.urlopen(url) as r:
            f.write_bytes(r.read())
    return f


def bina(fail: pathlib.Path, wght: int) -> bytes:
    """Instance berat tetap + subset ASCII + kekalkan name table."""
    font = TTFont(fail)
    if "fvar" in font:
        font = instancer.instantiateVariableFont(font, {"wght": wght})
    buf = io.BytesIO()
    font.save(buf)
    buf.seek(0)

    opts = subset.Options()
    # Hanya kern + ligatur: ini yang menukar rupa teks. Ciri lain (ss01, dlig…)
    # tak diminta oleh kod, jadi membenamkannya cuma membengkakkan fail.
    opts.layout_features = ["kern", "liga", "clig", "calt"]
    # name ID 1 (keluarga) / 2 (subgaya) / 6 (nama PostScript) — cukup untuk
    # atribusi OFL dan untuk pembaca PDF papar nama font. ID 0/3/4/5 (hak cipta,
    # ID unik, versi) bukan metadata kecil: Cormorant menyimpannya sebagai
    # UTF-16 dan itu sahaja ~7 KB setiap gaya.
    opts.name_IDs = [1, 2, 6]
    opts.name_legacy = True
    opts.notdef_outline = True
    opts.recalc_bounds = True
    opts.drop_tables += ["DSIG"]
    subsetter = subset.Subsetter(options=opts)
    subsetter.populate(unicodes=UNICODES)
    font2 = TTFont(buf)
    subsetter.subset(font2)
    out = io.BytesIO()
    font2.save(out)
    return out.getvalue()


def main() -> int:
    data: dict[str, bytes] = {}
    for kunci, sumber, wght in GAYA:
        fail = muat_turun(sumber, SUMBER[sumber])
        b = bina(fail, wght)
        data[kunci] = b
        print(f"  {kunci:<22} {len(b) / 1024:6.1f} KB")

    jumlah = sum(len(v) for v in data.values())
    baris = [
        "/**",
        " * qrPosterFonts.ts — JANA AUTOMATIK. Jangan edit dengan tangan.",
        " *",
        " * Jana semula:  python3 scripts/bina-font-poster.py",
        " *",
        " * Cormorant (serif) + Jost (sans), sama seperti laman ALUNARA, supaya",
        " * poster cetak dan laman nampak satu jenama. Helvetica (StandardFonts)",
        " * dibuang — ia punca poster lama nampak seperti dokumen kosong.",
        " *",
        " * Kedua-dua font di bawah SIL Open Font License 1.1 (github.com/google/fonts).",
        " * Di-subset kepada ASCII (teks melalui `bersih()` dalam qrPoster.ts),",
        f" * jumlah {jumlah / 1024:.0f} KB base64 — cukup kecil untuk bundle pelayar.",
        " */",
        "",
        "/** Tukar base64 → byte untuk `pdf.embedFont()`. */",
        "export function dariBase64(b64: string): Uint8Array {",
        "  const bin = atob(b64)",
        "  const out = new Uint8Array(bin.length)",
        "  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)",
        "  return out",
        "}",
        "",
        "/** Gaya terbenam: [serif 400, serif 600, serif italik 400, sans 400, sans 500, sans 600]. */",
        "export const FONT_B64 = {",
    ]
    for kunci, _s, _w in GAYA:
        b64 = base64.b64encode(data[kunci]).decode()
        # Pecah baris supaya fail boleh dibaca/diff, bukan satu baris 20 KB.
        bahagian = [b64[i : i + 120] for i in range(0, len(b64), 120)]
        baris.append(f"  '{kunci}':")
        for p in bahagian:
            baris.append(f"    '{p}' +")
        baris[-1] = baris[-1].rstrip(" +") + ","
        baris.append("")
    baris += ["} as const", ""]
    OUT.write_text("\n".join(baris))
    print(f"\n  tulis {OUT.relative_to(ROOT)}  ({OUT.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
