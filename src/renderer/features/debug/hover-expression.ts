const NAME = /^[A-Za-z_]\w*$/;

/**
 * The expression under the mouse: the identifier plus the attribute chain to its left
 * (`self.model.weights` when hovering `weights`). Only plain names and attributes, so a hover
 * never runs a call the code contains. `column` is 1-based, like Monaco's.
 */
export function expressionAt(line: string, column: number): string | null {
	let start = column - 1;
	let end = column - 1;
	while (start > 0 && /[\w.]/.test(line[start - 1] ?? '')) start--;
	while (end < line.length && /\w/.test(line[end] ?? '')) end++;
	const expr = line.slice(start, end).replace(/^\.+/, '');
	if (!expr) return null;
	return expr.split('.').every((part) => NAME.test(part)) ? expr : null;
}
