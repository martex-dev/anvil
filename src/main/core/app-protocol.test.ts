import { join, sep } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ net: {}, protocol: {} }));

const { resolveAppPath } = await import('./app-protocol');

const root = join('C:', 'anvil', 'out', 'renderer');

describe('resolveAppPath', () => {
	it('maps app URLs to files in the renderer folder', () => {
		expect(resolveAppPath(root, 'app://anvil/')).toBe(join(root, 'index.html'));
		expect(resolveAppPath(root, 'app://anvil/assets/index-abc.js')).toBe(
			join(root, 'assets', 'index-abc.js'),
		);
		expect(resolveAppPath(root, 'app://anvil/assets/a%20b.css')).toBe(
			join(root, 'assets', 'a b.css'),
		);
	});

	// The URL parser already collapses these dot segments, so they can never climb out.
	it.each(['app://anvil/../main/index.js', 'app://anvil/%2e%2e/%2e%2e/secrets.json'])(
		'keeps %s inside the renderer folder',
		(url) => {
			expect(resolveAppPath(root, url)?.startsWith(root + sep)).toBe(true);
		},
	);

	// Encoded backslashes survive URL parsing and would escape without the guard.
	it.each(['app://anvil/..%5c..%5cmain%5cindex.js', 'app://other/index.html'])(
		'refuses %s',
		(url) => {
			expect(resolveAppPath(root, url)).toBeNull();
		},
	);
});
