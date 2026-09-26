/** Tokenizer for the "Evaluate Selection" calculator. */

/** A calculator error. `index` is 0-based; the message quotes a 1-based position for humans. */
export class MathError extends Error {
	constructor(
		/** The message without the position, so callers can re-anchor it (e.g. per line). */
		readonly detail: string,
		readonly index: number,
	) {
		super(`${detail} at position ${index + 1}`);
		this.name = 'MathError';
	}
}

export type Op = '+' | '-' | '*' | '/' | '//' | '%' | '**' | '^' | '(' | ')' | ',';

export type Token =
	| { kind: 'num'; value: number; pos: number }
	| { kind: 'ident'; name: string; pos: number }
	| { kind: 'op'; op: Op; pos: number }
	| { kind: 'end'; pos: number };

const PREFIXED_RE =
	/0[xX][0-9a-fA-F](?:_?[0-9a-fA-F])*|0[bB][01](?:_?[01])*|0[oO][0-7](?:_?[0-7])*/y;
const DECIMAL_RE = /(?:\d(?:_?\d)*(?:\.(?:\d(?:_?\d)*)?)?|\.\d(?:_?\d)*)(?:[eE][+-]?\d+)?/y;
const IDENT_RE = /[A-Za-z_][A-Za-z0-9_]*/y;
const OPS: readonly Op[] = ['**', '//', '+', '-', '*', '/', '%', '^', '(', ')', ','];

// Trader shorthand: 1.5k, 2m, 3b, 25bps. `m` is million here, never milli. Dividing (rather than
// multiplying by 1e-4 / 0.01) keeps 25bps and 5% exact, since 1e-4 isn't representable.
const SUFFIXES: Record<string, (value: number) => number> = {
	k: (v) => v * 1e3,
	m: (v) => v * 1e6,
	b: (v) => v * 1e9,
	bps: (v) => v / 1e4,
};

function matchAt(re: RegExp, src: string, pos: number): string | undefined {
	re.lastIndex = pos;
	return re.exec(src)?.[0];
}

function parsePrefixed(raw: string): number {
	const digits = raw.slice(2).replace(/_/g, '');
	const base = raw.charAt(1).toLowerCase();
	return parseInt(digits, base === 'x' ? 16 : base === 'b' ? 2 : 8);
}

/** True when what follows a `%` could start an operand, i.e. the `%` must be modulo. */
function operandFollows(src: string, pos: number): boolean {
	const rest = src.slice(pos).trimStart();
	return /^[\w.(]/.test(rest);
}

export function tokenize(src: string): Token[] {
	const tokens: Token[] = [];
	let pos = 0;
	while (pos < src.length) {
		const ch = src.charAt(pos);
		if (/\s/.test(ch)) {
			pos++;
			continue;
		}
		const start = pos;
		const prefixed = matchAt(PREFIXED_RE, src, pos);
		const decimal = prefixed === undefined ? matchAt(DECIMAL_RE, src, pos) : undefined;
		if (prefixed !== undefined || decimal !== undefined) {
			let value =
				prefixed !== undefined
					? parsePrefixed(prefixed)
					: Number(decimal?.replace(/_/g, ''));
			pos += (prefixed ?? decimal ?? '').length;
			const word = matchAt(IDENT_RE, src, pos);
			if (word !== undefined) {
				const key = word.toLowerCase();
				// hasOwn so `2constructor` can't resolve to an Object.prototype member.
				const scale =
					decimal !== undefined && Object.hasOwn(SUFFIXES, key)
						? SUFFIXES[key]
						: undefined;
				if (scale === undefined)
					throw new MathError(`Unexpected '${word}' after number`, pos);
				value = scale(value);
				pos += word.length;
			} else if (src.charAt(pos) === '%' && !operandFollows(src, pos + 1)) {
				// `5%` is a percent literal; `10 % 3` stays modulo because an operand follows.
				value /= 100;
				pos++;
			}
			tokens.push({ kind: 'num', value, pos: start });
			continue;
		}
		const ident = matchAt(IDENT_RE, src, pos);
		if (ident !== undefined) {
			tokens.push({ kind: 'ident', name: ident, pos: start });
			pos += ident.length;
			continue;
		}
		const op = OPS.find((o) => src.startsWith(o, pos));
		if (op === undefined) throw new MathError(`Unexpected character '${ch}'`, pos);
		tokens.push({ kind: 'op', op, pos: start });
		pos += op.length;
	}
	tokens.push({ kind: 'end', pos: src.length });
	return tokens;
}
