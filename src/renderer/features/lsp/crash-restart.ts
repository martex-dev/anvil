import type { LspLanguage } from '@shared/ipc/channels/lsp';

/** Automatic restarts allowed per language within RESTART_WINDOW_MS. */
export const MAX_RESTARTS = 3;
export const RESTART_WINDOW_MS = 5 * 60_000;
const FIRST_DELAY_MS = 1_000;

/**
 * When a crashed language server may be started again. Like VS Code's language client, a crash
 * restarts the server by itself, but a server that keeps crashing (a broken install, a file that
 * trips a bug on every start) must not loop: after MAX_RESTARTS crashes in the window it stays
 * down and the status bar offers a manual restart. Delays double (1 s, 2 s, 4 s) so a crash
 * caused by a transient condition has time to clear.
 */
export class RestartBudget {
	private crashes: number[] = [];

	constructor(private readonly now: () => number = Date.now) {}

	/** Records a crash; returns the delay before restarting, or null when the budget is spent. */
	next(): number | null {
		const t = this.now();
		this.crashes = this.crashes.filter((c) => t - c < RESTART_WINDOW_MS);
		if (this.crashes.length >= MAX_RESTARTS) return null;
		this.crashes.push(t);
		return FIRST_DELAY_MS * 2 ** (this.crashes.length - 1);
	}
}

const budgets: Record<LspLanguage, RestartBudget> = {
	python: new RestartBudget(),
	ruff: new RestartBudget(),
	typescript: new RestartBudget(),
};

/** The shared per-language budget used by the language clients. */
export function restartBudget(language: LspLanguage): RestartBudget {
	return budgets[language];
}
