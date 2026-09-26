"""Renders Anvil's app icon (the glowing gradient diamond) to resources/installer.

Usage: python scripts/make_icon.py   (needs Pillow)
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

SIZE = 1024
OUT = Path(__file__).resolve().parent.parent / 'resources' / 'installer'
BG = (5, 6, 10, 255)
CYAN = (34, 229, 255)
VIOLET = (157, 123, 255)


def gradient(size: int) -> Image.Image:
	"""Diagonal cyan → violet."""
	g = Image.new('RGBA', (size, size))
	px = g.load()
	for y in range(size):
		for x in range(size):
			t = (x + y) / (2 * (size - 1))
			px[x, y] = tuple(round(CYAN[i] * (1 - t) + VIOLET[i] * t) for i in range(3)) + (255,)
	return g


def diamond(size: int, radius: float) -> Image.Image:
	m = Image.new('L', (size, size), 0)
	c = size / 2
	ImageDraw.Draw(m).polygon([(c, c - radius), (c + radius, c), (c, c + radius), (c - radius, c)], fill=255)
	return m


def main() -> None:
	OUT.mkdir(parents=True, exist_ok=True)
	img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
	# Rounded dark tile.
	tile = Image.new('L', (SIZE, SIZE), 0)
	ImageDraw.Draw(tile).rounded_rectangle([40, 40, SIZE - 40, SIZE - 40], radius=220, fill=255)
	img.paste(Image.new('RGBA', (SIZE, SIZE), BG), (0, 0), tile)

	grad = gradient(SIZE)
	outer = diamond(SIZE, 330)
	# Glow: blurred diamond in the gradient colors.
	glow_mask = outer.filter(ImageFilter.GaussianBlur(60)).point(lambda v: int(v * 0.85))
	glow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
	glow.paste(grad, (0, 0), glow_mask)
	img = Image.alpha_composite(img, Image.composite(glow, Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0)), tile))

	# Solid gradient diamond with a dark core.
	ring = ImageChops.subtract(outer, diamond(SIZE, 118))
	body = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
	body.paste(grad, (0, 0), ring)
	img = Image.alpha_composite(img, body)
	# Dark core, like the mark in the title bar.
	img.paste(Image.new('RGBA', (SIZE, SIZE), BG), (0, 0), diamond(SIZE, 118))

	img.save(OUT / 'icon.png')
	img.resize((256, 256), Image.LANCZOS).save(
		OUT / 'icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
	)
	print('wrote', OUT / 'icon.png', OUT / 'icon.ico')


if __name__ == '__main__':
	main()
