import { describe, expect, it } from 'vitest';

import { expressionAt } from './hover-expression';

describe('expressionAt', () => {
	const line = '    loss = self.model.weights.sum() + x_2[0]';
	const col = (text: string, offset = 0): number => line.indexOf(text) + 1 + offset;

	it('takes the attribute chain up to the hovered name', () => {
		expect(expressionAt(line, col('self'))).toBe('self');
		expect(expressionAt(line, col('model', 2))).toBe('self.model');
		expect(expressionAt(line, col('weights'))).toBe('self.model.weights');
		expect(expressionAt(line, col('x_2', 1))).toBe('x_2');
	});

	it('stops at calls, subscripts and non-names', () => {
		expect(expressionAt(line, col('sum'))).toBe('self.model.weights.sum');
		expect(expressionAt(line, col('0'))).toBeNull();
		expect(expressionAt(line, col('='))).toBeNull();
		expect(expressionAt('a = 12.5', 6)).toBeNull();
	});
});
