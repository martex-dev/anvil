export type PlaceholderSegment =
	| { kind: 'text'; text: string }
	| {
			kind: 'placeholder';
			/** Tab-stop number; 0 is the final cursor position. */
			index: number;
			/** Default text ('' for a bare tab stop); a choice shows its first option. */
			text: string;
			choices?: string[];
	  };

// Characters VS Code snippet syntax lets a backslash escape outside choices.
const ESCAPABLE = '$}\\';

function pushText(out: PlaceholderSegment[], text: string): void {
	if (!text) return;
	const last = out[out.length - 1];
	if (last?.kind === 'text') last.text += text;
	else out.push({ kind: 'text', text });
}

function splitChoices(raw: string): string[] {
	const choices: string[] = [];
	let current = '';
	for (let i = 0; i < raw.length; i++) {
		const ch = raw[i] ?? '';
		const next = raw[i + 1] ?? '';
		if (ch === '\\' && ',|\\$}'.includes(next) && next) {
			current += next;
			i++;
		} else if (ch === ',') {
			choices.push(current);
			current = '';
		} else {
			current += ch;
		}
	}
	choices.push(current);
	return choices;
}

/**
 * Parses from `start` into `out`. When `nested`, parsing stops after the `}` that closes the
 * enclosing placeholder. Returns the index just past what was consumed.
 */
function parse(body: string, start: number, nested: boolean, out: PlaceholderSegment[]): number {
	let i = start;
	while (i < body.length) {
		const ch = body[i] ?? '';
		const next = body[i + 1] ?? '';
		if (ch === '\\' && next && ESCAPABLE.includes(next)) {
			pushText(out, next);
			i += 2;
			continue;
		}
		if (nested && ch === '}') return i + 1;
		if (ch === '$') {
			const rest = body.slice(i + 1);
			const bare = /^\d+/.exec(rest);
			if (bare) {
				out.push({ kind: 'placeholder', index: Number(bare[0]), text: '' });
				i += 1 + bare[0].length;
				continue;
			}
			const braced = /^\{(\d+)([:|}])/.exec(rest);
			if (braced) {
				const index = Number(braced[1]);
				const tokenStart = i;
				i += 1 + braced[0].length;
				if (braced[2] === '}') {
					out.push({ kind: 'placeholder', index, text: '' });
					continue;
				}
				if (braced[2] === '|') {
					const end = body.indexOf('|}', i);
					if (end === -1) {
						// Malformed choice: show it as written rather than swallowing the rest.
						pushText(out, body.slice(tokenStart, i));
						continue;
					}
					const choices = splitChoices(body.slice(i, end));
					out.push({ kind: 'placeholder', index, text: choices[0] ?? '', choices });
					i = end + 2;
					continue;
				}
				// Defaults may nest placeholders; the preview shows them as their plain text.
				const inner: PlaceholderSegment[] = [];
				i = parse(body, i, true, inner);
				out.push({ kind: 'placeholder', index, text: inner.map((s) => s.text).join('') });
				continue;
			}
		}
		pushText(out, ch);
		i++;
	}
	return i;
}

/**
 * Splits a snippet body (VS Code/Monaco snippet syntax) into literal text and placeholders so a
 * preview can highlight what the user will tab through. Escapes are resolved.
 */
export function renderPlaceholders(body: string): PlaceholderSegment[] {
	const out: PlaceholderSegment[] = [];
	parse(body, 0, false, out);
	return out;
}

/** The body as it reads after insertion with every default accepted. */
export function placeholderPreview(body: string): string {
	return renderPlaceholders(body)
		.map((s) => s.text)
		.join('');
}
