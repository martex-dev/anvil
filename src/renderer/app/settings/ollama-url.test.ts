import { describe, expect, it } from 'vitest';

import { withOllamaScheme } from './ollama-url';

describe('withOllamaScheme', () => {
	it('adds http:// to a bare host and port', () => {
		expect(withOllamaScheme(' localhost:11434 ')).toBe('http://localhost:11434');
		expect(withOllamaScheme('192.168.1.5:11434')).toBe('http://192.168.1.5:11434');
	});

	it('keeps an explicit scheme, so a wrong one is still reported', () => {
		expect(withOllamaScheme('https://ollama.lan')).toBe('https://ollama.lan');
		expect(withOllamaScheme('ftp://ollama.lan')).toBe('ftp://ollama.lan');
	});

	it('leaves an empty box empty', () => {
		expect(withOllamaScheme('  ')).toBe('');
	});
});
