const DEF = /^\s*(?:async\s+)?def\s+(test\w*)\s*\(/;
const CLASS = /^\s*class\s+(\w+)\s*[(:]/;

const indentOf = (line: string): number =>
	(/^\s*/.exec(line)?.[0] ?? '').replace(/\t/g, '    ').length;
const blank = (line: string): boolean => line.trim() === '' || line.trim().startsWith('#');

/**
 * The pytest node (`test_x` or `TestCase::test_x`) the cursor is in, or null outside a test.
 * Walks up through the lines that enclose the cursor (each less indented than everything below
 * it) to the nearest `def test…`, then to the `class Test…` holding it, if any. 1-based `line`.
 */
export function testAtLine(lines: readonly string[], line: number): string | null {
	let at = Math.min(Math.max(line, 1), lines.length) - 1;
	// A blank line between two tests belongs to the one above it.
	while (at > 0 && blank(lines[at] ?? '')) at--;
	let limit = indentOf(lines[at] ?? '') + 1;
	let test: { name: string; indent: number } | null = null;
	for (let i = at; i >= 0; i--) {
		const text = lines[i] ?? '';
		if (blank(text)) continue;
		const indent = indentOf(text);
		if (indent >= limit) continue;
		limit = indent;
		if (!test) {
			const name = DEF.exec(text)?.[1];
			if (name) {
				if (indent === 0) return name;
				test = { name, indent };
			}
		} else {
			const cls = CLASS.exec(text)?.[1];
			// pytest only collects methods of `Test…` classes, and only directly inside them.
			if (cls) return cls.startsWith('Test') ? `${cls}::${test.name}` : null;
			if (/^\s*(?:async\s+)?def\s/.test(text)) return null;
		}
		if (indent === 0) break;
	}
	return null;
}
