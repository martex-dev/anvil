import { create } from 'zustand';

import type { LspLanguage } from '@shared/ipc/channels/lsp';

export type LspState = 'idle' | 'starting' | 'ready' | 'error';

export interface LanguageStatus {
	state: LspState;
	message: string | null;
}

export const LANGUAGE_LABEL: Record<LspLanguage, string> = {
	python: 'Python',
	typescript: 'TS/JS',
};

export const useLspStatus = create<{
	status: Record<LspLanguage, LanguageStatus>;
	set: (language: LspLanguage, state: LspState, message?: string | null) => void;
	reset: () => void;
}>((set) => ({
	status: {
		python: { state: 'idle', message: null },
		typescript: { state: 'idle', message: null },
	},
	set: (language, state, message = null) =>
		set((s) => ({ status: { ...s.status, [language]: { state, message } } })),
	reset: () =>
		set({
			status: {
				python: { state: 'idle', message: null },
				typescript: { state: 'idle', message: null },
			},
		}),
}));

/** Monaco language id → the server that handles it. */
export function serverFor(languageId: string): LspLanguage | null {
	if (languageId === 'python') return 'python';
	if (/^(typescript|javascript)(react)?$/.test(languageId)) return 'typescript';
	return null;
}

const STATE_LABEL: Record<LspState, string> = {
	idle: 'stopped',
	starting: 'starting',
	ready: 'ready',
	error: 'failed',
};

/** One language's state in words, with the failure reason when there is one. */
export function describeLanguage(language: LspLanguage, status: LanguageStatus): string {
	const base = `${LANGUAGE_LABEL[language]} language server ${STATE_LABEL[status.state]}`;
	return status.message ? `${base}: ${status.message}` : base;
}
