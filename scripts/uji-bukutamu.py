#!/usr/bin/env python3
"""Ujian hujung-ke-hujung buku tamu ALUNARA (aliran tetamu).

Tujuan: sahkan aliran SEBENAR berfungsi terhadap produksi — daftar tetamu,
minta signed URL, upload fail betul ke Storage, daftar dalam DB, dan lihat
balik dalam galeri awam. Ini yang mustahil disahkan dengan ujian unit kerana
setiap langkah bergantung pada langkah sebelumnya.

KENAPA SATU PROSES
    Signed URL mengandungi token JWT. Kalau URL itu dicetak ke log, sesetengah
    alat (termasuk Hermes) menulis `[SENSITIVE]` sebagai ganti, dan PUT jadi
    `400 InvalidJWT` — nampak macam bug app, sebenarnya ujian yang cacat.
    Jadi skrip ini cetak STATUS KOD sahaja, tidak sekali-kali URL.

CARA JALAN
    cd ~/alunara-web
    set -a && . ./.env.local && set +a
    ALUNARA_KOD=<KOD> python3 scripts/uji-bukutamu.py

    # lalai: https://alunara.my ; boleh ganti ALUNARA_BASE=http://127.0.0.1:4173

Kod majlis mesti aktif dan belum tamat tempoh upload. Ujian ini MENINGGALKAN
satu gambar dalam majlis tersebut — padam sendiri di /admin kalau perlu.
"""
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("ALUNARA_BASE", "https://alunara.my")
SUPA = os.environ.get("VITE_SUPABASE_URL", "")
ANON = os.environ.get("VITE_SUPABASE_ANON_KEY", "")
KOD = os.environ.get("ALUNARA_KOD", "").upper().strip()

gagal = 0


def rpc(nama, args):
    req = urllib.request.Request(
        f"{SUPA}/rest/v1/rpc/{nama}",
        data=json.dumps(args).encode(),
        headers={
            "apikey": ANON,
            "Authorization": f"Bearer {ANON}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def pos(laluan, muatan, headers=None):
    req = urllib.request.Request(
        f"{BASE}{laluan}",
        data=json.dumps(muatan).encode(),
        headers={"content-type": "application/json", **(headers or {})},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def semak(label, dapat, jangka):
    global gagal
    ok = dapat == jangka
    if not ok:
        gagal += 1
    print(f"  [{'OK ' if ok else 'GAGAL'}] {label}: {dapat} (jangka {jangka})")
    return ok

def main():
    global gagal
    if not SUPA or not ANON:
        sys.exit("Ralat: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tak diset.")
    if not KOD:
        sys.exit("Ralat: set ALUNARA_KOD=<kod majlis>.")

    print(f"Ujian buku tamu — base={BASE} kod={KOD}\n")

    print("1) maklumat majlis")
    st, info = rpc("alunara_guestbook_info", {"p_code": KOD})
    semak("info", st, 200)
    if not info:
        sys.exit("  Majlis tak dijumpai atau tak aktif — berhenti.")
    print(f"     {info[0]['event_title']} · {info[0]['jumlah_gambar']} gambar")

    print("2) daftar tetamu (join)")
    st, sesi = rpc(
        "alunara_guestbook_join",
        {"p_code": KOD, "p_name": "Ujian E2E", "p_wish": "Ujian automatik"},
    )
    semak("join", st, 200)
    if not sesi:
        sys.exit("  join gagal — berhenti.")

    print("3) sahkan slot (acquire_slot)")
    st, slot = rpc("alunara_guestbook_acquire_slot", {"p_session": sesi})
    semak("acquire_slot", st, 200)
    if st == 200:
        print(f"     slot {slot[0]['slot']} / had {slot[0]['had']}")

    print("4) minta signed URL muat naik")
    st, j1 = pos("/api/guestbook-sign", {"action": "upload", "session": sesi, "nama": "e2e.jpg"})
    semak("sign upload", st, 200)
    if st != 200:
        sys.exit(f"  {j1.get('ralat')} — berhenti.")

    print("5) upload fail sebenar ke Storage")
    url = j1["url"]
    png = bytes.fromhex(
        "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
        "1f15c4890000000a49444154789c6300010000050001"
        "0d0a2db40000000049454e44ae426082"
    )
    req = urllib.request.Request(
        url, data=png, headers={"content-type": "image/png", "x-upsert": "false"}, method="PUT"
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            semak("PUT storage", r.status, 200)
    except urllib.error.HTTPError as e:
        semak("PUT storage", e.code, 200)
        print(f"     {e.read()[:200]!r}")

    print("6) daftar gambar dalam DB (add_photo)")
    st, _ = rpc(
        "alunara_guestbook_add_photo",
        {
            "p_session": sesi,
            "p_storage_path": j1["laluan"],
            "p_width": 1,
            "p_height": 1,
            "p_bytes": len(png),
            "p_stock": "none",
            "p_strength": 1,
        },
    )
    semak("add_photo", st, 200)

    print("7) galeri awam patut nampak gambar itu")
    st, gal = rpc("alunara_guestbook_gallery", {"p_code": KOD, "p_limit": 50})
    semak("gallery", st, 200)
    jumpa = [g for g in (gal or []) if g["storage_path"] == j1["laluan"]]
    print(f"  [{'OK ' if jumpa else 'GAGAL'}] gambar dalam galeri: {len(jumpa)}")
    if not jumpa:
        gagal += 1

    print("8) signed URL baca + ambil imej")
    st, j2 = pos("/api/guestbook-sign", {"action": "read", "laluan": [j1["laluan"]]})
    semak("sign read", st, 200)
    if j2.get("urls"):
        try:
            with urllib.request.urlopen(j2["urls"][j1["laluan"]], timeout=45) as r:
                semak("GET imej signed", r.status, 200)
        except urllib.error.HTTPError as e:
            semak("GET imej signed", e.code, 200)

    print("9) gate keselamatan")
    st, _ = pos("/api/guestbook-sign", {"action": "download", "laluan": [j1["laluan"]]})
    semak("download tanpa token admin (mesti tolak)", st, 403)
    st, _ = pos("/api/guestbook-sign", {"action": "read", "laluan": ["majlis-lain/x.jpg"]})
    semak("read laluan bukan dalam DB (mesti tolak)", st, 403)
    st, _ = rpc("alunara_guestbook_acquire_slot", {"p_session": "00000000-0000-0000-0000-000000000000"})
    semak("acquire_slot sesi palsu (mesti tolak)", st, 400)

    print()
    if gagal:
        print(f"SELESAI — {gagal} ujian GAGAL")
        sys.exit(1)
    print("SELESAI — semua ujian lulus")


if __name__ == "__main__":
    main()
