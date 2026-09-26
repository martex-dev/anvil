import { describe, expect, it } from 'vitest';

import { baseName, dirName, formatBytes, resolveRelative, resolveWikilink } from './viewer-paths';

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

describe('resolveWikilink', () => {
	const files = [
		'README.md',
		'notes/Idea.md',
		'notes/daily/2024-01-01.md',
		'Projects/Anvil.md',
		'archive/Projects/Anvil.md',
		'img/chart.png',
	];

	it('prefers a note next to the document, then the root', () => {
		expect(resolveWikilink('notes/daily/2024-01-01.md', 'Idea', files)).toBe('notes/Idea.md');
		expect(resolveWikilink('notes/Idea.md', 'Projects/Anvil', files)).toBe('Projects/Anvil.md');
		expect(resolveWikilink('notes/Idea.md', 'readme', files)).toBe('README.md');
	});

	it('finds a note by unique name anywhere, and files with an extension as-is', () => {
		expect(resolveWikilink('README.md', '2024-01-01', files)).toBe('notes/daily/2024-01-01.md');
		expect(resolveWikilink('README.md', 'chart.png', files)).toBe('img/chart.png');
	});

	it('returns null for missing notes and same-document headings', () => {
		expect(resolveWikilink('README.md', 'Nope', files)).toBeNull();
		expect(resolveWikilink('README.md', '#Heading', files)).toBeNull();
		expect(resolveWikilink('README.md', '  ', files)).toBeNull();
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
