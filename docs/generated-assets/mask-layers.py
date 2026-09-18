#!/usr/bin/env python3
"""Membersihkan layer overlay persona sebelum dipasang ke public/.

Masalah yang diperbaiki: hasil edit dari tool gambar membawa latar putih di
dalam kotak potongan. Di area yang pada `base` transparan, layer berisi putih
opak sehingga muncul pita putih di tepi kotak saat ditumpuk.

Perbaikannya: kalikan alpha tiap layer dengan alpha base. Piksel di luar siluet
karakter jadi transparan, sedangkan di dalam siluet tidak berubah sama sekali
(sudah terbukti identik dengan base).

Butuh Pillow. Jalankan dari root repo:
    python3 docs/generated-assets/mask-layers.py <slug-sumber> <personaKey>
"""

import sys
from pathlib import Path
from PIL import Image

LAYERS = [
    "eyes-neutral", "eyes-happy", "eyes-listening", "eyes-thinking", "eyes-tsun",
    "mouth-closed", "mouth-a", "mouth-i", "mouth-u", "mouth-e", "mouth-o",
]


def main(source_slug: str, persona_key: str) -> None:
    src = Path("docs/generated-assets") / source_slug
    dst = Path("public/conversation/personas") / persona_key
    dst.mkdir(parents=True, exist_ok=True)

    base = Image.open(src / "base.webp").convert("RGBA")
    base_alpha = base.getchannel("A")
    base.save(dst / "base.webp", "WEBP", quality=92, method=6)

    for name in LAYERS:
        layer = Image.open(src / f"{name}.webp").convert("RGBA")
        if layer.size != base.size:
            raise SystemExit(f"{name}: ukuran {layer.size} tidak sama dengan base {base.size}")

        # alpha baru = alpha layer * alpha base (ternormalisasi), sehingga tepi
        # lembut base tetap terjaga.
        masked = Image.new("L", layer.size)
        masked.putdata([
            (a * b) // 255
            for a, b in zip(layer.getchannel("A").getdata(), base_alpha.getdata())
        ])
        layer.putalpha(masked)
        layer.save(dst / f"{name}.webp", "WEBP", quality=92, method=6)
        print(f"  {name}: dibersihkan")


if __name__ == "__main__":
    main(
        sys.argv[1] if len(sys.argv) > 1 else "misaki-tsubame",
        sys.argv[2] if len(sys.argv) > 2 else "tsubame",
    )
