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

export type Severity = Problem['severity'];
export const SEVERITIES: readonly Severity[] = ['error', 'warning', 'info'];

/** How many problems each severity has, for the filter toggles. */
export function severityCounts(items: readonly Problem[]): Record<Severity, number> {
	const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
	for (const p of items) counts[p.severity] += 1;
	return counts;
}

/**
 * The problems to show, grouped by file in panel order: only the `shown` severities, and only
 * those whose path, message or source contain `text` (case-insensitive).
 */
export function groupProblems(
	items: readonly Problem[],
	text: string,
	shown: ReadonlySet<Severity>,
): Array<[string, Problem[]]> {
	const f = text.trim().toLowerCase();
	const byFile = new Map<string, Problem[]>();
	for (const p of items) {
		if (!shown.has(p.severity)) continue;
		if (f && !`${p.path} ${p.message} ${p.source}`.toLowerCase().includes(f)) continue;
		byFile.set(p.path, [...(byFile.get(p.path) ?? []), p]);
	}
	return [...byFile.entries()];
}

/** Panel order: by file, then errors before warnings before infos, then by line. */
export function compareProblems(a: Problem, b: Problem): number {
	return a.path.localeCompare(b.path) || RANK[a.severity] - RANK[b.severity] || a.line - b.line;
}
