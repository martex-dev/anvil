/** Built-in functions and constants for the calculator. Names follow Python's math module. */

export interface MathFunction {
	min: number;
	max: number;
	run(args: readonly number[]): number;
}

function unary(fn: (x: number) => number): MathFunction {
	return { min: 1, max: 1, run: (args) => fn(args[0] ?? NaN) };
}

function variadic(min: number, fn: (xs: readonly number[]) => number): MathFunction {
	return { min, max: Infinity, run: fn };
}

function mean(xs: readonly number[]): number {
	return xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

/** Round half away from zero; the epsilon nudge makes round(1.005, 2) give 1.01, not 1.0. */
export function roundTo(x: number, digits: number): number {
	// Beyond ~15 digits a double has nothing left to round, and 10 ** digits would overflow.
	if (!Number.isFinite(x) || digits > 15) return x;
	const factor = 10 ** digits;
	const rounded = Math.round(Math.abs(x) * factor * (1 + Number.EPSILON)) / factor;
	return Math.sign(x) * rounded;
}

export const FUNCTIONS: Readonly<Record<string, MathFunction>> = {
	sqrt: unary(Math.sqrt),
	abs: unary(Math.abs),
	// Python semantics: log(x) is natural, log(x, base) is any base.
	log: {
		min: 1,
		max: 2,
		run: ([x = NaN, base]) => (base === undefined ? Math.log(x) : Math.log(x) / Math.log(base)),
	},
	ln: unary(Math.log),
	log10: unary(Math.log10),
	log2: unary(Math.log2),
	exp: unary(Math.exp),
	sin: unary(Math.sin),
	cos: unary(Math.cos),
	tan: unary(Math.tan),
	floor: unary(Math.floor),
	ceil: unary(Math.ceil),
	round: {
		min: 1,
		max: 2,
		run: ([x = NaN, digits = 0]) => {
			if (!Number.isInteger(digits)) throw new Error('round() digits must be an integer');
			return roundTo(x, digits);
		},
	},
	min: variadic(1, (xs) => Math.min(...xs)),
	max: variadic(1, (xs) => Math.max(...xs)),
	mean: variadic(1, mean),
	// Sample standard deviation (n - 1), matching Python's statistics.stdev and pandas' default.
	std: variadic(2, (xs) => {
		const m = mean(xs);
		const sq = xs.reduce((sum, x) => sum + (x - m) ** 2, 0);
		return Math.sqrt(sq / (xs.length - 1));
	}),
};

export const CONSTANTS: Readonly<Record<string, number>> = {
	pi: Math.PI,
	e: Math.E,
	tau: 2 * Math.PI,
	// So formatted results ('inf', 'nan') can be fed back in.
	inf: Infinity,
	nan: NaN,
};

export function arityText(fn: MathFunction): string {
	if (fn.max === Infinity) return `at least ${fn.min} argument${fn.min === 1 ? '' : 's'}`;
	if (fn.min === fn.max) return `${fn.min} argument${fn.min === 1 ? '' : 's'}`;
	return `${fn.min} to ${fn.max} arguments`;
}
