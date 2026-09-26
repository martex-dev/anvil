import { describe, expect, it } from 'vitest';

import { ACCENTS } from '@shared/settings';

import { DEFAULT_THEME, themeById, THEMES } from './theme-list';
import css from './themes.css?raw';
import tokensCss from './tokens.css?raw';

const REQUIRED = [
	'--bg-0',
	'--bg-1',
	'--bg-2',
	'--bg-3',
	'--border',
	'--border-strong',
	'--glass',
	'--glass-strong',
	'--glass-edge',
	'--glass-highlight',
	'--editor-bg',
	'--scrim',
	'--text-0',
	'--text-1',
	'--text-2',
	'--up',
	'--down',
	'--warn',
	'--info',
	'--theme-accent',
	'--theme-accent-2',
	'--on-accent',
	'--syn-comment',
	'--syn-keyword',
	'--syn-control',
	'--syn-string',
	'--syn-number',
	'--syn-function',
	'--syn-type',
	'--syn-variable',
	'--syn-parameter',
	'--syn-property',
	'--syn-decorator',
	'--syn-builtin',
	'--syn-operator',
	'--syn-regexp',
];

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_ALPHA = /^rgb\(\s*\d{1,3}\s+\d{1,3}\s+\d{1,3}\s*\/\s*(?:0|1|0?\.\d+)\s*\)$/;

interface ThemeBlock {
	colorScheme: string | undefined;
	vars: Map<string, string>;
}

function parseThemes(css: string): Map<string, ThemeBlock> {
	const blocks = new Map<string, ThemeBlock>();
	const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
	for (const match of stripped.matchAll(/\[data-theme='([\w-]+)'\]\s*\{([^}]*)\}/g)) {
		const [, id = '', body = ''] = match;
		if (blocks.has(id)) throw new Error(`Duplicate block for theme '${id}'`);
		const vars = new Map<string, string>();
		let colorScheme: string | undefined;
		for (const decl of body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) {
			const [, prop = '', value = ''] = decl;
			if (prop === 'color-scheme') colorScheme = value.trim();
			else vars.set(prop, value.trim());
		}
		blocks.set(id, { colorScheme, vars });
	}
	return blocks;
}

function channel(value: number): number {
	const c = value / 255;
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
	const full =
		hex.length === 4
			? `#${[...hex.slice(1)].map((ch) => ch + ch).join('')}`
			: hex.toLowerCase();
	const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(full.slice(i, i + 2), 16))) as [
		number,
		number,
		number,
	];
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
	return (hi + 0.05) / (lo + 0.05);
}

const blocks = parseThemes(css);

function blockFor(id: string): ThemeBlock {
	const block = blocks.get(id);
	if (!block) throw new Error(`No [data-theme='${id}'] block in themes.css`);
	return block;
}

function colorOf(block: ThemeBlock, name: string): string {
	const value = block.vars.get(name);
	if (!value || !HEX.test(value))
		throw new Error(`${name} must be an opaque hex, got '${value}'`);
	return value;
}

describe('theme list', () => {
	it('has unique ids', () => {
		const ids = THEMES.map((theme) => theme.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('falls back to the default theme for unknown ids', () => {
		expect(themeById('nope').id).toBe(DEFAULT_THEME);
		expect(themeById('dracula').id).toBe('dracula');
	});

	it('has a CSS block for every theme and no orphan blocks', () => {
		expect([...blocks.keys()].sort()).toEqual(THEMES.map((theme) => theme.id).sort());
	});

	it('makes the default theme the :root base', () => {
		expect(css).toMatch(new RegExp(`:root,\\s*\\[data-theme='${DEFAULT_THEME}'\\]\\s*\\{`));
	});
});

describe.each(THEMES.map((theme) => [theme.id, theme] as const))('theme %s', (id, theme) => {
	const block = blockFor(id);

	it('declares a color-scheme matching its kind', () => {
		expect(block.colorScheme).toBe(theme.kind);
	});

	it('defines exactly the required variables', () => {
		const defined = [...block.vars.keys()];
		expect(REQUIRED.filter((name) => !block.vars.has(name))).toEqual([]);
		expect(defined.filter((name) => !REQUIRED.includes(name))).toEqual([]);
		expect(new Set(defined).size).toBe(defined.length);
	});

	it('uses only hex or rgb(r g b / a) values', () => {
		const invalid = [...block.vars].filter(([, v]) => !HEX.test(v) && !RGB_ALPHA.test(v));
		expect(invalid).toEqual([]);
	});

	it('keeps text readable on panels (WCAG)', () => {
		const bg = colorOf(block, '--bg-1');
		expect(contrast(colorOf(block, '--text-0'), bg)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(colorOf(block, '--text-1'), bg)).toBeGreaterThanOrEqual(3);
	});
});

/** Resolves `--accent` / `--on-accent` for a preset on a theme, following tokens.css's rules. */
function presetColors(preset: string, theme: string): { accent: string; onAccent: string } {
	const stripped = tokensCss.replace(/\/\*[\s\S]*?\*\//g, '');
	const root = new Map<string, string>();
	const rootBody = /:root\s*\{([^}]*)\}/.exec(stripped)?.[1] ?? '';
	for (const [, k = '', v = ''] of rootBody.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
		root.set(k, v.trim());
	let vars = new Map<string, string>();
	let specific = false;
	const rules = stripped.matchAll(
		/html\[data-accent='(\w+)'\](?::is\(([^)]*)\))?\s*\{([^}]*)\}/g,
	);
	for (const [, id = '', themes, body = ''] of rules) {
		if (id !== preset) continue;
		const forTheme = themes?.includes(`[data-theme='${theme}']`) ?? false;
		// Theme-specific rules are more specific than the plain preset rule, whatever the order.
		if (themes !== undefined && !forTheme) continue;
		if (specific && !forTheme) continue;
		specific = forTheme;
		vars = new Map(
			[...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [
				m[1] ?? '',
				(m[2] ?? '').trim(),
			]),
		);
	}
	const resolve = (name: string): string => {
		const value = vars.get(name) ?? '';
		const ref = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
		const hex = ref ? root.get(ref) : value;
		if (!hex || !HEX.test(hex)) throw new Error(`${preset}/${theme}: ${name} is '${value}'`);
		return hex;
	};
	return { accent: resolve('--accent'), onAccent: resolve('--on-accent') };
}

describe.each(THEMES.map((theme) => [theme.id] as const))('accent presets on %s', (id) => {
	const bg = colorOf(blockFor(id), '--bg-1');

	it.each(ACCENTS.map((a) => [a] as const))('keeps %s readable as text and as a fill', (a) => {
		const { accent, onAccent } = presetColors(a, id);
		expect(contrast(accent, bg)).toBeGreaterThanOrEqual(3);
		expect(contrast(onAccent, accent)).toBeGreaterThanOrEqual(4.5);
	});
});
