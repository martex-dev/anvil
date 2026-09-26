import { describe, expect, it } from 'vitest';

import { buildCsp } from './csp';

describe('buildCsp', () => {
	it('production forbids inline scripts and remote connections', () => {
		const csp = buildCsp('production');
		// Only WebAssembly compilation is allowed; no inline scripts and no JS eval.
		expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval';");
		expect(csp).not.toContain("'unsafe-eval'");
		expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
		expect(csp).toContain("connect-src 'self';");
		expect(csp).toContain("object-src 'none'");
	});

	it('development only relaxes for localhost HMR', () => {
		const csp = buildCsp('development');
		expect(csp).toContain('ws://localhost:*');
		expect(csp).not.toMatch(/connect-src[^;]*https:/);
	});
});
