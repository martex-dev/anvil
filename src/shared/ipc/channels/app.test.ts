import { describe, expect, it } from 'vitest';

import { appChannels } from './app';

const openExternal = appChannels['app:openExternal'].input;

describe('app:openExternal input', () => {
	it('accepts https links and local notebook or dashboard servers', () => {
		expect(openExternal.safeParse('https://github.com/marto').success).toBe(true);
		expect(openExternal.safeParse('http://127.0.0.1:8050/').success).toBe(true);
		expect(openExternal.safeParse('http://localhost:8888/lab').success).toBe(true);
	});

	it('refuses plain http to other hosts and other schemes', () => {
		expect(openExternal.safeParse('http://example.com').success).toBe(false);
		expect(openExternal.safeParse('file:///C:/Windows/System32/calc.exe').success).toBe(false);
		expect(openExternal.safeParse('javascript:alert(1)').success).toBe(false);
	});
});
