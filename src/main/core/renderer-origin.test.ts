import { describe, expect, it } from 'vitest';

import { devRendererUrl, isTrustedRendererUrl } from './renderer-origin';

const env = { ELECTRON_RENDERER_URL: 'http://localhost:5173' };

describe('devRendererUrl', () => {
	it('is honoured only in unpackaged runs', () => {
		expect(devRendererUrl(false, env)).toBe('http://localhost:5173');
		expect(devRendererUrl(true, env)).toBeNull();
		expect(devRendererUrl(false, {})).toBeNull();
	});
});

describe('isTrustedRendererUrl', () => {
	it('trusts the packaged renderer', () => {
		expect(isTrustedRendererUrl('app://anvil/index.html', null)).toBe(true);
		expect(isTrustedRendererUrl('app://evil/index.html', null)).toBe(false);
	});

	it('trusts the dev server by exact origin, not by prefix', () => {
		const dev = 'http://localhost:5173';
		expect(isTrustedRendererUrl('http://localhost:5173/index.html', dev)).toBe(true);
		expect(isTrustedRendererUrl('http://localhost:51730/', dev)).toBe(false);
		expect(isTrustedRendererUrl('http://localhost:5173.evil.test/', dev)).toBe(false);
		expect(isTrustedRendererUrl('http://localhost:5173/', null)).toBe(false);
	});

	it('refuses anything else', () => {
		expect(isTrustedRendererUrl('https://example.com/', 'http://localhost:5173')).toBe(false);
		expect(isTrustedRendererUrl('not a url', null)).toBe(false);
		expect(isTrustedRendererUrl('file:///C:/app/index.html', null)).toBe(false);
	});
});
