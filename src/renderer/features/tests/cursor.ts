import type { TestNode } from '@shared/ipc/channels/tests';

import { lineTargets } from './tree-utils';

const DEF = /^(\s*)(?:async\s+def|def|class)\s+\w/;

function indentOf(line: string): number {
	return /^\s*/.exec(line)?.[0].replace(/\t/g, '    ').length ?? 0;
}

/**
 * Lines of the `def`/`class` statements that enclose a line, innermost first, found by
 * indentation. A cursor inside a helper function nested in a test still finds the test.
 */
export function enclosingDefLines(lines: readonly string[], cursor: number): number[] {
	const out: number[] = [];
	// On a blank line the indentation says nothing; the statement above decides.
	let anchor = Math.min(cursor, lines.length);
	while (anchor > 1 && (lines[anchor - 1] ?? '').trim() === '') anchor--;
	const first = lines[anchor - 1] ?? '';
	if (first.trim() === '') return out;
	// A def line encloses itself; any other line is enclosed by what is less indented.
	let limit = DEF.test(first) ? indentOf(first) + 1 : indentOf(first);
	for (let n = anchor; n >= 1 && limit > 0; n--) {
		const text = lines[n - 1] ?? '';
		if (text.trim() === '') continue;
		const indent = indentOf(text);
		if (indent >= limit) continue;
		// A shallower `if`/`with`/`for` narrows the search too; only defs are reported.
		if (DEF.test(text)) out.push(n);
		limit = indent;
	}
	return out;
}

/** The test (or test class) the cursor is in, from the file's discovered tests. */
export function testAtCursor(
	file: TestNode,
	lines: readonly string[],
	cursor: number,
): TestNode | null {
	const targets = lineTargets(file);
	for (const line of enclosingDefLines(lines, cursor)) {
		const hit = targets.find((t) => t.line === line);
		if (hit) return hit;
	}
	return null;
}
