import { describe, expect, it } from 'vitest';

import { baseName, dirName, formatBytes, resolveRelative } from './viewer-paths';

describe('paths', () => {
	it('splits workspace-relative paths', () => {
		expect(baseName('a/b/c.md')).toBe('c.md');
		expect(baseName('c.md')).toBe('c.md');
		expect(dirName('a/b/c.md')).toBe('a/b');
		expect(dirName('c.md')).toBe('');
	});

	it('resolves relative links against the document folder', () => {
		expect(resolveRelative('docs/guide/intro.md', 'setup.md')).toBe('docs/guide/setup.md');
		expect(resolveRelative('docs/guide/intro.md', '../api/x%20y.md#top')).toBe(
			'docs/api/x y.md',
		);
		expect(resolveRelative('docs/intro.md', './img/plot.png')).toBe('docs/img/plot.png');
		expect(resolveRelative('docs/intro.md', '/README.md')).toBe('README.md');
	});

	it('rejects schemes, anchors and escapes above the root', () => {
		expect(resolveRelative('a.md', 'https://x.io')).toBeNull();
		expect(resolveRelative('a.md', 'mailto:me@x.io')).toBeNull();
		expect(resolveRelative('a.md', '#section')).toBeNull();
		expect(resolveRelative('a.md', '../../etc/passwd')).toBeNull();
		expect(resolveRelative('a.md', '//host/share')).toBeNull();
	});
});

describe('formatBytes', () => {
	it('picks a readable unit', () => {
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(250 * 1024)).toBe('250 KB');
		expect(formatBytes(3.25 * 1024 * 1024)).toBe('3.3 MB');
		expect(formatBytes(-1)).toBe('—');
	});
});
