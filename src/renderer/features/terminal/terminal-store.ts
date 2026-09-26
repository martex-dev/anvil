import { create } from 'zustand';

import type { TerminalPresetId } from '@shared/ipc/channels/terminal';

import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { queryClient } from '../../lib/query-client';
import { useLayoutStore } from '../../stores/layout-store';
import { toast } from '../../stores/toast-store';
import { loadTerminals, saveTerminals } from './terminal-persist';

export interface TermTab {
	/** Also the main-process session id. */
	id: string;
	preset: TerminalPresetId;
	title: string;
	/** Reusable role: 'run' (Run File), 'repl' (Python REPL), 'task:<id>'. */
	role?: string;
	/**
	 * The folder a role terminal was opened for. Its shell's cwd and venv were fixed at spawn, so
	 * after switching folders it must not be reused for that folder's Run / REPL / tasks.
	 */
	root?: string;
	/** Typed once when the session starts; cleared after. */
	initialCommand?: string;
}

interface TerminalState {
	tabs: TermTab[];
	active: string | null;
	add: (tab: TermTab) => void;
	close: (id: string) => void;
	setActive: (id: string) => void;
	clearInitial: (id: string) => void;
	setInitial: (id: string, command: string) => void;
	rename: (id: string, title: string) => void;
}

export const PRESET_LABEL: Record<TerminalPresetId, string> = {
	powershell: 'pwsh',
	cmd: 'cmd',
	gitbash: 'bash',
	python: 'py env',
	repl: 'repl',
	claude: 'claude',
	codex: 'codex',
	gemini: 'gemini',
};

const initial = loadTerminals();

export const useTerminalStore = create<TerminalState>((set) => ({
	tabs: initial.tabs,
	active: initial.active,
	add: (tab) => set((s) => ({ tabs: [...s.tabs, tab], active: tab.id })),
	close: (id) =>
		set((s) => {
			const index = s.tabs.findIndex((t) => t.id === id);
			const tabs = s.tabs.filter((t) => t.id !== id);
			const active =
				s.active === id ? ((tabs[index] ?? tabs[index - 1] ?? null)?.id ?? null) : s.active;
			return { tabs, active };
		}),
	setActive: (active) => set({ active }),
	clearInitial: (id) =>
		set((s) => ({
			tabs: s.tabs.map((t) =>
				t.id === id
					? {
							id: t.id,
							preset: t.preset,
							title: t.title,
							...(t.role ? { role: t.role } : {}),
							...(t.root !== undefined ? { root: t.root } : {}),
						}
					: t,
			),
		})),
	setInitial: (id, command) =>
		set((s) => ({
			tabs: s.tabs.map((t) => (t.id === id ? { ...t, initialCommand: command } : t)),
		})),
	rename: (id, title) =>
		set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, title } : t)) })),
}));

// Tabs and the active one survive a reload (their sessions start again when shown).
useTerminalStore.subscribe((s) => saveTerminals(s));

const newId = (): string => `anvil-${crypto.randomUUID()}`;

/** The open folder ('' when none), which role terminals are keyed by. */
function currentRoot(): string {
	return queryClient.getQueryData<{ root: string | null }>(['workspace'])?.root ?? '';
}

/** The terminal that has `role` for the open folder, if any. */
export function findRoleTab(role: string): TermTab | undefined {
	const root = currentRoot();
	return useTerminalStore.getState().tabs.find((t) => t.role === role && (t.root ?? '') === root);
}

/**
 * A title no open tab has: `base` itself for a named terminal (then `base 2`, `base 3`…), or
 * `base N` with the lowest free N, so closing 'pwsh 1' and opening another can't repeat 'pwsh 2'.
 */
export function uniqueTitle(taken: readonly string[], base: string, numbered: boolean): string {
	if (!numbered && !taken.includes(base)) return base;
	for (let n = numbered ? 1 : 2; ; n++) {
		const title = `${base} ${n}`;
		if (!taken.includes(title)) return title;
	}
}

export function newTerminal(preset: TerminalPresetId, title?: string): void {
	const taken = useTerminalStore.getState().tabs.map((t) => t.title);
	const name = uniqueTitle(taken, title ?? PRESET_LABEL[preset], title === undefined);
	useTerminalStore.getState().add({ id: newId(), preset, title: name });
	useLayoutStore.getState().showPanel('terminal');
}

/** Shows a terminal tab and gives it keyboard focus (palette switching). */
export function focusTerminal(id: string): void {
	useLayoutStore.getState().showPanel('terminal');
	useTerminalStore.getState().setActive(id);
	requestTerminalFocus(id);
}

/** Moves keyboard focus into a session's xterm once its pane has rendered visible. */
function requestTerminalFocus(id: string): void {
	// After the panel and tab have rendered: a hidden textarea can't take focus. A pane that
	// isn't open yet focuses itself when its session opens.
	requestAnimationFrame(() =>
		window.dispatchEvent(new CustomEvent(FOCUS_TERMINAL_EVENT, { detail: id })),
	);
}

/**
 * Closes a tab and kills its session. When it was the active tab, the tab that takes its place
 * gets keyboard focus (unless `focusNext` is false: a replacement is about to be opened).
 */
export function closeTerminal(id: string, focusNext = true): void {
	const wasActive = useTerminalStore.getState().active === id;
	useTerminalStore.getState().close(id);
	const next = useTerminalStore.getState().active;
	const { panelOpen, panelTab } = useLayoutStore.getState();
	if (focusNext && wasActive && next && panelOpen && panelTab === 'terminal')
		requestTerminalFocus(next);
	call('terminal:kill', id).catch((e: unknown) => {
		// The tab is gone either way, but its process may still be running.
		rlog.warn('terminal', 'kill failed', e);
		toast.error(
			'Could not stop the terminal process',
			e instanceof Error ? e.message : undefined,
		);
	});
}

/**
 * Sessions a mounted pane has opened (or is opening). A restored tab that isn't among them gets
 * its command as the pane's initial command instead of a write racing the pane's open.
 */
const attached = new Set<string>();

export function markAttached(id: string): void {
	attached.add(id);
}

export function unmarkAttached(id: string): void {
	attached.delete(id);
}

/**
 * Runs a command in the terminal that has `role`, creating it if needed. Reusing one terminal
 * per role (Run, REPL, a task) keeps repeated runs from piling up tabs.
 */
export async function runInTerminal(options: {
	role: string;
	preset: TerminalPresetId;
	title: string;
	command: string;
}): Promise<void> {
	const store = useTerminalStore.getState();
	useLayoutStore.getState().showPanel('terminal');
	const existing = findRoleTab(options.role);
	if (existing && !attached.has(existing.id)) {
		// A restored tab whose pane hasn't opened it: the pane starts it with the command.
		store.setInitial(existing.id, options.command);
		store.setActive(existing.id);
		return;
	}
	if (existing) {
		store.setActive(existing.id);
		let alive: boolean;
		try {
			// An exited shell or REPL is restarted in main, so the command still runs.
			alive = await call('terminal:write', {
				sessionId: existing.id,
				data: `${options.command}\r`,
				restart: true,
			});
		} catch (error) {
			rlog.warn('terminal', 'reusing terminal failed', error);
			toast.error(
				`Could not run in ${existing.title}`,
				error instanceof Error ? error.message : undefined,
			);
			return;
		}
		// The pane's start failed (its error state offers Retry).
		if (!alive)
			toast.error(`Could not run in ${existing.title}`, 'The terminal is not running.');
		return;
	}
	store.add({
		id: newId(),
		preset: options.preset,
		title: options.title,
		role: options.role,
		root: currentRoot(),
		initialCommand: options.command,
	});
}

/** Asks the mounted xterm of a session to take keyboard focus (detail: session id). */
export const FOCUS_TERMINAL_EVENT = 'anvil:focus-terminal';

/**
 * Shows and focuses the terminal that has `role` without typing anything into it, creating it
 * (focused on start) if there is none. For "open the REPL" style commands.
 */
export function showRoleTerminal(options: {
	role: string;
	preset: TerminalPresetId;
	title: string;
}): void {
	const store = useTerminalStore.getState();
	useLayoutStore.getState().showPanel('terminal');
	const existing = findRoleTab(options.role);
	if (!existing) {
		store.add({ id: newId(), ...options, root: currentRoot() });
		return;
	}
	focusTerminal(existing.id);
}

/** Whether a role's terminal has a live session (the REPL namespace survives between runs). */
export function hasRole(role: string): boolean {
	return findRoleTab(role) !== undefined;
}
