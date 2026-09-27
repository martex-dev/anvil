import type { ReplVariable } from '@shared/ipc/channels/python';

/** Variables whose name, type or value contains `filter` (case-insensitive), in REPL order. */
export function filterVariables(vars: readonly ReplVariable[], filter: string): ReplVariable[] {
	const q = filter.trim().toLowerCase();
	if (!q) return [...vars];
	return vars.filter(
		(v) =>
			v.name.toLowerCase().includes(q) ||
			v.type.toLowerCase().includes(q) ||
			v.value.toLowerCase().includes(q),
	);
}

/** What typing the variable into the REPL shows best: a table's first rows, else the value. */
export function inspectExpression(v: ReplVariable): string {
	return /^pandas\.(DataFrame|Series)$|^polars\.(DataFrame|Series)$/.test(v.type)
		? `${v.name}.head(20)`
		: v.name;
}
