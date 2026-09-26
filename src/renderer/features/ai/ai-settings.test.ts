import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/ipc', () => ({ call: vi.fn() }));
vi.mock('../../ui/QuickPick', () => ({ quickPick: vi.fn() }));

import { parseOllamaUrl } from './ai-settings';

describe('parseOllamaUrl', () => {
	it('accepts http(s) URLs, trimmed', () => {
		expect(parseOllamaUrl('  http://127.0.0.1:11434 ')).toBe('http://127.0.0.1:11434');
		expect(parseOllamaUrl('https://ollama.lan')).toBe('https://ollama.lan');
	});

	it('rejects typos and other schemes', () => {
		expect(parseOllamaUrl('127.0.0.1:11434')).toBeNull();
		expect(parseOllamaUrl('htp//localhost')).toBeNull();
		expect(parseOllamaUrl('file:///C:/ollama')).toBeNull();
		expect(parseOllamaUrl('')).toBeNull();
	});
});
