/**
 * Pixel art as text: 16 rows of 16 characters, one character per pixel. Each letter names a
 * color of the classic 16-color set (the palette's --skin-px-* inks), so every icon recolors
 * with the color scheme; 'c' follows the surrounding text color and '.' is transparent.
 */
export type PixelArt = readonly string[];

export const ART_SIZE = 16;

const INKS: Record<string, string> = {
	k: 'ink',
	w: 'white',
	s: 'silver',
	g: 'grey',
	y: 'yellow',
	o: 'olive',
	r: 'red',
	m: 'maroon',
	e: 'green',
	l: 'lime',
	b: 'blue',
	n: 'navy',
	a: 'cyan',
	t: 'teal',
	p: 'purple',
	h: 'tan',
};

/** The CSS fill for one pixel character, or null for a transparent pixel. */
export function fillFor(ch: string): string | null {
	if (ch === '.') return null;
	if (ch === 'c') return 'currentColor';
	const ink = INKS[ch];
	return ink ? `var(--skin-px-${ink})` : null;
}

/** True for every character a pixel map may use. */
export function isPixelChar(ch: string): boolean {
	return ch === '.' || ch === 'c' || ch in INKS;
}

export interface PixelRun {
	x: number;
	y: number;
	width: number;
	fill: string;
}

const cache = new WeakMap<PixelArt, readonly PixelRun[]>();

/** Horizontal runs of same-colored pixels: one <rect> each instead of one per pixel. */
export function runsOf(art: PixelArt): readonly PixelRun[] {
	const hit = cache.get(art);
	if (hit) return hit;
	const runs: PixelRun[] = [];
	art.forEach((row, y) => {
		let x = 0;
		while (x < row.length) {
			const ch = row.charAt(x);
			let end = x + 1;
			while (end < row.length && row.charAt(end) === ch) end++;
			const fill = fillFor(ch);
			if (fill) runs.push({ x, y, width: end - x, fill });
			x = end;
		}
	});
	cache.set(art, runs);
	return runs;
}
