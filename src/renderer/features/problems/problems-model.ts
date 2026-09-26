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
