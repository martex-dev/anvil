"""
Turns skin screenshots into gallery thumbnails: <shots>/skin-<id>.png ->
src/renderer/skins/<id>/preview.webp (640 px wide).

  npx tsx scripts/skin-shots.mts <demo> <shots>        # default palette of every skin
  python scripts/make_previews.py <shots> [skin ...]
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SKINS = ROOT / 'src' / 'renderer' / 'skins'
WIDTH = 640


def main() -> None:
	if len(sys.argv) < 2:
		raise SystemExit(__doc__)
	shots = Path(sys.argv[1])
	wanted = set(sys.argv[2:])
	for shot in sorted(shots.glob('skin-*.png')):
		skin = shot.stem.removeprefix('skin-')
		if (wanted and skin not in wanted) or not (SKINS / skin / 'manifest.ts').exists():
			continue
		image = Image.open(shot).convert('RGB')
		height = round(image.height * WIDTH / image.width)
		out = SKINS / skin / 'preview.webp'
		image.resize((WIDTH, height), Image.LANCZOS).save(out, 'WEBP', quality=82, method=6)
		print(f'{skin}: {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)')


if __name__ == '__main__':
	main()
