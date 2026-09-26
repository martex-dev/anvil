import type { AiProvider } from '@shared/ipc/channels/ai';

import { AnvilError } from '../../core/errors';
import { obj, type ProviderRequest } from './providers';

export interface CompletionInput {
	path: string;
	language: string;
	prefix: string;
	suffix: string;
}

const SYSTEM = `You are a code completion engine inside a code editor. The user message is a file with a <CURSOR/> marker.
Reply with only the text to insert at <CURSOR/>, wrapped in <completion></completion>.
Rules: continue naturally from the text right before the cursor; never repeat text that is already before or after the cursor; finish the current statement or small block (at most about 8 lines); match the file's indentation and style. If nothing useful fits, reply <completion></completion>.`;

const OPEN = '<completion>';
const CLOSE = '</completion>';
const MAX_TOKENS = 200;
/** Reasoning models spend part of max_completion_tokens thinking before they answer. */
const REASONING_MAX_TOKENS = 1_000;

/**
 * The lowest reasoning effort an OpenAI reasoning model accepts, or null for a plain model.
 * Without it, reasoning can eat the whole budget and the reply comes back empty.
 */
export function completionReasoningEffort(model: string): 'minimal' | 'low' | null {
	// gpt-5 / -mini / -nano (optionally dated) accept 'minimal'; gpt-5-chat is not a reasoner.
	if (/^gpt-5(?:-mini|-nano)?(?:-\d{4}-\d{2}-\d{2})?$/.test(model)) return 'minimal';
	if (/^o\d/.test(model)) return 'low';
	return null;
}

function userMessage(input: CompletionInput): string {
	return `<file path="${input.path.replace(/"/g, "'")}" language="${input.language}">\n${input.prefix}<CURSOR/>${input.suffix}\n</file>`;
}

/** A one-shot (non-streaming) request: ghost text is short and must arrive in one piece. */
export function buildCompletionRequest(
	provider: AiProvider,
	model: string,
	key: string,
	input: CompletionInput,
	ollamaUrl: string,
): ProviderRequest {
	switch (provider) {
		case 'anthropic':
			return {
				url: 'https://api.anthropic.com/v1/messages',
				headers: {
					'x-api-key': key,
					'anthropic-version': '2023-06-01',
					'content-type': 'application/json',
				},
				body: {
					model,
					max_tokens: MAX_TOKENS,
					system: SYSTEM,
					messages: [{ role: 'user', content: userMessage(input) }],
					stop_sequences: [CLOSE],
				},
			};
		case 'openai': {
			const effort = completionReasoningEffort(model);
			return {
				url: 'https://api.openai.com/v1/chat/completions',
				headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
				body: {
					model,
					max_completion_tokens: effort ? REASONING_MAX_TOKENS : MAX_TOKENS,
					...(effort ? { reasoning_effort: effort } : {}),
					messages: [
						{ role: 'system', content: SYSTEM },
						{ role: 'user', content: userMessage(input) },
					],
				},
			};
		}
		case 'gemini':
			return {
				url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
				headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
				body: {
					systemInstruction: { parts: [{ text: SYSTEM }] },
					contents: [{ role: 'user', parts: [{ text: userMessage(input) }] }],
					generationConfig: { maxOutputTokens: MAX_TOKENS, stopSequences: [CLOSE] },
				},
			};
		case 'ollama':
			// Ollama's native endpoint does real fill-in-the-middle for coder models (suffix).
			return {
				url: `${ollamaUrl.replace(/\/+$/, '')}/api/generate`,
				headers: { 'content-type': 'application/json' },
				body: {
					model,
					prompt: input.prefix,
					suffix: input.suffix,
					stream: false,
					options: { num_predict: 128, temperature: 0.1 },
				},
			};
	}
}

/** Pulls the inserted text out of a provider's response body. */
export function parseCompletion(provider: AiProvider, json: unknown): string {
	const body = obj(json);
	let raw = '';
	switch (provider) {
		case 'anthropic':
			raw = ((body['content'] as unknown[] | undefined) ?? [])
				.map((b) => (obj(b)['type'] === 'text' ? String(obj(b)['text'] ?? '') : ''))
				.join('');
			break;
		case 'openai': {
			const choice = obj((body['choices'] as unknown[] | undefined)?.[0]);
			raw = String(obj(choice['message'])['content'] ?? '');
			if (!raw && choice['finish_reason'] === 'length') {
				throw new AnvilError(
					'AI_COMPLETE_EMPTY',
					'The autocomplete model used its whole token budget without answering (a reasoning model?). Pick a faster model in Settings → AI.',
				);
			}
			break;
		}
		case 'gemini': {
			const candidate = obj((body['candidates'] as unknown[] | undefined)?.[0]);
			raw = ((obj(candidate['content'])['parts'] as unknown[] | undefined) ?? [])
				.map((p) => String(obj(p)['text'] ?? ''))
				.join('');
			break;
		}
		case 'ollama':
			return String(body['response'] ?? '');
	}
	return extractCompletion(raw);
}

export function extractCompletion(raw: string): string {
	const start = raw.indexOf(OPEN);
	if (start === -1) return '';
	const rest = raw.slice(start + OPEN.length);
	const end = rest.indexOf(CLOSE);
	const text = end === -1 ? rest : rest.slice(0, end);
	// A model that wraps its answer in a fence would insert the backticks too.
	return text.replace(/^```[\w-]*\n/, '').replace(/\n?```\s*$/, '');
}
