import type { Problem } from './problems-store';

/**
 * Stable React keys for one file's problems: by content, not position, so when markers update
 * a focused row stays on the same diagnostic. Identical diagnostics get a numbered suffix.
 */
export function problemKeys(problems: readonly Problem[]): string[] {
	const seen = new Map<string, number>();
	return problems.map((p) => {
		const base = `${p.line}:${p.column}:${p.severity}:${p.source}:${p.message}`;
		const n = seen.get(base) ?? 0;
		seen.set(base, n + 1);
		return n === 0 ? base : `${base}#${n}`;
	});
}

const RANK: Record<Problem['severity'], number> = { error: 0, warning: 1, info: 2 };

/** Panel order: by file, then errors before warnings before infos, then by line. */
export function compareProblems(a: Problem, b: Problem): number {
	return a.path.localeCompare(b.path) || RANK[a.severity] - RANK[b.severity] || a.line - b.line;
}
