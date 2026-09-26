import type * as Monaco from 'monaco-editor';

import type { AiSettings } from '@shared/ipc/channels/ai';

import { getSettings } from '../../app/hooks/use-settings';
import { call } from '../../lib/ipc';
import type { MonacoApi } from '../../lib/monaco/setup';
import { toWorkspacePath } from '../../lib/monaco/workspace-root';
import { queryClient } from '../../lib/query-client';
import { AI_SETTINGS_KEY } from './ai-settings';
import { useGhostStatus } from './ghost-status';

const PREFIX_CHARS = 6_000;
const SUFFIX_CHARS = 2_000;

/** Skip positions where a suggestion is noise: inside a word, or with code right after. */
export function shouldSuggest(lineBefore: string, lineAfter: string): boolean {
	if (/\w$/.test(lineBefore) && /^\w/.test(lineAfter)) return false;
	// Only closing brackets/quotes may follow the cursor on the same line.
	return /^[\s)\]}"'`;:,]*$/.test(lineAfter);
}

/** Drops the part of a suggestion that already exists right after the cursor. */
export function trimOverlap(text: string, after: string): string {
	const rest = after.split('\n')[0] ?? '';
	if (rest && text.endsWith(rest)) return text.slice(0, -rest.length);
	return text;
}

/**
 * Identifies a completion request for the one-entry cache: the same spot with the same code
 * around it, on the same model. Text after the cursor and the model both change the answer.
 */
export function ghostCacheKey(parts: {
	path: string;
	offset: number;
	prefix: string;
	suffix: string;
	model: string;
}): string {
	return [
		parts.model,
		parts.path,
		parts.offset,
		parts.prefix.slice(-200),
		parts.suffix.slice(0, 200),
	].join('\u0000');
}

const sleep = (ms: number, token: Monaco.CancellationToken): Promise<boolean> =>
	new Promise((resolve) => {
		const t = setTimeout(() => resolve(!token.isCancellationRequested), ms);
		token.onCancellationRequested(() => {
			clearTimeout(t);
			resolve(false);
		});
	});

/**
 * Copilot-style ghost text on the autocomplete model. Debounced per keystroke; an in-flight
 * request is cancelled the moment you type again, so you never pay for stale suggestions.
 */
export function registerGhostText(monaco: MonacoApi): Monaco.IDisposable {
	let last: { key: string; text: string } | null = null;
	return monaco.languages.registerInlineCompletionsProvider(
		{ pattern: '**' },
		{
			async provideInlineCompletions(model, position, _context, token) {
				const settings = getSettings();
				if (!settings.ghostText) return { items: [] };
				const path = toWorkspacePath(model.uri);
				if (!path || model.getValueLength() > 3_000_000) return { items: [] };
				const line = model.getLineContent(position.lineNumber);
				const before = line.slice(0, position.column - 1);
				const after = line.slice(position.column - 1);
				if (!shouldSuggest(before, after) || (!before.trim() && position.lineNumber === 1))
					return { items: [] };

				const offset = model.getOffsetAt(position);
				const full = model.getValue();
				const prefix = full.slice(Math.max(0, offset - PREFIX_CHARS), offset);
				const suffix = full.slice(offset, offset + SUFFIX_CHARS);
				const completion =
					queryClient.getQueryData<AiSettings>(AI_SETTINGS_KEY)?.completion;
				const key = ghostCacheKey({
					path,
					offset,
					prefix,
					suffix,
					model: completion ? `${completion.provider}|${completion.model}` : '',
				});
				const range = new monaco.Range(
					position.lineNumber,
					position.column,
					position.lineNumber,
					position.column,
				);
				// Monaco re-asks for the same spot (e.g. after a widget closes): answer from cache.
				if (last?.key === key)
					return { items: last.text ? [{ insertText: last.text, range }] : [] };

				if (!(await sleep(settings.ghostDelayMs, token))) return { items: [] };
				const requestId = crypto.randomUUID();
				const cancel = token.onCancellationRequested(
					() => void call('ai:cancel', requestId).catch(() => undefined),
				);
				useGhostStatus.getState().set({ busy: true });
				try {
					const { text } = await call('ai:complete', {
						requestId,
						path,
						language: model.getLanguageId(),
						prefix,
						suffix,
					});
					useGhostStatus.getState().set({ error: null });
					if (token.isCancellationRequested) return { items: [] };
					const insert = trimOverlap(text, suffix);
					last = { key, text: insert };
					return { items: insert.trim() ? [{ insertText: insert, range }] : [] };
				} catch (error) {
					useGhostStatus
						.getState()
						.set({ error: error instanceof Error ? error.message : String(error) });
					return { items: [] };
				} finally {
					cancel.dispose();
					useGhostStatus.getState().set({ busy: false });
				}
			},
			disposeInlineCompletions() {
				// Nothing held per suggestion.
			},
		},
	);
}
