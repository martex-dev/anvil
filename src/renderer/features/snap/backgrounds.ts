import { resolveToken } from '../../lib/resolve-color';
import { gradientLine, withAlpha } from './snap-layout';

/** Theme tokens resolved to #rrggbb(aa) once per render; canvas can't read CSS variables. */
export interface SnapPalette {
	accent: string;
	accent2: string;
	bg0: string;
	bg1: string;
	text0: string;
	text1: string;
	text2: string;
	up: string;
	warn: string;
	down: string;
	synControl: string;
	synNumber: string;
	synFunction: string;
	synType: string;
	synKeyword: string;
	synString: string;
	synRegexp: string;
}

export function resolvePalette(): SnapPalette {
	return {
		accent: resolveToken('--accent'),
		accent2: resolveToken('--accent-2'),
		bg0: resolveToken('--bg-0'),
		bg1: resolveToken('--bg-1'),
		text0: resolveToken('--text-0'),
		text1: resolveToken('--text-1'),
		text2: resolveToken('--text-2'),
		up: resolveToken('--up'),
		warn: resolveToken('--warn'),
		down: resolveToken('--down'),
		synControl: resolveToken('--syn-control'),
		synNumber: resolveToken('--syn-number'),
		synFunction: resolveToken('--syn-function'),
		synType: resolveToken('--syn-type'),
		synKeyword: resolveToken('--syn-keyword'),
		synString: resolveToken('--syn-string'),
		synRegexp: resolveToken('--syn-regexp'),
	};
}

export type BackgroundId =
	'aurora' | 'deep-space' | 'sunset' | 'lagoon' | 'nebula' | 'citrus' | 'void' | 'transparent';

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number, p: SnapPalette) => void;

export interface BackgroundPreset {
	id: BackgroundId;
	label: string;
	/** CSS for the option swatch, built from the same tokens as the canvas painter. */
	css: string;
	/** null leaves the canvas clear (transparent PNG). */
	paint: Painter | null;
}

function glowAt(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
	color: string,
	alpha: number,
): void {
	const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
	g.addColorStop(0, withAlpha(color, alpha));
	// Fade to the same hue at zero alpha: fading to "transparent" (black) muddies the edge.
	g.addColorStop(1, withAlpha(color, 0));
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

/** Two-stop gradient with a soft light sheen top-left and shade bottom-right for depth. */
function duotone(from: (p: SnapPalette) => string, to: (p: SnapPalette) => string): Painter {
	return (ctx, w, h, p) => {
		const l = gradientLine(135, w, h);
		const g = ctx.createLinearGradient(l.x0, l.y0, l.x1, l.y1);
		g.addColorStop(0, from(p));
		g.addColorStop(1, to(p));
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
		const reach = Math.max(w, h);
		glowAt(ctx, w * 0.15, 0, reach * 0.8, p.text0, 0.2);
		glowAt(ctx, w, h, reach * 0.7, p.bg0, 0.28);
	};
}

function duotoneCss(from: string, to: string): string {
	return `linear-gradient(135deg, var(${from}), var(${to}))`;
}

export const BACKGROUNDS: readonly BackgroundPreset[] = [
	{
		id: 'aurora',
		label: 'Aurora',
		css: duotoneCss('--accent', '--accent-2'),
		paint: duotone(
			(p) => p.accent,
			(p) => p.accent2,
		),
	},
	{
		id: 'deep-space',
		label: 'Deep space',
		css: [
			'radial-gradient(circle at 18% 0%, color-mix(in oklab, var(--accent) 45%, transparent), transparent 60%)',
			'radial-gradient(circle at 100% 100%, color-mix(in oklab, var(--accent-2) 40%, transparent), transparent 60%)',
			'var(--bg-0)',
		].join(', '),
		paint: (ctx, w, h, p) => {
			ctx.fillStyle = p.bg0;
			ctx.fillRect(0, 0, w, h);
			const reach = Math.max(w, h);
			glowAt(ctx, w * 0.18, 0, reach * 0.75, p.accent, 0.42);
			glowAt(ctx, w, h, reach * 0.7, p.accent2, 0.36);
		},
	},
	{
		id: 'sunset',
		label: 'Sunset',
		css: duotoneCss('--syn-control', '--syn-number'),
		paint: duotone(
			(p) => p.synControl,
			(p) => p.synNumber,
		),
	},
	{
		id: 'lagoon',
		label: 'Lagoon',
		css: duotoneCss('--syn-function', '--syn-type'),
		paint: duotone(
			(p) => p.synFunction,
			(p) => p.synType,
		),
	},
	{
		id: 'nebula',
		label: 'Nebula',
		css: duotoneCss('--syn-keyword', '--syn-function'),
		paint: duotone(
			(p) => p.synKeyword,
			(p) => p.synFunction,
		),
	},
	{
		id: 'citrus',
		label: 'Citrus',
		css: duotoneCss('--syn-string', '--syn-regexp'),
		paint: duotone(
			(p) => p.synString,
			(p) => p.synRegexp,
		),
	},
	{
		id: 'void',
		label: 'Void',
		css: 'var(--bg-0)',
		paint: (ctx, w, h, p) => {
			ctx.fillStyle = p.bg0;
			ctx.fillRect(0, 0, w, h);
		},
	},
	{
		id: 'transparent',
		label: 'Transparent',
		css: 'repeating-conic-gradient(var(--bg-3) 0% 25%, var(--bg-1) 0% 50%) 50% / 10px 10px',
		paint: null,
	},
];

export function backgroundById(id: BackgroundId): BackgroundPreset {
	return BACKGROUNDS.find((b) => b.id === id) ?? (BACKGROUNDS[0] as BackgroundPreset);
}
