"""
Builds the self-hosted display fonts in client/src/assets/fonts/ from the @fontsource-variable
packages: only the scripts we use, and only the weight range the design uses (700-800).

  python3 -m pip install fonttools brotli
  python3 client/scripts/subset-fonts.py

Body text never uses these files: it stays on system fonts.
"""

from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "node_modules/@fontsource-variable"
OUT = ROOT / "client/src/assets/fonts"

LATIN = "U+0020-007E,U+00A0,U+00A9,U+00B7,U+00D7,U+2013-2014,U+2018-2019,U+201C-201D,U+2022,U+2026,U+20B9,U+2190-2193"
# Danda, ZWNJ/ZWJ and the dotted circle are needed for correct Indic shaping.
DEVANAGARI = "U+0020-0040,U+0900-097F,U+0964-0965,U+200C-200D,U+20B9,U+25CC"
TAMIL = "U+0020-0040,U+0964-0965,U+0B82-0BFA,U+200C-200D,U+20B9,U+25CC"

FONTS = [
    ("bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2", "bricolage-display.woff2", LATIN),
    ("anek-devanagari/files/anek-devanagari-devanagari-wght-normal.woff2", "anek-devanagari-display.woff2", DEVANAGARI),
    ("anek-tamil/files/anek-tamil-tamil-wght-normal.woff2", "anek-tamil-display.woff2", TAMIL),
]


def unicodes(ranges: str) -> list[int]:
    result = []
    for part in ranges.split(","):
        start, _, end = part.removeprefix("U+").partition("-")
        result.extend(range(int(start, 16), int(end or start, 16) + 1))
    return result


for source, target, ranges in FONTS:
    font = TTFont(SRC / source)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]  # keep every shaping feature (conjuncts, matras)
    options.name_IDs = ["*"]
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=unicodes(ranges))
    subsetter.subset(font)
    font = instancer.instantiateVariableFont(font, {"wght": (700, 800)})
    path = OUT / target
    font.flavor = "woff2"
    font.save(path)
    print(f"{target}: {path.stat().st_size / 1024:.1f} KB")
