/**
 * Parses a `.env` file the way python-dotenv and VS Code's Python extension read one:
 * `KEY=value` lines, an optional `export ` prefix, `#` comments, single quotes taken literally,
 * double quotes with `\n` / `\t` / `\"` escapes, and `${VAR}` expanded from keys defined earlier
 * in the file or from `base` (the environment it's layered on). Malformed lines are skipped.
 */
export function parseDotEnv(
	text: string,
	base: Readonly<Record<string, string | undefined>> = {},
): Record<string, string> {
	const out: Record<string, string> = {};
	const lookup = (name: string): string => out[name] ?? base[name] ?? '';
	const expand = (value: string): string =>
		value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name: string) => lookup(name));
	const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? '';
		const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s?(.*)$/.exec(line);
		if (!m) continue;
		const key = m[1] ?? '';
		let raw = (m[2] ?? '').trim();
		if (raw.startsWith("'")) {
			const end = raw.indexOf("'", 1);
			out[key] = end === -1 ? raw.slice(1) : raw.slice(1, end);
			continue;
		}
		if (raw.startsWith('"')) {
			// A double-quoted value may span lines until its closing quote.
			let body = raw.slice(1);
			while (!/(^|[^\\])"/.test(body) && i + 1 < lines.length)
				body += `\n${lines[++i] ?? ''}`;
			const close = body.search(/(^|[^\\])"/);
			const inner =
				close === -1 ? body : body.slice(0, close + (body[close] === '"' ? 0 : 1));
			out[key] = expand(
				inner
					.replace(/\\n/g, '\n')
					.replace(/\\t/g, '\t')
					.replace(/\\r/g, '\r')
					.replace(/\\"/g, '"')
					.replace(/\\\\/g, '\\'),
			);
			continue;
		}
		// Unquoted: an inline comment starts at " #".
		const hash = raw.search(/\s#/);
		if (hash !== -1) raw = raw.slice(0, hash).trimEnd();
		out[key] = expand(raw);
	}
	return out;
}
