import type { SnapPalette } from './backgrounds';
import { type ChromeId, type SnapLayout, WINDOW_RADIUS, withAlpha } from './snap-layout';

/** One styled piece of a code line, as colorized by Monaco. */
export interface SnapRun {
	text: string;
	color: string;
	italic: boolean;
	bold: boolean;
}

export interface Fonts {
	/** CSS font-family list for code. */
	code: string;
	ui: string;
	size: number;
}

export function runFont(run: Pick<SnapRun, 'italic' | 'bold'>, fonts: Fonts): string {
	return `${run.italic ? 'italic ' : ''}${run.bold ? 700 : 400} ${fonts.size}px ${fonts.code}`;
}

function windowPath(layout: SnapLayout, inset = 0): Path2D {
	const { x, y, width, height } = layout.window;
	const path = new Path2D();
	path.roundRect(
		x + inset,
		y + inset,
		width - inset * 2,
		height - inset * 2,
		WINDOW_RADIUS - inset,
	);
	return path;
}

/**
 * Shadow and glow around the window. The window's own area is clipped out so they only light
 * up the surroundings instead of muddying the translucent glass. Canvas shadow blur and offsets
 * ignore the transform, hence the explicit `scale`.
 */
export function paintHalo(
	ctx: CanvasRenderingContext2D,
	layout: SnapLayout,
	p: SnapPalette,
	opts: { shadow: boolean; glow: boolean; scale: number },
): void {
	if (!opts.shadow && !opts.glow) return;
	const shape = windowPath(layout);
	const outside = new Path2D();
	outside.rect(0, 0, layout.width, layout.height);
	outside.addPath(shape);
	ctx.save();
	ctx.clip(outside, 'evenodd');
	ctx.fillStyle = p.bg0;
	if (opts.glow) {
		ctx.shadowColor = withAlpha(p.accent, 0.5);
		ctx.shadowBlur = 64 * opts.scale;
		ctx.fill(shape);
	}
	if (opts.shadow) {
		ctx.shadowColor = withAlpha(p.bg0, 0.75);
		ctx.shadowBlur = 48 * opts.scale;
		ctx.shadowOffsetY = 20 * opts.scale;
		ctx.fill(shape);
	}
	ctx.restore();
}

/** Frosted window plate with a 1px inner edge and the accent hairline the app's glass uses. */
export function paintWindow(
	ctx: CanvasRenderingContext2D,
	layout: SnapLayout,
	p: SnapPalette,
	opaque: boolean,
): void {
	const { x, y, width, height } = layout.window;
	const shape = windowPath(layout);
	ctx.fillStyle = opaque ? p.bg1 : withAlpha(p.bg1, 0.88);
	ctx.fill(shape);

	// Faint accent tint from the top-left, like light catching the glass.
	const tint = ctx.createLinearGradient(x, y, x + width * 0.6, y + height * 0.6);
	tint.addColorStop(0, withAlpha(p.accent, 0.07));
	tint.addColorStop(1, withAlpha(p.accent, 0));
	ctx.fillStyle = tint;
	ctx.fill(shape);

	ctx.lineWidth = 1;
	ctx.strokeStyle = withAlpha(p.text0, 0.1);
	ctx.stroke(windowPath(layout, 0.5));

	const edge = ctx.createLinearGradient(x, y, x + width, y + height);
	edge.addColorStop(0, withAlpha(p.accent, 0.55));
	edge.addColorStop(0.25, withAlpha(p.accent, 0));
	edge.addColorStop(0.75, withAlpha(p.accent2, 0));
	edge.addColorStop(1, withAlpha(p.accent2, 0.45));
	ctx.strokeStyle = edge;
	ctx.stroke(windowPath(layout, 0.5));
}

export function paintChrome(
	ctx: CanvasRenderingContext2D,
	layout: SnapLayout,
	p: SnapPalette,
	opts: { chrome: ChromeId; title: string; language: string; fonts: Fonts },
): void {
	const bar = layout.titleBar;
	if (!bar || opts.chrome === 'none') return;
	const cy = bar.y + bar.height / 2;
	ctx.textBaseline = 'middle';

	if (opts.chrome === 'mac') {
		[p.down, p.warn, p.up].forEach((color, i) => {
			ctx.beginPath();
			ctx.arc(bar.x + 22 + i * 20, cy, 6, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.fill();
		});
		return;
	}

	ctx.beginPath();
	ctx.moveTo(bar.x + 1, bar.y + bar.height - 0.5);
	ctx.lineTo(bar.x + bar.width - 1, bar.y + bar.height - 0.5);
	ctx.strokeStyle = withAlpha(p.text0, 0.07);
	ctx.stroke();

	ctx.save();
	ctx.shadowColor = withAlpha(p.accent, 0.8);
	ctx.shadowBlur = 8;
	ctx.beginPath();
	ctx.arc(bar.x + 22, cy, 3, 0, Math.PI * 2);
	ctx.fillStyle = p.accent;
	ctx.fill();
	ctx.restore();

	ctx.font = `500 12px ${opts.fonts.ui}`;
	ctx.fillStyle = p.text1;
	ctx.textAlign = 'left';
	ctx.fillText(opts.title, bar.x + 36, cy, bar.width - 150);

	ctx.font = `500 10px ${opts.fonts.code}`;
	ctx.letterSpacing = '1.6px';
	ctx.fillStyle = p.text2;
	ctx.textAlign = 'right';
	ctx.fillText(opts.language.toUpperCase(), bar.x + bar.width - 20, cy, 100);
	ctx.letterSpacing = '0px';
}

export function paintCode(
	ctx: CanvasRenderingContext2D,
	layout: SnapLayout,
	p: SnapPalette,
	opts: {
		lines: readonly SnapRun[][];
		widths: readonly number[][];
		startLine: number;
		fonts: Fonts;
	},
): void {
	ctx.textBaseline = 'middle';
	opts.lines.forEach((line, i) => {
		const cy = layout.code.y + i * layout.lineHeight + layout.lineHeight / 2;
		if (layout.gutterRight !== null) {
			ctx.font = runFont({ italic: false, bold: false }, opts.fonts);
			ctx.fillStyle = withAlpha(p.text2, 0.85);
			ctx.textAlign = 'right';
			ctx.fillText(String(opts.startLine + i), layout.gutterRight, cy);
		}
		ctx.textAlign = 'left';
		let x = layout.code.x;
		line.forEach((run, j) => {
			ctx.font = runFont(run, opts.fonts);
			ctx.fillStyle = run.color;
			ctx.fillText(run.text, x, cy);
			x += opts.widths[i]?.[j] ?? 0;
		});
	});
}

/** "made with ANVIL": a small glass pill on backgrounds, bare text inside the window. */
export function paintWatermark(
	ctx: CanvasRenderingContext2D,
	layout: SnapLayout,
	p: SnapPalette,
	fonts: Fonts,
): void {
	const mark = layout.watermark;
	if (!mark) return;
	const lead = 'made with ';
	const brand = 'ANVIL';
	ctx.textBaseline = 'middle';
	ctx.font = `400 11px ${fonts.ui}`;
	const leadWidth = ctx.measureText(lead).width;
	ctx.font = `700 11px ${fonts.code}`;
	ctx.letterSpacing = '2px';
	const brandWidth = ctx.measureText(brand).width;
	ctx.letterSpacing = '0px';
	const total = leadWidth + brandWidth;
	const left = mark.align === 'center' ? mark.x - total / 2 : mark.x - total;

	if (mark.align === 'center') {
		const pill = new Path2D();
		pill.roundRect(left - 12, mark.y - 12, total + 24, 24, 12);
		ctx.fillStyle = withAlpha(p.bg0, 0.45);
		ctx.fill(pill);
		ctx.lineWidth = 1;
		ctx.strokeStyle = withAlpha(p.text0, 0.12);
		ctx.stroke(pill);
	}

	ctx.textAlign = 'left';
	ctx.font = `400 11px ${fonts.ui}`;
	ctx.fillStyle = withAlpha(p.text0, 0.7);
	ctx.fillText(lead, left, mark.y);

	const brandX = left + leadWidth;
	const gradient = ctx.createLinearGradient(brandX, 0, brandX + brandWidth, 0);
	gradient.addColorStop(0, p.accent);
	gradient.addColorStop(1, p.accent2);
	ctx.font = `700 11px ${fonts.code}`;
	ctx.letterSpacing = '2px';
	ctx.fillStyle = gradient;
	ctx.fillText(brand, brandX, mark.y);
	ctx.letterSpacing = '0px';
}
