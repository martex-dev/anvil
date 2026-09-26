/**
 * "Evaluate Selection": a hand-written recursive-descent calculator. No eval/Function — the
 * renderer CSP forbids it, and a real parser gives position-accurate errors anyway.
 *
 * Grammar (Python precedence, so -2 ** 2 == -4 and ** / ^ are right-associative):
 *   additive := term (('+' | '-') term)*
 *   term     := unary (('*' | '/' | '//' | '%') unary)*
 *   unary    := ('+' | '-') unary | power
 *   power    := primary (('**' | '^') unary)?
 *   primary  := number | name | name '(' args ')' | '(' additive ')'
 */
import { formatNumber } from './math-format';
import { arityText, CONSTANTS, FUNCTIONS } from './math-functions';
import { MathError, type Op, type Token, tokenize } from './math-lexer';
import { mapLines } from './text-lines';

export { formatNumber } from './math-format';
export { MathError } from './math-lexer';

type Vars = Readonly<Record<string, number>>;

function tokenText(token: Token): string {
	switch (token.kind) {
		case 'end':
			return 'end of expression';
		case 'num':
			return `number ${token.value}`;
		case 'ident':
			return `'${token.name}'`;
		case 'op':
			return `'${token.op}'`;
	}
}

function unexpected(token: Token): MathError {
	return new MathError(`Unexpected ${tokenText(token)}`, token.pos);
}

class Parser {
	private i = 0;

	constructor(
		private readonly tokens: readonly Token[],
		private readonly vars: Vars,
	) {}

	parse(): number {
		const value = this.additive();
		const token = this.peek();
		if (token.kind !== 'end') throw unexpected(token);
		return value;
	}

	private peek(): Token {
		// tokenize() always ends with an 'end' token, so this fallback is only for the type checker.
		return this.tokens[this.i] ?? { kind: 'end', pos: 0 };
	}

	private takeOp(...ops: Op[]): Op | undefined {
		const token = this.peek();
		if (token.kind !== 'op' || !ops.includes(token.op)) return undefined;
		this.i++;
		return token.op;
	}

	private expect(op: Op): void {
		const token = this.peek();
		if (this.takeOp(op) === undefined) {
			throw new MathError(`Expected '${op}' but found ${tokenText(token)}`, token.pos);
		}
	}

	private additive(): number {
		let value = this.term();
		for (let op = this.takeOp('+', '-'); op; op = this.takeOp('+', '-')) {
			const right = this.term();
			value = op === '+' ? value + right : value - right;
		}
		return value;
	}

	private term(): number {
		let value = this.unary();
		for (let op = this.takeOp('*', '/', '//', '%'); op; op = this.takeOp('*', '/', '//', '%')) {
			const right = this.unary();
			if (op === '*') value *= right;
			else if (op === '/') value /= right;
			else if (op === '//') value = Math.floor(value / right);
			// Python modulo: the result takes the divisor's sign (-7 % 3 == 2).
			else value = value - right * Math.floor(value / right);
		}
		return value;
	}

	private unary(): number {
		const op = this.takeOp('+', '-');
		if (op === '-') return -this.unary();
		if (op === '+') return this.unary();
		return this.power();
	}

	private power(): number {
		const base = this.primary();
		// The exponent is parsed as unary so 2 ** -1 works and 2 ^ 3 ^ 2 nests to the right.
		if (this.takeOp('**', '^')) return base ** this.unary();
		return base;
	}

	private primary(): number {
		const token = this.peek();
		if (token.kind === 'num') {
			this.i++;
			return token.value;
		}
		if (token.kind === 'ident') {
			this.i++;
			if (this.takeOp('(')) return this.call(token.name, token.pos);
			return this.lookup(token.name, token.pos);
		}
		if (this.takeOp('(')) {
			const value = this.additive();
			this.expect(')');
			return value;
		}
		throw unexpected(token);
	}

	private lookup(name: string, pos: number): number {
		if (Object.hasOwn(this.vars, name)) return this.vars[name] ?? NaN;
		if (Object.hasOwn(CONSTANTS, name)) return CONSTANTS[name] ?? NaN;
		if (Object.hasOwn(FUNCTIONS, name)) {
			throw new MathError(`'${name}' is a function; call it like ${name}(x)`, pos);
		}
		throw new MathError(`Unknown name '${name}'`, pos);
	}

	private call(name: string, pos: number): number {
		const fn = Object.hasOwn(FUNCTIONS, name) ? FUNCTIONS[name] : undefined;
		if (!fn) throw new MathError(`Unknown function '${name}'`, pos);
		const args: number[] = [];
		if (!this.takeOp(')')) {
			do args.push(this.additive());
			while (this.takeOp(','));
			this.expect(')');
		}
		if (args.length < fn.min || args.length > fn.max) {
			throw new MathError(`${name}() takes ${arityText(fn)}, got ${args.length}`, pos);
		}
		try {
			return fn.run(args);
		} catch (err) {
			throw new MathError(err instanceof Error ? err.message : String(err), pos);
		}
	}
}

/** Evaluates a calculator expression. Throws MathError (with a position) on bad input. */
export function evaluate(expr: string, vars: Vars = {}): number {
	if (expr.trim() === '') throw new Error('Empty expression');
	return new Parser(tokenize(expr), vars).parse();
}

export interface SelectionResult {
	/** The last computed value, formatted. */
	result: string;
	/** Text to put back in place of the selection. */
	replaced: string;
}

const ASSIGN_RE = /^(\s*)([A-Za-z_]\w*)(\s*=(?!=)\s*)(\S.*?)\s*$/;
const TRAILING_EQ_RE = /^(\s*)(\S.*?)\s*=\s*$/;

/**
 * Evaluates each non-empty line. `expr =` becomes `expr = result`, a bare `expr` becomes its
 * result, and `name = expr` defines a variable for later lines (the line itself is kept).
 */
export function evaluateSelection(text: string): SelectionResult {
	const vars: Record<string, number> = {};
	// A holder object, because TS doesn't see a plain `let` being assigned inside the callbacks.
	const state: { last?: number } = {};
	const multiLine = text.trim().includes('\n');

	const run = (expr: string, column: number, line: number): number => {
		try {
			const value = evaluate(expr, vars);
			state.last = value;
			return value;
		} catch (err) {
			if (!(err instanceof MathError)) throw err;
			// Re-anchor the position to the line, since the expression may sit after `name = `.
			const detail = multiLine ? `Line ${line}: ${err.detail}` : err.detail;
			throw new MathError(detail, column + err.index);
		}
	};

	const replaced = mapLines(text, (lines) =>
		lines.map((line, idx) => {
			const trimmed = line.trim();
			if (trimmed === '' || trimmed.startsWith('#')) return line;
			const assign = ASSIGN_RE.exec(line);
			if (assign) {
				const [, indent = '', name = '', eq = '', expr = ''] = assign;
				if (Object.hasOwn(FUNCTIONS, name)) {
					throw new Error(`Can't assign to '${name}': it's a built-in function`);
				}
				vars[name] = run(expr, indent.length + name.length + eq.length, idx + 1);
				return line;
			}
			const trailing = TRAILING_EQ_RE.exec(line);
			if (trailing) {
				const [, indent = '', expr = ''] = trailing;
				return `${indent}${expr} = ${formatNumber(run(expr, indent.length, idx + 1), false)}`;
			}
			const indent = line.length - line.trimStart().length;
			return line.slice(0, indent) + formatNumber(run(trimmed, indent, idx + 1), false);
		}),
	);

	if (state.last === undefined) throw new Error('Nothing to evaluate');
	return { result: formatNumber(state.last), replaced };
}
