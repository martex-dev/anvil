import { describe, expect, it } from 'vitest';

import { psQuote, shellWord, shQuote } from './shell-quote';

describe('shell quoting', () => {
	it('quotes for PowerShell and POSIX shells', () => {
		expect(psQuote("C:\\it's here\\a.py")).toBe("'C:\\it''s here\\a.py'");
		expect(shQuote("/home/john's project/a.py")).toBe("'/home/john'\\''s project/a.py'");
	});

	it('leaves plain words alone and quotes the rest', () => {
		expect(shellWord('build:prod', true)).toBe('build:prod');
		expect(shellWord('@scope;rm', true)).toBe("'@scope;rm'");
		expect(shellWord("it's", false)).toBe("'it'\\''s'");
	});
});
