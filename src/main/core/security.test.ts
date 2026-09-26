import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: {}, session: {}, shell: {} }));
vi.mock('electron-log/main', () => ({ default: { warn: vi.fn() } }));

const { isSafeExternalUrl } = await import('./security');

describe('isSafeExternalUrl', () => {
	it.each([
		['https://github.com/marto', true],
		['https://www.tradingview.com/chart/', true],
		['http://example.com', false],
		['file:///C:/Windows/System32/calc.exe', false],
		['javascript:alert(1)', false],
		['ms-settings:privacy', false],
		['https://user:pass@example.com', false],
		['not a url', false],
	])('%s → %s', (url, expected) => {
		expect(isSafeExternalUrl(url)).toBe(expected);
	});
});
