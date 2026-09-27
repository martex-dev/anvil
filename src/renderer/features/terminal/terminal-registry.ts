import { create } from 'zustand';

/**
 * Live xterm instances by session id. Palette commands (Clear, Find) reach the mounted terminal
 * through here: the xterm object lives inside the pane's effect, not in React state.
 */
export interface TerminalApi {
	/** Clears the scrollback; the prompt line stays. */
	clear: () => void;
	/** Selects the next or previous match of `query`; false when there is none. */
	find: (query: string, direction: 'next' | 'previous', caseSensitive: boolean) => boolean;
	/** Drops the current match highlight. */
	clearFind: () => void;
	focus: () => void;
}

const live = new Map<string, TerminalApi>();

/** Registers a mounted terminal; the returned function unregisters exactly this one. */
export function registerTerminal(sessionId: string, api: TerminalApi): () => void {
	live.set(sessionId, api);
	return () => {
		if (live.get(sessionId) === api) live.delete(sessionId);
	};
}

export function terminalApi(sessionId: string | null): TerminalApi | undefined {
	return sessionId ? live.get(sessionId) : undefined;
}

/** Which terminal's find bar is open (one at a time, like the editor's). */
export const useTerminalFind = create<{ open: string | null }>(() => ({ open: null }));

export function openTerminalFind(sessionId: string): void {
	useTerminalFind.setState({ open: sessionId });
}

/** Closes the find bar and hands the keyboard back to that terminal. */
export function closeTerminalFind(): void {
	const { open } = useTerminalFind.getState();
	const api = terminalApi(open);
	api?.clearFind();
	useTerminalFind.setState({ open: null });
	api?.focus();
}
