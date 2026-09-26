import { describe, expect, it } from 'vitest';

import { applyBlock, splitFences } from './fences';

describe('splitFences', () => {
	it('separates prose and closed code blocks', () => {
		const segments = splitFences('Here:\n```python\nx = 1\n```\nDone.');
		expect(segments).toEqual([
			{ kind: 'md', text: 'Here:' },
			{ kind: 'code', lang: 'python', code: 'x = 1', closed: true },
			{ kind: 'md', text: 'Done.' },
		]);
	});

	it('treats a trailing unterminated fence as an in-progress block', () => {
		expect(splitFences('```ts\nconst a = 1;\nconst b')).toEqual([
			{ kind: 'code', lang: 'ts', code: 'const a = 1;\nconst b', closed: false },
		]);
	});

	it('keeps shorter fences inside longer ones', () => {
		const segments = splitFences('````md\n```js\ninner\n```\n````');
		expect(segments).toEqual([
			{ kind: 'code', lang: 'md', code: '```js\ninner\n```', closed: true },
		]);
	});
});

describe('applyBlock', () => {
	const file = 'a\nb\nc\nd\n';

	it('replaces the selected lines only', () => {
		expect(applyBlock(file, 'B1\nB2', { startLine: 2, endLine: 3 })).toBe('a\nB1\nB2\nd\n');
	});

	it('replaces the whole file, keeping a trailing newline', () => {
		expect(applyBlock(file, 'new', null)).toBe('new\n');
		expect(applyBlock('no-newline', 'new', null)).toBe('new');
	});
});
