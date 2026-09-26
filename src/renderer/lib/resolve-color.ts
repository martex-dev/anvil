/**
 * Libraries like Monaco and xterm only understand #rrggbb(aa), but our tokens use var() and
 * color-mix(). Paint the token into a 1×1 canvas and read the resulting pixel back.
 */
export function resolveToken(token: string): string {
	const probe = document.createElement('span');
	probe.style.color = `var(${token})`;
	document.body.appendChild(probe);
	const computed = getComputedStyle(probe).color;
	probe.remove();

	const canvas = document.createElement('canvas');
	canvas.width = 1;
	canvas.height = 1;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) return computed;
	ctx.clearRect(0, 0, 1, 1);
	ctx.fillStyle = computed;
	ctx.fillRect(0, 0, 1, 1);
	const [r = 0, g = 0, b = 0, a = 255] = ctx.getImageData(0, 0, 1, 1).data;
	const hex = (n: number): string => n.toString(16).padStart(2, '0');
	return `#${hex(r)}${hex(g)}${hex(b)}${a === 255 ? '' : hex(a)}`;
}
