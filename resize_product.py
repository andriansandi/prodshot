#!/usr/bin/env python3
"""
Resize & center product images for WooCommerce / online store.

Input  : gambar produk (background transparan ATAU putih/solid).
Output : gambar persegi dengan produk di tengah, ada padding, aspect ratio
         produk tetap (tidak distorsi).

Usage
-----
  # satu file
  python resize_product.py source/original.png out.png

  # batch (seluruh file di folder)
  python resize_product.py source/ output/ --size 1000 --padding 0.15

  # override ukuran & padding
  python resize_product.py in.png out.png --size 1200 --padding 0.20

Dependensi:  pip install Pillow
"""

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageChops

# Ekstensi gambar yang diproses saat batch
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}


def get_content_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    """
    Bounding box konten produk (exclude background).

    - Jika ada alpha channel: trim area transparan.
    - Jika tidak: anggap background = warna pojok kiri atas, trim warna itu.
    """
    if img.mode == "RGBA":
        # alpha < threshold = background
        alpha = img.getchannel("A")
        bbox = alpha.point(lambda p: 255 if p >= 24 else 0).getbbox()
        if bbox:
            return bbox

    # fallback: deteksi warna background dari pojok kiri-atas
    rgb = img.convert("RGB")
    bg = Image.new("RGB", rgb.size, rgb.getpixel((0, 0)))
    diff = ImageChops.difference(rgb, bg)
    # toleransi kecil agar noise tidak ikut
    bbox = diff.point(lambda p: 255 if p >= 16 else 0).getbbox()
    return bbox  # bisa None jika seluruh gambar = background


def resize_center(
    src: Path,
    dst: Path,
    size: int = 1000,
    padding: float = 0.15,
    bg_color: str | None = None,
) -> None:
    """
    Buat gambar `size`x`size` dengan produk dari `src` di tengah.

    padding   = fraksi canvas yang dikosongkan (0.15 -> 15% total -> produk
                muat di 85% canvas). Preserve aspect ratio.
    bg_color  = warna background output. None = transparan (PNG).
                Contoh: "#ffffff" untuk putih.
    """
    img = Image.open(src).convert("RGBA")
    bbox = get_content_bbox(img)
    if bbox is None:
        # tidak ada konten -> tulis canvas kosong
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.save(dst)
        return

    product = img.crop(bbox)

    # area yang boleh dipakai produk (canvas dikurangi padding)
    box = int(size * (1 - padding))
    pw, ph = product.size
    scale = min(box / pw, box / ph)
    new_w = max(1, round(pw * scale))
    new_h = max(1, round(ph * scale))
    product = product.resize((new_w, new_h), Image.LANCZOS)

    # canvas + composite tengah
    if bg_color:
        from PIL import ImageColor
        r, g, b = ImageColor.getrgb(bg_color)
        canvas = Image.new("RGBA", (size, size), (r, g, b, 255))
    else:
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    offset = ((size - new_w) // 2, (size - new_h) // 2)
    canvas.alpha_composite(product, offset)
    canvas.save(dst)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", help="file gambar ATAU folder (batch)")
    ap.add_argument("output", help="file output ATAU folder tujuan (batch)")
    ap.add_argument("--size", type=int, default=1000, help="ukuran canvas persegi (px). default 1000")
    ap.add_argument("--padding", type=float, default=0.15, help="fraksi padding (0..0.9). default 0.15 = 15%%")
    ap.add_argument("--bg", default=None, help="warna background, mis. #ffffff. default: transparan")
    args = ap.parse_args()

    src = Path(args.input)
    dst = Path(args.output)

    if not src.exists():
        print(f"error: input tidak ditemukan: {src}", file=sys.stderr)
        return 1

    if src.is_file():
        dst.parent.mkdir(parents=True, exist_ok=True)
        resize_center(src, dst, args.size, args.padding, args.bg)
        print(f"OK  {src} -> {dst}  ({args.size}x{args.size}, padding {args.padding:.0%})")
        return 0

    # batch mode
    if not dst.is_dir():
        dst.mkdir(parents=True, exist_ok=True)
    files = [f for f in sorted(src.iterdir()) if f.suffix.lower() in IMAGE_EXTS]
    if not files:
        print(f"tidak ada gambar di {src}", file=sys.stderr)
        return 1
    for f in files:
        out = dst / f"{f.stem}.png"
        resize_center(f, out, args.size, args.padding, args.bg)
        print(f"OK  {f.name} -> {out.name}")
    print(f"\n{len(files)} gambar diproses -> {dst}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
