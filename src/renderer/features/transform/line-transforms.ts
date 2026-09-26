import { pyQuote } from './code-transforms';
import { isBlank, leadingWhitespace, mapLines, perLine } from './text-lines';
import { type Transform } from './types';

const TAB_SIZE = 4;

// Natural order ("file2" before "file10") is what people expect when sorting lines of code/data.
const collator = new Intl.Collator('en', { numeric: true });

const FIRST_NUMBER_RE = /[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?/i;

function firstNumber(line: string): number | undefined {
	const match = FIRST_NUMBER_RE.exec(line);
	return match ? Number(match[0]) : undefined;
}

/** Unbiased integer in [0, max) via rejection sampling (plain modulo would skew small values). */
function randomInt(max: number): number {
	const limit = Math.floor(0x1_0000_0000 / max) * max;
	const buf = new Uint32Array(1);
	for (;;) {
		globalThis.crypto.getRandomValues(buf);
		const value = buf[0] ?? 0;
		if (value < limit) return value % max;
	}
}

function shuffle(lines: string[]): string[] {
	const out = [...lines];
	for (let i = out.length - 1; i > 0; i--) {
		const j = randomInt(i + 1);
		const a = out[i];
		const b = out[j];
		if (a === undefined || b === undefined) continue;
		out[i] = b;
		out[j] = a;
	}
	return out;
}

/** Joins trimmed non-blank lines, keeping the first line's indentation. */
function joinWith(separator: string): (text: string) => string {
	return (text) =>
		mapLines(text, (lines) => {
			const indent = leadingWhitespace(lines.find((l) => !isBlank(l)) ?? '');
			const parts = lines.filter((l) => !isBlank(l)).map((l) => l.trim());
			return [indent + parts.join(separator)];
		});
}

function expandTabs(line: string): string {
	let out = '';
	for (const ch of line) {
		out += ch === '\t' ? ' '.repeat(TAB_SIZE - (out.length % TAB_SIZE)) : ch;
	}
	return out;
}

function indentWidth(indent: string): number {
	return expandTabs(indent).length;
}

function spacesToTabs(line: string): string {
	const indent = leadingWhitespace(line);
	const width = indentWidth(indent);
	const rest = line.slice(indent.length);
	return '\t'.repeat(Math.floor(width / TAB_SIZE)) + ' '.repeat(width % TAB_SIZE) + rest;
}

function dedent(lines: string[]): string[] {
	const indents = lines.filter((l) => !isBlank(l)).map(leadingWhitespace);
	let common = indents[0] ?? '';
	for (const indent of indents) {
		let i = 0;
		while (i < common.length && i < indent.length && common[i] === indent[i]) i++;
		common = common.slice(0, i);
	}
	return lines.map((l) => (l.startsWith(common) ? l.slice(common.length) : l.trimStart()));
}

export const LINE_TRANSFORMS: readonly Transform[] = [
	{
		id: 'sort-lines-asc',
		label: 'Sort lines A→Z',
		group: 'Lines',
		example: 'apple\nbanana\ncherry',
		run: (text) => mapLines(text, (lines) => [...lines].sort(collator.compare)),
	},
	{
		id: 'sort-lines-desc',
		label: 'Sort lines Z→A',
		group: 'Lines',
		example: 'cherry\nbanana\napple',
		run: (text) => mapLines(text, (lines) => [...lines].sort((a, b) => collator.compare(b, a))),
	},
	{
		id: 'sort-lines-numeric',
		label: 'Sort lines numerically',
		group: 'Lines',
		example: 'v2\nv10\nv100',
		run: (text) =>
			mapLines(text, (lines) =>
				// Lines without a number sink to the bottom; sort is stable so they keep their order.
				[...lines].sort((a, b) => {
					const x = firstNumber(a);
					const y = firstNumber(b);
					if (x === undefined) return y === undefined ? 0 : 1;
					if (y === undefined) return -1;
					return x - y;
				}),
			),
	},
	{
		id: 'sort-lines-length',
		label: 'Sort lines by length',
		group: 'Lines',
		example: 'id\nname\naddress',
		run: (text) => mapLines(text, (lines) => [...lines].sort((a, b) => a.length - b.length)),
	},
	{
		id: 'reverse-lines',
		label: 'Reverse lines',
		group: 'Lines',
		example: 'c\nb\na',
		run: (text) => mapLines(text, (lines) => [...lines].reverse()),
	},
	{
		id: 'shuffle-lines',
		label: 'Shuffle lines',
		group: 'Lines',
		example: 'b\nc\na',
		run: (text) => mapLines(text, shuffle),
	},
	{
		id: 'unique-lines',
		label: 'Unique lines',
		group: 'Lines',
		example: 'a\nb (duplicates removed)',
		run: (text) => mapLines(text, (lines) => [...new Set(lines)]),
	},
	{
		id: 'remove-empty-lines',
		label: 'Remove empty lines',
		group: 'Lines',
		example: 'a\nb',
		run: (text) => mapLines(text, (lines) => lines.filter((l) => !isBlank(l))),
	},
	{
		id: 'join-lines-space',
		label: 'Join lines with a space',
		group: 'Lines',
		example: 'a b c',
		run: joinWith(' '),
	},
	{
		id: 'join-lines-comma',
		label: 'Join lines with a comma',
		group: 'Lines',
		example: 'a, b, c',
		run: joinWith(', '),
	},
	{
		id: 'split-commas',
		label: 'Split on commas into lines',
		group: 'Lines',
		example: 'a\nb\nc',
		run: (text) =>
			mapLines(text, (lines) =>
				lines.flatMap((line) => {
					const indent = leadingWhitespace(line);
					const parts = line
						.trim()
						.split(/\s*,\s*/)
						.filter((p) => p !== '');
					return parts.length === 0 ? [line] : parts.map((p) => indent + p);
				}),
			),
	},
	{
		id: 'number-lines',
		label: 'Number lines',
		group: 'Lines',
		example: '1. first\n2. second',
		run: (text) => mapLines(text, (lines) => lines.map((l, i) => `${i + 1}. ${l}`)),
	},
	{
		id: 'python-list',
		label: 'Lines to Python list',
		group: 'Lines',
		example: "['a', 'b', 'c']",
		run: (text) =>
			mapLines(text, (lines) => {
				const indent = leadingWhitespace(lines.find((l) => !isBlank(l)) ?? '');
				const items = lines.filter((l) => !isBlank(l)).map((l) => pyQuote(l.trim()));
				return [`${indent}[${items.join(', ')}]`];
			}),
	},
	{
		id: 'trim-trailing-whitespace',
		label: 'Trim trailing whitespace',
		group: 'Clean',
		example: 'no trailing spaces',
		run: perLine((l) => l.replace(/\s+$/, '')),
	},
	{
		id: 'collapse-spaces',
		label: 'Collapse multiple spaces',
		group: 'Clean',
		example: 'a b c',
		// Indentation is structure, not noise, so only interior runs collapse.
		run: perLine((l) => {
			const indent = leadingWhitespace(l);
			return indent + l.slice(indent.length).replace(/[ \t]{2,}/g, ' ');
		}),
	},
	{
		id: 'tabs-to-spaces',
		label: 'Tabs → 4 spaces',
		group: 'Clean',
		example: '    indented',
		run: perLine(expandTabs),
	},
	{
		id: 'spaces-to-tabs',
		label: '4 spaces → tabs',
		group: 'Clean',
		example: '\tindented',
		run: perLine(spacesToTabs),
	},
	{
		id: 'dedent',
		label: 'Dedent',
		group: 'Clean',
		example: 'def f():\n    pass',
		run: (text) => mapLines(text, dedent),
	},
];
