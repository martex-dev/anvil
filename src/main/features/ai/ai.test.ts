import { describe, expect, it } from 'vitest';

import {
	buildCompletionRequest,
	completionReasoningEffort,
	extractCompletion,
	parseCompletion,
} from './completion';
import { buildSystem } from './prompt';
import { buildRequest, parseEvent, supportsFallback } from './providers';
import { SseParser } from './sse';

describe('SseParser', () => {
	it('handles arbitrary chunking, CRLF, comments and multi-line data', () => {
		const text =
			': keep-alive\r\nevent: content_block_delta\r\ndata: {"a":1}\r\n\r\ndata: line1\ndata: line2\n\n';
		for (const size of [1, 5, text.length]) {
			const parser = new SseParser();
			const events = [];
			for (let i = 0; i < text.length; i += size)
				events.push(...parser.push(text.slice(i, i + size)));
			expect(events).toEqual([
				{ event: 'content_block_delta', data: '{"a":1}' },
				{ event: null, data: 'line1\nline2' },
			]);
		}
	});
});

describe('providers', () => {
	const messages = [{ role: 'user' as const, content: 'hi' }];

	it('builds each provider request with the key in a header, never the URL', () => {
		const a = buildRequest('anthropic', 'claude-opus-5', 'sk-a', 'SYS', messages);
		expect(a.headers['x-api-key']).toBe('sk-a');
		expect(a.body).toMatchObject({
			model: 'claude-opus-5',
			system: 'SYS',
			stream: true,
			cache_control: { type: 'ephemeral' },
			fallbacks: 'default',
		});
		expect(a.headers['anthropic-beta']).toBe('server-side-fallback-2026-07-01');
		const o = buildRequest('openai', 'gpt-5', 'sk-o', 'SYS', messages);
		expect(o.headers['authorization']).toBe('Bearer sk-o');
		expect((o.body as { messages: unknown[] }).messages[0]).toEqual({
			role: 'system',
			content: 'SYS',
		});
		const g = buildRequest('gemini', 'gemini-2.5-pro', 'k-g', 'SYS', [
			...messages,
			{ role: 'assistant', content: 'yo' },
		]);
		expect(g.url).not.toContain('k-g');
		expect(g.headers['x-goog-api-key']).toBe('k-g');
		expect(
			(g.body as { contents: Array<{ role: string }> }).contents.map((c) => c.role),
		).toEqual(['user', 'model']);
	});

	it('only asks for refusal fallbacks on models that support them', () => {
		expect(supportsFallback('claude-opus-5')).toBe(true);
		expect(supportsFallback('claude-fable-5-1')).toBe(true);
		expect(supportsFallback('claude-haiku-4-5')).toBe(false);
		const h = buildRequest('anthropic', 'claude-haiku-4-5', 'k', 'S', messages);
		expect(h.headers['anthropic-beta']).toBeUndefined();
		expect(h.body).not.toHaveProperty('fallbacks');
	});

	it('talks to a local Ollama without auth', () => {
		const r = buildRequest(
			'ollama',
			'qwen2.5-coder',
			'',
			'S',
			messages,
			'http://localhost:11434/',
		);
		expect(r.url).toBe('http://localhost:11434/v1/chat/completions');
		expect(r.headers['authorization']).toBeUndefined();
	});

	it('parses streaming events for each provider', () => {
		expect(
			parseEvent('anthropic', {
				event: 'content_block_delta',
				data: '{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hel"}}',
			}),
		).toEqual({ text: 'Hel' });
		expect(parseEvent('anthropic', { event: null, data: '{"type":"message_stop"}' })).toEqual({
			done: true,
		});
		expect(
			parseEvent('anthropic', {
				event: null,
				data: '{"type":"message_start","message":{"usage":{"input_tokens":10,"cache_read_input_tokens":90}}}',
			}),
		).toEqual({ inputTokens: 100 });
		expect(
			parseEvent('anthropic', {
				event: null,
				data: '{"type":"message_delta","delta":{"stop_reason":"refusal"}}',
			}).error,
		).toMatch(/declined/);
		expect(
			parseEvent('anthropic', {
				event: 'error',
				data: '{"type":"error","error":{"message":"overloaded"}}',
			}),
		).toEqual({ error: 'overloaded' });
		expect(
			parseEvent('openai', { event: null, data: '{"choices":[{"delta":{"content":"lo"}}]}' }),
		).toEqual({ text: 'lo' });
		expect(parseEvent('ollama', { event: null, data: '[DONE]' })).toEqual({ done: true });
		expect(
			parseEvent('gemini', {
				event: null,
				data: '{"candidates":[{"content":{"parts":[{"text":"a"},{"text":"b"}]}}],"usageMetadata":{"promptTokenCount":5,"candidatesTokenCount":2}}',
			}),
		).toEqual({ text: 'ab', inputTokens: 5, outputTokens: 2 });
	});
});

describe('completion', () => {
	const input = { path: 'a.py', language: 'python', prefix: 'def f(x):\n    ', suffix: '\n' };

	it('marks the cursor and stops at the closing tag', () => {
		const r = buildCompletionRequest('anthropic', 'claude-haiku-4-5', 'k', input, '');
		const body = r.body as { messages: Array<{ content: string }>; stop_sequences: string[] };
		expect(body.messages[0]?.content).toContain('def f(x):\n    <CURSOR/>\n');
		expect(body.stop_sequences).toEqual(['</completion>']);
	});

	it('uses fill-in-the-middle on Ollama', () => {
		const r = buildCompletionRequest('ollama', 'qwen2.5-coder', '', input, 'http://h:1');
		expect(r.url).toBe('http://h:1/api/generate');
		expect(r.body).toMatchObject({ prompt: input.prefix, suffix: input.suffix });
		expect(parseCompletion('ollama', { response: 'return x' })).toBe('return x');
	});

	it('keeps reasoning to a minimum on OpenAI reasoning models', () => {
		expect(completionReasoningEffort('gpt-5-mini')).toBe('minimal');
		expect(completionReasoningEffort('gpt-5-2025-08-07')).toBe('minimal');
		expect(completionReasoningEffort('o4-mini')).toBe('low');
		expect(completionReasoningEffort('gpt-5-chat-latest')).toBeNull();
		expect(completionReasoningEffort('gpt-4.1-mini')).toBeNull();
		const r = buildCompletionRequest('openai', 'gpt-5-mini', 'k', input, '');
		expect(r.body).toMatchObject({ reasoning_effort: 'minimal' });
		const plain = buildCompletionRequest('openai', 'gpt-4.1-mini', 'k', input, '');
		expect(plain.body).not.toHaveProperty('reasoning_effort');
		expect(plain.body).toMatchObject({ max_completion_tokens: 200 });
	});

	it('explains an empty reply that ran out of tokens', () => {
		const truncated = {
			choices: [{ message: { content: '' }, finish_reason: 'length' }],
		};
		expect(() => parseCompletion('openai', truncated)).toThrow(/token budget/);
		const nothing = { choices: [{ message: { content: '' }, finish_reason: 'stop' }] };
		expect(parseCompletion('openai', nothing)).toBe('');
	});

	it('extracts the completion and strips stray fences', () => {
		expect(extractCompletion('<completion>return x * 2')).toBe('return x * 2');
		expect(extractCompletion('sure <completion>```python\nreturn 1\n```</completion>')).toBe(
			'return 1',
		);
		expect(extractCompletion('no tags')).toBe('');
		expect(
			parseCompletion('anthropic', {
				content: [{ type: 'text', text: '<completion>return x' }],
			}),
		).toBe('return x');
	});
});

describe('buildSystem', () => {
	it('embeds attached context with labels and fences', () => {
		const system = buildSystem([
			{ kind: 'selection', label: 'src/a.py:10-12', language: 'python', text: 'x = 1' },
			{ kind: 'diff', label: 'git diff', language: 'diff', text: '+y' },
		]);
		expect(system).toContain(
			'<context kind="selection" label="src/a.py:10-12">\n```python\nx = 1\n```\n</context>',
		);
		expect(system).toContain('```diff\n+y\n```');
	});

	it('switches instructions per mode', () => {
		expect(buildSystem([], 'edit')).toMatch(/ONLY the code that replaces/);
		expect(buildSystem([], 'commit')).toMatch(/Conventional Commits/);
	});
});
