import { describe, expect, it } from 'vitest';

import { filterVariables, inspectExpression } from './variables';

const v = (name: string, type: string, value = ''): ReturnType<typeof filterVariables>[number] => ({
	name,
	type,
	size: '',
	value,
});

describe('filterVariables', () => {
	const vars = [
		v('prices', 'pandas.DataFrame'),
		v('alpha', 'float', '0.05'),
		v('n', 'int', '10'),
	];

	it('keeps everything for an empty filter', () => {
		expect(filterVariables(vars, '  ')).toHaveLength(3);
	});

	it('matches name, type and value, ignoring case', () => {
		expect(filterVariables(vars, 'PRICE').map((x) => x.name)).toEqual(['prices']);
		expect(filterVariables(vars, 'float').map((x) => x.name)).toEqual(['alpha']);
		expect(filterVariables(vars, '0.05').map((x) => x.name)).toEqual(['alpha']);
	});
});

describe('inspectExpression', () => {
	it('shows the first rows of a table and the value of anything else', () => {
		expect(inspectExpression(v('prices', 'pandas.DataFrame'))).toBe('prices.head(20)');
		expect(inspectExpression(v('df', 'polars.DataFrame'))).toBe('df.head(20)');
		expect(inspectExpression(v('n', 'int'))).toBe('n');
	});
});
