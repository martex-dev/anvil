/**
 * A fast, dependency-free outline: classes, functions, methods and `# %%` cells for Python;
 * classes, functions, consts and interfaces for TS/JS; headings for Markdown. Line-based on
 * purpose: it must work instantly on any file, even without a language server.
 */

export type SymbolKind = 'class' | 'function' | 'method' | 'variable' | 'type' | 'cell' | 'heading';

export interface OutlineSymbol {
	name: string;
	kind: SymbolKind;
	/** 1-based. */
	line: number;
	/** Nesting depth for display (methods under classes, sub-headings). */
	depth: number;
	/** Last line of the block (for "which function am I in"). */
	end: number;
	detail?: string;
}

const indentOf = (line: string): number => {
	let n = 0;
	for (const ch of line) {
		if (ch === ' ') n++;
		else if (ch === '\t') n += 4;
		else break;
	}
	return n;
};

function python(lines: readonly string[]): OutlineSymbol[] {
	const out: OutlineSymbol[] = [];
	const stack: Array<{ indent: number; symbol: OutlineSymbol }> = [];
	lines.forEach((text, i) => {
		const line = i + 1;
		const cell = /^\s*#\s*%%(.*)$/.exec(text);
		if (cell) {
			out.push({
				name: cell[1]?.replace(/\[markdown\]/, '').trim() || `Cell`,
				kind: 'cell',
				line,
				depth: 0,
				end: line,
			});
			return;
		}
		if (!text.trim() || text.trimStart().startsWith('#')) return;
		const indent = indentOf(text);
		while ((stack.at(-1)?.indent ?? -1) >= indent) stack.pop();
		const m = /^\s*(?:async\s+)?(def|class)\s+([A-Za-z_]\w*)\s*(\([^)]*\)?)?/.exec(text);
		if (m) {
			const parent = stack.at(-1)?.symbol;
			const kind: SymbolKind =
				m[1] === 'class' ? 'class' : parent?.kind === 'class' ? 'method' : 'function';
			const symbol: OutlineSymbol = {
				name: m[2] ?? '',
				kind,
				line,
				depth: stack.length,
				end: line,
				...(m[3] && kind !== 'class'
					? { detail: m[3].length > 40 ? `${m[3].slice(0, 39)}…)` : m[3] }
					: {}),
			};
			out.push(symbol);
			stack.push({ indent, symbol });
			return;
		}
		const assign = /^([A-Z_][A-Z0-9_]{2,})\s*(?::[^=]+)?=/.exec(text);
		if (assign && indent === 0)
			out.push({ name: assign[1] ?? '', kind: 'variable', line, depth: 0, end: line });
	});
	return withEnds(out, lines);
}

function typescript(lines: readonly string[]): OutlineSymbol[] {
	const out: OutlineSymbol[] = [];
	lines.forEach((text, i) => {
		const line = i + 1;
		const depth = indentOf(text) > 0 ? 1 : 0;
		let m = /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/.exec(
			text,
		);
		if (m) return void out.push({ name: m[1] ?? '', kind: 'class', line, depth, end: line });
		m =
			/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/.exec(
				text,
			);
		if (m) return void out.push({ name: m[1] ?? '', kind: 'function', line, depth, end: line });
		m = /^\s*(?:export\s+)?(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/.exec(text);
		if (m) return void out.push({ name: m[1] ?? '', kind: 'type', line, depth, end: line });
		m =
			/^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/.exec(
				text,
			);
		if (m)
			return void out.push({ name: m[1] ?? '', kind: 'function', line, depth: 0, end: line });
		m =
			/^\s+(?:public\s+|private\s+|protected\s+|static\s+|async\s+|readonly\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^{]+)?\{\s*$/.exec(
				text,
			);
		if (m && !['if', 'for', 'while', 'switch', 'catch', 'function'].includes(m[1] ?? ''))
			out.push({ name: m[1] ?? '', kind: 'method', line, depth: 1, end: line });
	});
	return withEnds(out, lines);
}

function markdown(lines: readonly string[]): OutlineSymbol[] {
	const out: OutlineSymbol[] = [];
	let fence = false;
	lines.forEach((text, i) => {
		if (/^\s*```/.test(text)) fence = !fence;
		const m = !fence ? /^(#{1,6})\s+(.+?)\s*#*$/.exec(text) : null;
		if (m)
			out.push({
				name: m[2] ?? '',
				kind: 'heading',
				line: i + 1,
				depth: (m[1]?.length ?? 1) - 1,
				end: i + 1,
			});
	});
	return withEnds(out, lines);
}

/** A symbol ends right before the next symbol at the same or shallower depth. */
function withEnds(symbols: OutlineSymbol[], lines: readonly string[]): OutlineSymbol[] {
	return symbols.map((s, i) => {
		const next = symbols.slice(i + 1).find((n) => n.depth <= s.depth);
		return { ...s, end: next ? next.line - 1 : lines.length };
	});
}

export function outlineFor(language: string, lines: readonly string[]): OutlineSymbol[] {
	if (language === 'python') return python(lines);
	if (/^(typescript|javascript|typescriptreact|javascriptreact)$/.test(language))
		return typescript(lines);
	if (language === 'markdown') return markdown(lines);
	return [];
}

/** Innermost function/class/method containing `line` (for the breadcrumb). */
export function symbolPath(symbols: readonly OutlineSymbol[], line: number): OutlineSymbol[] {
	return symbols
		.filter(
			(s) => s.kind !== 'cell' && s.kind !== 'variable' && s.line <= line && s.end >= line,
		)
		.sort((a, b) => a.depth - b.depth);
}
