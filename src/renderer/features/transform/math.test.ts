import { describe, expect, it } from 'vitest';

import { evaluate, evaluateSelection, formatNumber, MathError } from './math';

describe('evaluate: numbers', () => {
	it.each([
		['42', 42],
		['3.25', 3.25],
		['.5', 0.5],
		['1e-3', 0.001],
		['2.5E2', 250],
		['1_000_000', 1_000_000],
		['0x1f', 31],
		['0b101', 5],
		['0o17', 15],
		['5%', 0.05],
		['200 * 5%', 10],
		['(5%)', 0.05],
		['25bps', 0.0025],
		['1.5k', 1500],
		['2m', 2_000_000],
		['3b', 3_000_000_000],
		['2M', 2_000_000],
	])('%s = %d', (expr, value) => {
		expect(evaluate(expr)).toBe(value);
	});

	it('keeps % as modulo when an operand follows', () => {
		expect(evaluate('10 % 3')).toBe(1);
		expect(evaluate('10%3')).toBe(1);
		expect(evaluate('10 % (4)')).toBe(2);
	});

	it('handles trader suffixes in arithmetic', () => {
		expect(evaluate('25bps * 1m')).toBe(2500);
	});
});

describe('evaluate: operators', () => {
	it.each([
		['2 + 3 * 4 ^ 2', 50],
		['2 ^ 3 ^ 2', 512],
		['2 ** 3 ** 2', 512],
		['-2 ** 2', -4],
		['(-2) ** 2', 4],
		['2 ** -1', 0.5],
		['-(3 - 5)', 2],
		['+4 - -2', 6],
		['7 // 2', 3],
		['-7 // 2', -4],
		['-7 % 3', 2],
		['7 % -3', -2],
		['10 / 4', 2.5],
		['2 * (3 + 4)', 14],
	])('%s = %d', (expr, value) => {
		expect(evaluate(expr)).toBe(value);
	});

	it('allows inf and nan results', () => {
		expect(evaluate('1 / 0')).toBe(Infinity);
		expect(evaluate('-1 / 0')).toBe(-Infinity);
		expect(evaluate('0 / 0')).toBeNaN();
		expect(evaluate('sqrt(-1)')).toBeNaN();
		expect(evaluate('inf')).toBe(Infinity);
	});
});

describe('evaluate: functions, constants and variables', () => {
	it.each([
		['sqrt(16)', 4],
		['abs(-3)', 3],
		['log(100, 10)', 2],
		['ln(e)', 1],
		['log10(1000)', 3],
		['log2(8)', 3],
		['exp(0)', 1],
		['sin(pi / 2)', 1],
		['cos(0)', 1],
		['tan(0)', 0],
		['floor(-2.5)', -3],
		['ceil(2.1)', 3],
		['round(3.14159, 2)', 3.14],
		['round(2.5)', 3],
		['round(-2.5)', -3],
		['round(1.005, 2)', 1.01],
		['round(1234, -2)', 1200],
		['min(3, 1, 2)', 1],
		['max(3, 1, 2)', 3],
		['mean(1, 2, 3)', 2],
		['tau / pi', 2],
	])('%s = %d', (expr, value) => {
		expect(evaluate(expr)).toBeCloseTo(value, 12);
	});

	it('std is the sample standard deviation', () => {
		expect(evaluate('std(2, 4, 4, 4, 5, 5, 7, 9)')).toBeCloseTo(2.138089935299395, 12);
	});

	it('reads variables, which shadow constants', () => {
		expect(evaluate('x * 2', { x: 21 })).toBe(42);
		expect(evaluate('e + 1', { e: 1 })).toBe(2);
	});
});

describe('evaluate: errors', () => {
	it.each([
		['2 +', 'Unexpected end of expression at position 4'],
		['2 * (3 + 4', "Expected ')' but found end of expression at position 11"],
		['foo + 1', "Unknown name 'foo' at position 1"],
		['2 $ 3', "Unexpected character '$' at position 3"],
		['1 2', 'Unexpected number 2 at position 3'],
		['2 + )', "Unexpected ')' at position 5"],
		['sqrt(1, 2)', 'sqrt() takes 1 argument, got 2 at position 1'],
		['std(1)', 'std() takes at least 2 arguments, got 1 at position 1'],
		['round(1, 0.5)', 'round() digits must be an integer at position 1'],
		['1 + sqrt', "'sqrt' is a function; call it like sqrt(x) at position 5"],
		['nope(1)', "Unknown function 'nope' at position 1"],
		['2max', "Unexpected 'max' after number at position 2"],
		['2constructor', "Unexpected 'constructor' after number at position 2"],
	])('%s', (expr, message) => {
		expect(() => evaluate(expr)).toThrow(message);
	});

	it('exposes the 0-based index on MathError', () => {
		try {
			evaluate('1 + @');
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(MathError);
			expect(err instanceof MathError && err.index).toBe(4);
		}
	});

	it('rejects empty input', () => {
		expect(() => evaluate('   ')).toThrow('Empty expression');
	});
});

describe('formatNumber', () => {
	it.each([
		[0.1 + 0.2, '0.3'],
		[2500, '2500'],
		[10000, '10,000'],
		[1234567, '1,234,567'],
		[1234567.891, '1,234,567.891'],
		[1 / 3, '0.3333333333'],
		[-42.5, '-42.5'],
		[-0, '0'],
		[1e-7, '1e-7'],
		[1.5e21, '1.5e+21'],
		[NaN, 'nan'],
		[Infinity, 'inf'],
		[-Infinity, '-inf'],
	])('%d → %s', (n, text) => {
		expect(formatNumber(n)).toBe(text);
	});
});

describe('evaluateSelection', () => {
	it('replaces a bare expression with its result', () => {
		expect(evaluateSelection('3 * 4')).toEqual({ result: '12', replaced: '12' });
		expect(evaluateSelection('  0.1 + 0.2\n')).toEqual({ result: '0.3', replaced: '  0.3\n' });
	});

	it('appends the result to `expr =`', () => {
		expect(evaluateSelection('2 + 2 =').replaced).toBe('2 + 2 = 4');
		expect(evaluateSelection('2+2=').replaced).toBe('2+2 = 4');
	});

	it('supports assignments across lines and keeps CRLF', () => {
		const text = 'price = 1.5k\r\nqty = 20\r\n\r\nprice * qty =\r\n';
		expect(evaluateSelection(text)).toEqual({
			result: '30,000',
			replaced: 'price = 1.5k\r\nqty = 20\r\n\r\nprice * qty = 30000\r\n',
		});
	});

	it('skips comment lines', () => {
		expect(evaluateSelection('# notional\n2 * 3').replaced).toBe('# notional\n6');
	});

	it('keeps trailing comments out of the math', () => {
		expect(evaluateSelection('fee = 25  # maker\nfee * 2 =  # total').replaced).toBe(
			'fee = 25  # maker\nfee * 2 = 50  # total',
		);
		expect(evaluateSelection('  3 * 4 # dozen').replaced).toBe('  12 # dozen');
		expect(evaluateSelection('2+2#x').replaced).toBe('4#x');
	});

	it('reports errors with line and position', () => {
		expect(() => evaluateSelection('x = 1\ny + 1')).toThrow(
			"Line 2: Unknown name 'y' at position 1",
		);
		expect(() => evaluateSelection('a = 2 +')).toThrow(
			'Unexpected end of expression at position 8',
		);
		expect(() => evaluateSelection('sqrt = 4')).toThrow("Can't assign to 'sqrt'");
		expect(() => evaluateSelection('\n  \n')).toThrow('Nothing to evaluate');
	});
});
