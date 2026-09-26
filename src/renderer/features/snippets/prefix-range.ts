/** Characters a snippet prefix can contain (library.test.ts enforces `[a-z0-9-]`). */
const PREFIX_CHAR = /[A-Za-z0-9_-]/;

/**
 * The 1-based column where a hyphenated snippet prefix typed before `column` starts. Monaco's
 * word (for Python and TS) stops at '-', so for `resample-p|` it would only replace `p` and leave
 * `resample-` in front of the inserted code.
 */
export function prefixStartColumn(line: string, column: number): number {
	let index = Math.min(column - 1, line.length);
	while (index > 0 && PREFIX_CHAR.test(line.charAt(index - 1))) index--;
	return index + 1;
}
