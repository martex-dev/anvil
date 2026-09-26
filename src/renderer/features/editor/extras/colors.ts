import type * as Monaco from 'monaco-editor';

import { getSettings } from '../../../app/hooks/use-settings';
import type { MonacoApi } from '../../../lib/monaco/setup';

export interface Rgba {
	red: number;
	green: number;
	blue: number;
	alpha: number;
}

export interface FoundColor {
	/** 0-based offsets into the text. */
	start: number;
	end: number;
	color: Rgba;
	format: 'hex' | 'rgb' | 'hsl';
}

const PATTERN =
	/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|rgba?\(\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*(?:[,/]\s*[\d.]+%?\s*)?\)|hsla?\(\s*[\d.]+(?:deg)?\s*[, ]\s*[\d.]+%\s*[, ]\s*[\d.]+%\s*(?:[,/]\s*[\d.]+%?\s*)?\)/g;

const clamp = (n: number): number => Math.min(1, Math.max(0, n));
const channel = (v: string, max: number): number =>
	v.endsWith('%') ? clamp(Number.parseFloat(v) / 100) : clamp(Number.parseFloat(v) / max);

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	const k = (n: number): number => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
	return [f(0), f(8), f(4)];
}

export function parseColor(text: string): { color: Rgba; format: FoundColor['format'] } | null {
	if (text.startsWith('#')) {
		let hex = text.slice(1);
		if (hex.length <= 4) hex = [...hex].map((c) => c + c).join('');
		const n = (i: number): number => Number.parseInt(hex.slice(i, i + 2), 16) / 255;
		return {
			color: { red: n(0), green: n(2), blue: n(4), alpha: hex.length === 8 ? n(6) : 1 },
			format: 'hex',
		};
	}
	const parts = text
		.slice(text.indexOf('(') + 1, -1)
		.split(/[\s,/]+/)
		.filter(Boolean);
	const [a = '0', b = '0', c = '0', alpha] = parts;
	const al = alpha === undefined ? 1 : channel(alpha, 1);
	if (text.startsWith('rgb')) {
		return {
			color: {
				red: channel(a, 255),
				green: channel(b, 255),
				blue: channel(c, 255),
				alpha: al,
			},
			format: 'rgb',
		};
	}
	const [r, g, bl] = hslToRgb(Number.parseFloat(a), channel(b, 100), channel(c, 100));
	return { color: { red: r, green: g, blue: bl, alpha: al }, format: 'hsl' };
}

/** Color literals in any text: #rgb(a), #rrggbb(aa), rgb()/rgba(), hsl()/hsla(). */
export function findColors(text: string): FoundColor[] {
	const out: FoundColor[] = [];
	for (const m of text.matchAll(PATTERN)) {
		const parsed = parseColor(m[0]);
		if (!parsed || m.index === undefined) continue;
		out.push({ start: m.index, end: m.index + m[0].length, ...parsed });
	}
	return out;
}

const to255 = (n: number): number => Math.round(n * 255);
const hex2 = (n: number): string => to255(n).toString(16).padStart(2, '0');

export function formatColor(c: Rgba, format: FoundColor['format']): string {
	if (format === 'hex')
		return `#${hex2(c.red)}${hex2(c.green)}${hex2(c.blue)}${c.alpha < 1 ? hex2(c.alpha) : ''}`;
	if (format === 'rgb') {
		const rgb = `${to255(c.red)}, ${to255(c.green)}, ${to255(c.blue)}`;
		return c.alpha < 1 ? `rgba(${rgb}, ${Math.round(c.alpha * 100) / 100})` : `rgb(${rgb})`;
	}
	const max = Math.max(c.red, c.green, c.blue);
	const min = Math.min(c.red, c.green, c.blue);
	const l = (max + min) / 2;
	const d = max - min;
	const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
	let h = 0;
	if (d !== 0) {
		if (max === c.red) h = 60 * (((c.green - c.blue) / d) % 6);
		else if (max === c.green) h = 60 * ((c.blue - c.red) / d + 2);
		else h = 60 * ((c.red - c.green) / d + 4);
	}
	const hsl = `${Math.round((h + 360) % 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%`;
	return c.alpha < 1 ? `hsla(${hsl}, ${Math.round(c.alpha * 100) / 100})` : `hsl(${hsl})`;
}

// CSS-family languages already get swatches from their own language service.
const NATIVE = new Set(['css', 'scss', 'less']);
const MAX_LENGTH = 1_000_000;

/** Inline color swatches with a picker for every other language (Python, TS, JSON, Markdown…). */
export function registerColorSwatches(monaco: MonacoApi): Monaco.IDisposable {
	return monaco.languages.registerColorProvider(
		{ pattern: '**' },
		{
			provideDocumentColors(model) {
				if (!getSettings().colorSwatches || NATIVE.has(model.getLanguageId())) return [];
				if (model.getValueLength() > MAX_LENGTH) return [];
				return findColors(model.getValue()).map((f) => {
					const a = model.getPositionAt(f.start);
					const b = model.getPositionAt(f.end);
					return {
						color: f.color,
						range: new monaco.Range(a.lineNumber, a.column, b.lineNumber, b.column),
					};
				});
			},
			provideColorPresentations(model, info) {
				const original = model.getValueInRange(info.range);
				const format = parseColor(original)?.format ?? 'hex';
				const label = formatColor(info.color, format);
				return [
					{ label },
					...(['hex', 'rgb', 'hsl'] as const)
						.filter((f) => f !== format)
						.map((f) => ({ label: formatColor(info.color, f) })),
				];
			},
		},
	);
}
