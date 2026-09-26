import { getSettings } from '../../app/hooks/use-settings';
import { getLoadedMonaco } from '../../lib/monaco/load';
import { backgroundById, type BackgroundId, resolvePalette } from './backgrounds';
import {
	type Fonts,
	paintChrome,
	paintCode,
	paintHalo,
	paintWatermark,
	paintWindow,
	runFont,
	type SnapRun,
} from './paint';
import {
	type ChromeId,
	clipRuns,
	expandTabs,
	exportScale,
	layoutSnap,
	lineHeightFor,
	MAX_COLUMNS,
	type PaddingId,
} from './snap-layout';

export interface RenderSnapOptions {
	code: string;
	language: string;
	title: string;
	startLine: number;
	fontSize: number;
	background: BackgroundId;
	padding: PaddingId;
	chrome: ChromeId;
	lineNumbers: boolean;
	shadow: boolean;
	glow: boolean;
	watermark: boolean;
	/** Defaults to the editor's tab size. */
	tabSize?: number;
	/** Export scale; 2× unless the image would exceed canvas limits. */
	scale?: number;
}

/** Thrown when the editor stack hasn't loaded yet, so there's no tokenizer or theme to use. */
export class SnapUnavailableError extends Error {
	constructor() {
		super('Open a file first: Code Snap borrows the editor’s syntax highlighter.');
		this.name = 'SnapUnavailableError';
	}
}

type MonacoApi = NonNullable<ReturnType<typeof getLoadedMonaco>>;

const COLORIZE_TIMEOUT_MS = 4000;

/** Some grammars load lazily and can stall; fall back to plain text rather than hang. */
async function colorize(
	monaco: MonacoApi,
	code: string,
	language: string,
	tabSize: number,
): Promise<string> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<null>((resolve) => {
		timer = setTimeout(() => resolve(null), COLORIZE_TIMEOUT_MS);
	});
	try {
		const html = await Promise.race([
			monaco.editor.colorize(code, language, { tabSize }),
			timeout,
		]);
		return html ?? (await monaco.editor.colorize(code, 'plaintext', { tabSize }));
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Mounts Monaco's colorized HTML off-screen inside `.monaco-editor` so the live theme's `.mtkN`
 * rules apply, then reads each span's computed style. Parsed with DOMParser (inert: no scripts,
 * no handlers) rather than innerHTML.
 */
function extractRuns(html: string, lineCount: number): SnapRun[][] {
	const host = document.createElement('div');
	host.className = 'monaco-editor';
	host.setAttribute('aria-hidden', 'true');
	Object.assign(host.style, {
		position: 'fixed',
		left: '-100000px',
		top: '0',
		whiteSpace: 'pre',
		pointerEvents: 'none',
	});
	const parsed = new DOMParser().parseFromString(html, 'text/html');
	host.append(...Array.from(parsed.body.childNodes));
	document.body.appendChild(host);

	try {
		const styles = new Map<Element, Omit<SnapRun, 'text'>>();
		const styleOf = (el: Element): Omit<SnapRun, 'text'> => {
			const cached = styles.get(el);
			if (cached) return cached;
			const cs = getComputedStyle(el);
			const weight = Number.parseInt(cs.fontWeight, 10);
			const style = {
				color: cs.color,
				italic: cs.fontStyle === 'italic' || cs.fontStyle.startsWith('oblique'),
				bold: cs.fontWeight === 'bold' || (Number.isFinite(weight) && weight >= 600),
			};
			styles.set(el, style);
			return style;
		};

		const lines: SnapRun[][] = [];
		let current: SnapRun[] = [];
		const walk = (node: Node): void => {
			for (const child of Array.from(node.childNodes)) {
				if (child instanceof HTMLBRElement) {
					lines.push(current);
					current = [];
				} else if (child instanceof Element) {
					walk(child);
				} else if (child.nodeType === Node.TEXT_NODE) {
					// Monaco renders spaces as NBSP to stop HTML collapsing them.
					const text = (child.textContent ?? '').replace(/\u00a0/g, ' ');
					if (!text) continue;
					const style = styleOf(child.parentElement ?? host);
					const last = current.at(-1);
					if (
						last &&
						last.color === style.color &&
						last.italic === style.italic &&
						last.bold === style.bold
					) {
						last.text += text;
					} else {
						current.push({ text, ...style });
					}
				}
			}
		};
		walk(host);
		lines.push(current);
		// The output ends with a trailing <br/>; keep exactly the source's lines.
		while (lines.length < lineCount) lines.push([]);
		return lines.slice(0, lineCount);
	} finally {
		host.remove();
	}
}

let cache: { key: string; lines: SnapRun[][] } | null = null;

async function colorizedLines(
	code: string,
	language: string,
	tabSize: number,
): Promise<SnapRun[][]> {
	const key = `${language}\u0000${tabSize}\u0000${code}`;
	if (cache?.key === key) return cache.lines;
	const monaco = getLoadedMonaco();
	if (!monaco) throw new SnapUnavailableError();
	const html = await colorize(monaco, code, language, tabSize);
	const lines = extractRuns(html, code.split('\n').length);
	cache = { key, lines };
	return lines;
}

function cssVar(name: string, fallback: string): string {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * The editor font. `useApplySettings` writes the chosen `editorFont` (an id like 'fira') into
 * `--font-code` as a full family stack, so the variable is the single source of truth.
 */
function codeFontFamily(): string {
	return cssVar('--font-code', 'monospace');
}

async function loadFonts(fonts: Fonts): Promise<void> {
	const specs = [
		`400 ${fonts.size}px ${fonts.code}`,
		`700 ${fonts.size}px ${fonts.code}`,
		`italic 400 ${fonts.size}px ${fonts.code}`,
		`500 12px ${fonts.ui}`,
		`400 11px ${fonts.ui}`,
	];
	// A missing face just falls back to the next family; that's not worth failing the snap over.
	await Promise.all(specs.map((spec) => document.fonts.load(spec).catch(() => [])));
}

export async function renderSnap(options: RenderSnapOptions): Promise<HTMLCanvasElement> {
	const tabSize = options.tabSize ?? getSettings().tabSize;
	const code = options.code
		.split('\n')
		.map((line) => expandTabs(line, tabSize))
		.join('\n');
	const fonts: Fonts = {
		code: codeFontFamily(),
		ui: cssVar('--font-ui', 'sans-serif'),
		size: options.fontSize,
	};
	await loadFonts(fonts);
	const lines = (await colorizedLines(code, options.language, tabSize)).map((line) =>
		clipRuns(line, MAX_COLUMNS),
	);

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas 2D is unavailable.');

	ctx.font = runFont({ italic: false, bold: false }, fonts);
	const charWidth = ctx.measureText('0').width;
	const widths = lines.map((line) =>
		line.map((run) => {
			ctx.font = runFont(run, fonts);
			return ctx.measureText(run.text).width;
		}),
	);
	const contentWidth = Math.max(0, ...widths.map((w) => w.reduce((a, b) => a + b, 0)));

	const background = backgroundById(options.background);
	const transparent = background.paint === null;
	const layout = layoutSnap({
		lineCount: lines.length,
		contentWidth,
		charWidth,
		lineHeight: lineHeightFor(options.fontSize),
		padding: options.padding,
		chrome: options.chrome,
		lineNumbers: options.lineNumbers,
		startLine: options.startLine,
		watermark: !options.watermark ? 'none' : transparent ? 'inside' : 'outside',
	});
	const scale = exportScale(layout.width, layout.height, options.scale ?? 2);
	// Resizing resets the context, so size first, then set the transform.
	canvas.width = Math.round(layout.width * scale);
	canvas.height = Math.round(layout.height * scale);
	// The CSS size is the 1× size, so the canvas displays crisply if mounted directly.
	canvas.style.width = `${layout.width}px`;
	canvas.style.height = `${layout.height}px`;
	ctx.setTransform(scale, 0, 0, scale, 0, 0);

	const palette = resolvePalette();
	background.paint?.(ctx, layout.width, layout.height, palette);
	paintHalo(ctx, layout, palette, { shadow: options.shadow, glow: options.glow, scale });
	paintWindow(ctx, layout, palette, transparent);
	paintChrome(ctx, layout, palette, {
		chrome: options.chrome,
		title: options.title,
		language: options.language,
		fonts,
	});
	paintCode(ctx, layout, palette, { lines, widths, startLine: options.startLine, fonts });
	paintWatermark(ctx, layout, palette, fonts);
	return canvas;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error('Could not encode the snap as PNG.'));
		}, 'image/png');
	});
}
