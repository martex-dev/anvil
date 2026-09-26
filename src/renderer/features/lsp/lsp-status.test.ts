import { describe, expect, it } from 'vitest';

import { describeLanguage, serverFor } from './lsp-status';

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

describe('serverFor', () => {
	it('maps Monaco language ids to servers', () => {
		expect(serverFor('python')).toBe('python');
		expect(serverFor('typescriptreact')).toBe('typescript');
		expect(serverFor('markdown')).toBeNull();
	});
});
