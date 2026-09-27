import { describe, expect, it } from 'vitest';

import { describeLanguage, serversFor } from './lsp-status';

describe('describeLanguage', () => {
	it('names the state in words, not only a colour', () => {
		expect(describeLanguage('python', { state: 'ready', message: null })).toBe(
			'Python language server ready',
		);
		expect(describeLanguage('typescript', { state: 'starting', message: null })).toBe(
			'TS/JS language server starting',
		);
	});

	it('includes the failure reason', () => {
		expect(
			describeLanguage('python', { state: 'error', message: 'basedpyright not found' }),
		).toBe('Python language server failed: basedpyright not found');
	});
});

describe('serversFor', () => {
	it('maps Monaco language ids to servers', () => {
		expect(serversFor('python')).toEqual(['python', 'ruff']);
		expect(serversFor('typescriptreact')).toEqual(['typescript']);
		expect(serversFor('markdown')).toEqual([]);
	});
});
