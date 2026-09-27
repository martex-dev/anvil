import { create } from 'zustand';

import type { LspLanguage } from '@shared/ipc/channels/lsp';

/** 'unavailable': the server isn't installed (ruff), so its features are simply off. */
export type LspState = 'idle' | 'starting' | 'ready' | 'error' | 'unavailable';

export interface LanguageStatus {
	state: LspState;
	message: string | null;
}

export const LANGUAGE_LABEL: Record<LspLanguage, string> = {
	python: 'Python',
	ruff: 'Ruff',
	typescript: 'TS/JS',
};

export const useLspStatus = create<{
	status: Record<LspLanguage, LanguageStatus>;
	set: (language: LspLanguage, state: LspState, message?: string | null) => void;
	reset: () => void;
}>((set) => ({
	status: {
		python: { state: 'idle', message: null },
		ruff: { state: 'idle', message: null },
		typescript: { state: 'idle', message: null },
	},
	set: (language, state, message = null) =>
		set((s) => ({ status: { ...s.status, [language]: { state, message } } })),
	reset: () =>
		set({
			status: {
				python: { state: 'idle', message: null },
				ruff: { state: 'idle', message: null },
				typescript: { state: 'idle', message: null },
			},
		}),
}));

/** Monaco language id → the servers that handle it (Python: types and lint). */
export function serversFor(languageId: string): LspLanguage[] {
	if (languageId === 'python') return ['python', 'ruff'];
	if (/^(typescript|javascript)(react)?$/.test(languageId)) return ['typescript'];
	return [];
}

const STATE_LABEL: Record<LspState, string> = {
	idle: 'stopped',
	starting: 'starting',
	ready: 'ready',
	error: 'failed',
	unavailable: 'not installed',
};

/** One language's state in words, with the failure reason when there is one. */
export function describeLanguage(language: LspLanguage, status: LanguageStatus): string {
	const base = `${LANGUAGE_LABEL[language]} language server ${STATE_LABEL[status.state]}`;
	return status.message ? `${base}: ${status.message}` : base;
}
