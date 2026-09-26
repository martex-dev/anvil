import { describe, expect, it } from 'vitest';

import { escapeMarkdown } from './escape-markdown';

describe('escapeMarkdown', () => {
	it('escapes emphasis, code and link syntax', () => {
		expect(escapeMarkdown('fix __init__ and *args')).toBe('fix \\_\\_init\\_\\_ and \\*args');
		expect(escapeMarkdown('see [docs](x) `y`')).toBe('see \\[docs\\]\\(x\\) \\`y\\`');
	});

	it('leaves plain text alone', () => {
		expect(escapeMarkdown('Marto Nikolov')).toBe('Marto Nikolov');
	});
});
