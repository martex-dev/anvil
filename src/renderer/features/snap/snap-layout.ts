/**
 * Pure text + geometry helpers for Code Snap. No DOM here: render.ts measures text and hands the
 * numbers in, so the layout math stays unit-testable.
 */

export type PaddingId = 's' | 'm' | 'l';
export type ChromeId = 'mac' | 'title' | 'none';
/** Where the "made with ANVIL" mark goes: under the window, or inside it on transparent PNGs. */
export type WatermarkPlacement = 'none' | 'outside' | 'inside';

export const MAX_LINES = 400;
/** Minified one-liners would produce absurdly wide images; longer lines end in an ellipsis. */
export const MAX_COLUMNS = 240;

export const PADDING_PX: Record<PaddingId, number> = { s: 32, m: 64, l: 96 };
export const WINDOW_RADIUS = 12;
const CODE_PAD_X = 24;
const CODE_PAD_Y = 20;
const TITLE_BAR_HEIGHT = 40;
const GUTTER_GAP = 20;
const MIN_WINDOW_WIDTH = 360;
/** Room under the window for an outside watermark, so small padding doesn't cramp it. */
const WATERMARK_MIN_BOTTOM = 56;
const WATERMARK_FOOTER = 28;

/** Tabs → spaces up to the next tab stop, so columns match what the editor shows. */
export function expandTabs(line: string, tabSize: number): string {
	if (!line.includes('\t')) return line;
	const size = Math.max(1, Math.floor(tabSize));
	let out = '';
	for (const ch of line) {
		if (ch === '\t') out += ' '.repeat(size - (out.length % size));
		else out += ch;
	}
	return out;
}

function isBlank(line: string): boolean {
	return line.trim() === '';
}

/** Removes the leading whitespace every non-blank line shares; blank lines become empty. */
export function dedent(lines: readonly string[]): string[] {
	let common: string | null = null;
	for (const line of lines) {
		if (isBlank(line)) continue;
		const indent = /^[ \t]*/.exec(line)?.[0] ?? '';
		if (common === null) {
			common = indent;
			continue;
		}
		let i = 0;
		while (i < common.length && i < indent.length && common[i] === indent[i]) i++;
		common = common.slice(0, i);
		if (common === '') break;
	}
	const cut = common?.length ?? 0;
	return lines.map((line) => (isBlank(line) ? '' : line.slice(cut)));
}

/** Drops blank lines at both ends, shifting the first line number along with them. */
export function trimBlankEdges(
	lines: readonly string[],
	startLine: number,
): { lines: string[]; startLine: number } {
	let first = 0;
	let last = lines.length - 1;
	while (first <= last && isBlank(lines[first] ?? '')) first++;
	while (last >= first && isBlank(lines[last] ?? '')) last--;
	return { lines: lines.slice(first, last + 1), startLine: startLine + first };
}

/** Editor lines → the code a snap shows: tabs expanded, blank edges trimmed, dedented. */
export function prepareSnapCode(
	lines: readonly string[],
	startLine: number,
	tabSize: number,
): { code: string; startLine: number } {
	const expanded = lines.map((line) => expandTabs(line.replace(/\s+$/, ''), tabSize));
	const trimmed = trimBlankEdges(expanded, startLine);
	return { code: dedent(trimmed.lines).join('\n'), startLine: trimmed.startLine };
}

export function lineHeightFor(fontSize: number): number {
	return Math.round(fontSize * 1.6);
}

export function lineNumberDigits(startLine: number, lineCount: number): number {
	return String(Math.max(1, startLine + Math.max(1, lineCount) - 1)).length;
}

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface LayoutInput {
	lineCount: number;
	/** Pixel width of the widest code line in the code font. */
	contentWidth: number;
	/** Width of one digit in the code font (line numbers are tabular). */
	charWidth: number;
	lineHeight: number;
	padding: PaddingId;
	chrome: ChromeId;
	lineNumbers: boolean;
	startLine: number;
	watermark: WatermarkPlacement;
}

export interface SnapLayout {
	width: number;
	height: number;
	window: Rect;
	/** The chrome strip at the top of the window, or null without chrome. */
	titleBar: Rect | null;
	/** Left edge of the code text and top of the first line. */
	code: { x: number; y: number };
	/** Right edge line numbers align to, or null when they're off. */
	gutterRight: number | null;
	lineHeight: number;
	watermark: { x: number; y: number; align: 'center' | 'right' } | null;
}

export function layoutSnap(input: LayoutInput): SnapLayout {
	const pad = PADDING_PX[input.padding];
	const lines = Math.max(1, input.lineCount);
	const gutter = input.lineNumbers
		? Math.ceil(lineNumberDigits(input.startLine, lines) * input.charWidth) + GUTTER_GAP
		: 0;
	const titleBar = input.chrome === 'none' ? 0 : TITLE_BAR_HEIGHT;
	const footer = input.watermark === 'inside' ? WATERMARK_FOOTER : 0;

	const windowWidth = Math.max(
		MIN_WINDOW_WIDTH,
		Math.ceil(CODE_PAD_X * 2 + gutter + input.contentWidth),
	);
	const codeHeight = lines * input.lineHeight;
	// Chrome already separates the code from the top edge, so less top padding is needed.
	const codeTop = titleBar > 0 ? titleBar + CODE_PAD_Y / 2 : CODE_PAD_Y;
	const windowHeight = Math.ceil(codeTop + codeHeight + CODE_PAD_Y + footer);

	const bottom = input.watermark === 'outside' ? Math.max(pad, WATERMARK_MIN_BOTTOM) : pad;
	const win: Rect = { x: pad, y: pad, width: windowWidth, height: windowHeight };

	let watermark: SnapLayout['watermark'] = null;
	if (input.watermark === 'outside') {
		watermark = {
			x: pad + windowWidth / 2,
			y: pad + windowHeight + bottom / 2,
			align: 'center',
		};
	} else if (input.watermark === 'inside') {
		watermark = {
			x: pad + windowWidth - CODE_PAD_X,
			y: pad + windowHeight - WATERMARK_FOOTER / 2 - CODE_PAD_Y / 4,
			align: 'right',
		};
	}

	return {
		width: pad * 2 + windowWidth,
		height: pad + windowHeight + bottom,
		window: win,
		titleBar: titleBar > 0 ? { x: pad, y: pad, width: windowWidth, height: titleBar } : null,
		code: { x: pad + CODE_PAD_X + gutter, y: pad + codeTop },
		gutterRight: input.lineNumbers ? pad + CODE_PAD_X + gutter - GUTTER_GAP : null,
		lineHeight: input.lineHeight,
		watermark,
	};
}

/**
 * The export scale: `desired` (2× for crisp retina PNGs) unless that would blow past Chromium's
 * canvas limits, in which case it shrinks just enough to fit.
 */
export function exportScale(
	width: number,
	height: number,
	desired = 2,
	maxSide = 16384,
	maxPixels = 120_000_000,
): number {
	if (width <= 0 || height <= 0) return desired;
	return Math.min(
		desired,
		maxSide / width,
		maxSide / height,
		Math.sqrt(maxPixels / (width * height)),
	);
}

/**
 * Start/end points of a CSS `linear-gradient(<angle>deg, …)` over a w×h box, so canvas
 * gradients match the swatches drawn with CSS.
 */
export function gradientLine(
	angleDeg: number,
	width: number,
	height: number,
): { x0: number; y0: number; x1: number; y1: number } {
	const rad = (angleDeg * Math.PI) / 180;
	const dx = Math.sin(rad);
	const dy = -Math.cos(rad);
	const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
	const cx = width / 2;
	const cy = height / 2;
	return { x0: cx - dx * half, y0: cy - dy * half, x1: cx + dx * half, y1: cy + dy * half };
}

/** 'src/app/main.tsx' → 'main-snap.png', safe for any filesystem. */
export function snapFileName(title: string): string {
	const base = title.split(/[\\/]/).pop() ?? '';
	const stem = base.replace(/\.[^.]+$/, '') || base;
	const safe = stem.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
	return `${safe || 'code'}-snap.png`;
}

/** '#22e5ff' / '#22e5ff80' + alpha → 'rgb(34 229 255 / 0.5)'; alpha multiplies the existing one. */
export function withAlpha(hex: string, alpha: number): string {
	const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i.exec(hex.trim());
	if (!m) return hex;
	const [, r = '0', g = '0', b = '0', a] = m;
	const base = a === undefined ? 1 : parseInt(a, 16) / 255;
	const out = Math.round(Math.min(1, Math.max(0, base * alpha)) * 1000) / 1000;
	return `rgb(${parseInt(r, 16)} ${parseInt(g, 16)} ${parseInt(b, 16)} / ${out})`;
}

/** Cuts styled runs at `max` characters, ending the line with an ellipsis run. */
export function clipRuns<T extends { text: string }>(runs: readonly T[], max: number): T[] {
	const out: T[] = [];
	let used = 0;
	for (const run of runs) {
		if (used + run.text.length <= max) {
			out.push(run);
			used += run.text.length;
			continue;
		}
		const room = Math.max(0, max - used - 1);
		out.push({ ...run, text: `${run.text.slice(0, room)}…` });
		break;
	}
	return out;
}
