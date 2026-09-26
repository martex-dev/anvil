import { create } from 'zustand';

import type { TerminalPresetId } from '@shared/ipc/channels/terminal';

import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { useLayoutStore } from '../../stores/layout-store';
import { toast } from '../../stores/toast-store';

export interface TermTab {
	/** Also the main-process session id. */
	id: string;
	preset: TerminalPresetId;
	title: string;
	/** Reusable role: 'run' (Run File), 'repl' (Python REPL), 'task:<id>'. */
	role?: string;
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

const KEY = 'anvil.terminals';

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

function load(): TermTab[] {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
		if (!Array.isArray(raw)) return [];
		return raw
			.filter(
				(t): t is TermTab =>
					typeof t === 'object' && t !== null && typeof (t as TermTab).id === 'string',
			)
			.map(({ id, preset, title, role }) => ({
				id,
				preset,
				title,
				...(role ? { role } : {}),
			}));
	} catch {
		return [];
	}
}

const initial = load();

export const useTerminalStore = create<TerminalState>((set) => ({
	tabs: initial,
	active: initial[0]?.id ?? null,
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

useTerminalStore.subscribe((s) => {
	try {
		localStorage.setItem(
			KEY,
			JSON.stringify(
				s.tabs.map(({ id, preset, title, role }) => ({ id, preset, title, role })),
			),
		);
	} catch {
		// Terminal tabs just won't be restored.
	}
});

const newId = (): string => `anvil-${crypto.randomUUID()}`;

export function newTerminal(preset: TerminalPresetId, title?: string): void {
	const n = useTerminalStore.getState().tabs.filter((t) => t.preset === preset).length + 1;
	useTerminalStore
		.getState()
		.add({ id: newId(), preset, title: title ?? `${PRESET_LABEL[preset]} ${n}` });
	useLayoutStore.getState().showPanel('terminal');
}

export function closeTerminal(id: string): void {
	useTerminalStore.getState().close(id);
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
	const existing = store.tabs.find((t) => t.role === options.role);
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
		// Not started yet (a restored tab never shown): it starts with the command when it mounts.
		if (!alive) store.setInitial(existing.id, options.command);
		return;
	}
	store.add({
		id: newId(),
		preset: options.preset,
		title: options.title,
		role: options.role,
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
	const existing = store.tabs.find((t) => t.role === options.role);
	if (!existing) {
		store.add({ id: newId(), ...options });
		return;
	}
	store.setActive(existing.id);
	// After the panel and tab have rendered visible: a hidden textarea can't take focus.
	requestAnimationFrame(() =>
		window.dispatchEvent(new CustomEvent(FOCUS_TERMINAL_EVENT, { detail: existing.id })),
	);
}

/** Whether a role's terminal has a live session (the REPL namespace survives between runs). */
export function hasRole(role: string): boolean {
	return useTerminalStore.getState().tabs.some((t) => t.role === role);
}
