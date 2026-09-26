export type Segment =
	| { kind: 'md'; text: string }
	| { kind: 'code'; lang: string | null; code: string; closed: boolean };

/**
 * Splits a (possibly still streaming) Markdown reply into prose and fenced code blocks, so code
 * can get Copy/Apply buttons. An unterminated fence at the end is an in-progress block.
 */
export function splitFences(text: string): Segment[] {
	const out: Segment[] = [];
	const lines = text.split('\n');
	let prose: string[] = [];
	let code: { fence: string; lang: string | null; lines: string[] } | null = null;
	const flushProse = (): void => {
		const joined = prose.join('\n');
		if (joined.trim()) out.push({ kind: 'md', text: joined });
		prose = [];
	};
	for (const line of lines) {
		if (code) {
			if (
				line.trimEnd() === code.fence ||
				(line.trim().startsWith(code.fence) && line.trim().replace(/`+/, '') === '')
			) {
				out.push({
					kind: 'code',
					lang: code.lang,
					code: code.lines.join('\n'),
					closed: true,
				});
				code = null;
			} else {
				code.lines.push(line);
			}
			continue;
		}
		const open = /^\s*(`{3,}|~{3,})\s*([\w+#.-]*)/.exec(line);
		if (open?.[1]) {
			flushProse();
			code = { fence: open[1], lang: open[2] || null, lines: [] };
		} else {
			prose.push(line);
		}
	}
	if (code)
		out.push({ kind: 'code', lang: code.lang, code: code.lines.join('\n'), closed: false });
	else flushProse();
	return out;
}

/**
 * What "apply" produces: the file with the block replacing either the selection (1-based,
 * inclusive lines) or the whole file.
 */
export function applyBlock(
	file: string,
	block: string,
	selection: { startLine: number; endLine: number } | null,
): string {
	if (!selection) return block.endsWith('\n') || !file.endsWith('\n') ? block : `${block}\n`;
	const lines = file.split('\n');
	const before = lines.slice(0, selection.startLine - 1);
	const after = lines.slice(selection.endLine);
	return [...before, ...block.replace(/\n$/, '').split('\n'), ...after].join('\n');
}
