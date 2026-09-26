import { describe, expect, it, vi } from 'vitest';

const openExternal = vi.hoisted(() => vi.fn<(url: string) => Promise<void>>());
vi.mock('electron', () => ({ app: {}, session: {}, shell: { openExternal } }));
vi.mock('electron-log/main', () => ({ default: { warn: vi.fn() } }));

const { isSafeExternalUrl, openExternalSafely } = await import('./security');

describe('isSafeExternalUrl', () => {
	it.each([
		['https://github.com/marto', true],
		['https://www.tradingview.com/chart/', true],
		['http://example.com', false],
		['http://127.0.0.1:8050/', true],
		['http://localhost:8888/lab?token=abc', true],
		['http://[::1]:8501', true],
		['http://localhost.example.com', false],
		['http://user:pass@localhost:8888', false],
		['file:///C:/Windows/System32/calc.exe', false],
		['javascript:alert(1)', false],
		['ms-settings:privacy', false],
		['https://user:pass@example.com', false],
		['not a url', false],
	])('%s → %s', (url, expected) => {
		expect(isSafeExternalUrl(url)).toBe(expected);
	});
});

describe('openExternalSafely', () => {
	it('refuses unsafe links without launching anything', async () => {
		openExternal.mockClear();
		await expect(openExternalSafely('file:///C:/x.exe')).rejects.toMatchObject({
			code: 'URL_REFUSED',
		});
		expect(openExternal).not.toHaveBeenCalled();
	});

	it('reports a failed launch instead of resolving', async () => {
		openExternal.mockRejectedValueOnce(new Error('no browser'));
		await expect(openExternalSafely('https://example.com')).rejects.toMatchObject({
			code: 'OPEN_EXTERNAL_FAILED',
		});
	});

	it('resolves once the browser was launched', async () => {
		openExternal.mockResolvedValueOnce(undefined);
		await expect(openExternalSafely('https://example.com')).resolves.toBeUndefined();
	});
});
