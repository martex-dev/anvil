import { diffHunks } from './line-diff';

/** A Monaco-compatible edit: 1-based range in the old text, replaced by `text`. */
export interface TextEdit {
	range: {
		startLineNumber: number;
		startColumn: number;
		endLineNumber: number;
		endColumn: number;
	};
	text: string;
}

/** One line changed in place: only the differing middle, so a cursor elsewhere on it stays. */
function lineEdit(line: number, before: string, after: string): TextEdit | null {
	if (before === after) return null;
	let pre = 0;
	while (pre < before.length && pre < after.length && before[pre] === after[pre]) pre++;
	let suf = 0;
	while (
		suf < before.length - pre &&
		suf < after.length - pre &&
		before[before.length - 1 - suf] === after[after.length - 1 - suf]
	)
		suf++;
	return {
		range: {
			startLineNumber: line,
			startColumn: pre + 1,
			endLineNumber: line,
			endColumn: before.length - suf + 1,
		},
		text: after.slice(pre, after.length - suf),
	};
}

/**
 * The edits that turn `oldLines` (a model's lines) into `newText`, touching only what changed.
 * Replacing the whole buffer instead moves every cursor and collapses every fold; with these,
 * save-time cleanup, formatting and reloads leave the view alone outside the changed lines.
 * Returns null when the texts are too different to diff cheaply (use a full replace then).
 */
export function minimalEdits(
	oldLines: readonly string[],
	newText: string,
	eol: string,
): TextEdit[] | null {
	const newLines = newText.split(/\r?\n/);
	const hunks = diffHunks(oldLines, newLines);
	if (!hunks) return null;
	const lengthOf = (i: number): number => oldLines[i]?.length ?? 0;
	const edits: TextEdit[] = [];
	for (const h of hunks) {
		const inserted = newLines.slice(h.newStart, h.newStart + h.newCount);
		if (h.oldCount === h.newCount) {
			// Same shape (trimmed whitespace, reformatted lines): edit each line in place.
			inserted.forEach((after, k) => {
				const edit = lineEdit(h.oldStart + k + 1, oldLines[h.oldStart + k] ?? '', after);
				if (edit) edits.push(edit);
			});
			continue;
		}
		const first = h.oldStart + 1;
		const last = h.oldStart + h.oldCount;
		if (h.oldCount === 0) {
			// Pure insertion before old line `first`, or after the last line.
			edits.push(
				h.oldStart < oldLines.length
					? {
							range: {
								startLineNumber: first,
								startColumn: 1,
								endLineNumber: first,
								endColumn: 1,
							},
							text: inserted.join(eol) + eol,
						}
					: {
							range: {
								startLineNumber: oldLines.length,
								startColumn: lengthOf(oldLines.length - 1) + 1,
								endLineNumber: oldLines.length,
								endColumn: lengthOf(oldLines.length - 1) + 1,
							},
							text: eol + inserted.join(eol),
						},
			);
		} else if (h.newCount === 0) {
			// Pure deletion: take the line breaks with the lines.
			if (last < oldLines.length)
				edits.push({
					range: {
						startLineNumber: first,
						startColumn: 1,
						endLineNumber: last + 1,
						endColumn: 1,
					},
					text: '',
				});
			else if (h.oldStart > 0)
				edits.push({
					range: {
						startLineNumber: h.oldStart,
						startColumn: lengthOf(h.oldStart - 1) + 1,
						endLineNumber: last,
						endColumn: lengthOf(last - 1) + 1,
					},
					text: '',
				});
			else
				edits.push({
					range: {
						startLineNumber: 1,
						startColumn: 1,
						endLineNumber: last,
						endColumn: lengthOf(last - 1) + 1,
					},
					text: '',
				});
		} else {
			edits.push({
				range: {
					startLineNumber: first,
					startColumn: 1,
					endLineNumber: last,
					endColumn: lengthOf(last - 1) + 1,
				},
				text: inserted.join(eol),
			});
		}
	}
	return edits;
}
