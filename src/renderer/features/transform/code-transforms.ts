import { isBlank, leadingWhitespace, mapLines, onContent, perLine } from './text-lines';
import { type Transform } from './types';

const IDENT_RE = /^[A-Za-z_][\w.]*$/;
// Black's default line length: past it the dict is laid out one entry per line.
const MAX_INLINE = 88;

/** Python single-quoted string literal. */
export function pyQuote(value: string): string {
	return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function toFString(content: string): string {
	if (/^(?:[fF][rR]?|[rR][fF])['"]/.test(content)) return content;
	// Already a string literal (optionally raw): just add the prefix so quoting stays as written.
	if (/^[rR]?(['"])[\s\S]*\1$/.test(content)) return `f${content}`;
	return `f${pyQuote(content)}`;
}

function debugPrint(content: string): string {
	let expr = content.replace(/[,;]+$/, '').trim();
	// `x = 5` / `self.x: int = 5` → print the assignment target, which is what you want to inspect.
	const assign = /^([A-Za-z_][\w.]*)\s*(?::[^=]+)?=(?!=)/.exec(expr);
	if (assign?.[1]) expr = assign[1];
	const names = expr.split(/\s*,\s*/);
	if (names.length > 1 && names.every((n) => IDENT_RE.test(n))) {
		return `print(f'${names.map((n) => `{${n}=}`).join(', ')}')`;
	}
	if (!expr.includes("'")) return `print(f'{${expr}=}')`;
	if (!expr.includes('"')) return `print(f"{${expr}=}")`;
	throw new Error(`Can't wrap an expression containing both quote styles: ${expr}`);
}

function pyValue(raw: string): string {
	const value = raw.replace(/,$/, '').trim();
	if (value === '' || value === 'null' || value === 'None') return 'None';
	if (value === 'true' || value === 'True') return 'True';
	if (value === 'false' || value === 'False') return 'False';
	if (/^[-+]?(?:\d[\d_]*(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(value)) return value;
	// Already a Python literal or container: keep verbatim.
	if (/^(['"[{(]|[rbfRBF]['"])/.test(value)) return value;
	return pyQuote(value);
}

function toDict(lines: string[]): string[] {
	const indent = leadingWhitespace(lines.find((l) => !isBlank(l)) ?? '');
	const entries: string[] = [];
	lines.forEach((line, i) => {
		if (isBlank(line)) return;
		const match = /^\s*(.+?)\s*[:=]\s*(.*)$/.exec(line);
		const rawKey = match?.[1];
		if (!match || rawKey === undefined) throw new Error(`Line ${i + 1}: expected 'key: value'`);
		const key = rawKey.replace(/^(['"])(.*)\1$/, '$2');
		entries.push(`${pyQuote(key)}: ${pyValue(match[2] ?? '')}`);
	});
	const inline = `${indent}{${entries.join(', ')}}`;
	if (inline.length <= MAX_INLINE) return [inline];
	return [`${indent}{`, ...entries.map((e) => `${indent}    ${e},`), `${indent}}`];
}

const IMPORT_START_RE = /^\s*(?:import[\s{'"*]|from\s+\S+\s+import\b)/;

interface ImportStatement {
	lines: string[];
	rank: number;
	key: string;
}

function describeImport(lines: string[]): ImportStatement {
	const text = lines.join(' ');
	const tsModule =
		/\bfrom\s+['"]([^'"]+)['"]/.exec(text) ?? /^\s*import\s+['"]([^'"]+)['"]/.exec(text);
	if (tsModule?.[1]) return { lines, rank: 0, key: tsModule[1] };
	const pyFrom = /^\s*from\s+(\S+)/.exec(text);
	// Ruff/isort put plain `import x` before `from x import y` within a block.
	if (pyFrom?.[1]) return { lines, rank: 1, key: pyFrom[1] };
	const pyImport = /^\s*import\s+(\S+)/.exec(text);
	return { lines, rank: 0, key: pyImport?.[1] ?? text };
}

/** Bracket depth change, so multi-line `import {` / `from x import (` stay one statement. */
function depthDelta(line: string): number {
	return (line.match(/[({]/g)?.length ?? 0) - (line.match(/[)}]/g)?.length ?? 0);
}

const importCollator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function sortImports(lines: string[]): string[] {
	const out: string[] = [];
	let block: ImportStatement[] = [];
	const flush = (): void => {
		block.sort(
			(a, b) =>
				a.rank - b.rank ||
				importCollator.compare(a.key, b.key) ||
				importCollator.compare(a.lines.join('\n'), b.lines.join('\n')),
		);
		for (const stmt of block) out.push(...stmt.lines);
		block = [];
	};
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? '';
		if (!IMPORT_START_RE.test(line)) {
			// Blank lines and comments separate groups; each group is sorted on its own.
			flush();
			out.push(line);
			continue;
		}
		const stmt = [line];
		let depth = depthDelta(line);
		while ((depth > 0 || stmt[stmt.length - 1]?.endsWith('\\')) && i + 1 < lines.length) {
			i++;
			const next = lines[i] ?? '';
			stmt.push(next);
			depth += depthDelta(next);
		}
		block.push(describeImport(stmt));
	}
	flush();
	return out;
}

export const CODE_TRANSFORMS: readonly Transform[] = [
	{
		id: 'python-f-string',
		label: 'Wrap in Python f-string',
		group: 'Code',
		example: "f'Total: {total}'",
		run: perLine(onContent(toFString)),
	},
	{
		id: 'python-print-vars',
		label: 'print() variables',
		group: 'Code',
		example: "print(f'{x=}')",
		run: perLine(onContent(debugPrint)),
	},
	{
		id: 'python-dict',
		label: 'key: value lines to Python dict',
		group: 'Code',
		example: "{'name': 'btc', 'size': 1.5}",
		run: (text) => mapLines(text, toDict),
	},
	{
		id: 'sort-imports',
		label: 'Sort import lines',
		group: 'Code',
		example: 'import numpy as np\nimport pandas as pd',
		run: (text) => mapLines(text, sortImports),
	},
];
