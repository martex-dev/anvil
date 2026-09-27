import { type TermTab, useTerminalStore } from '../features/terminal/terminal-store';
import { call } from '../lib/ipc';
import { rlog } from '../lib/log';
import { toast } from '../stores/toast-store';

/** Longest terminal name kept; the chip truncates long ones anyway. */
const MAX_TITLE = 60;

/**
 * Restarts a terminal in place: same shell, name, role, folder and position, fresh session. The
 * tab gets a new id, which remounts its pane and starts the new session when it is shown.
 */
export function restartTerminal(id: string, newId = `anvil-${crypto.randomUUID()}`): void {
	const { tabs, active } = useTerminalStore.getState();
	const tab = tabs.find((t) => t.id === id);
	if (!tab) return;
	const fresh: TermTab = {
		id: newId,
		preset: tab.preset,
		title: tab.title,
		...(tab.role ? { role: tab.role } : {}),
		...(tab.root !== undefined ? { root: tab.root } : {}),
	};
	useTerminalStore.setState({
		tabs: tabs.map((t) => (t.id === id ? fresh : t)),
		active: active === id ? fresh.id : active,
	});
	call('terminal:kill', id).catch((error: unknown) => {
		// The new session is up either way; the old process may still be running.
		rlog.warn('terminal', 'killing the old session on restart failed', error);
		toast.error(
			'Could not stop the old terminal process',
			error instanceof Error ? error.message : undefined,
		);
	});
}

/** Renames a terminal; an empty name keeps the old one. */
export function renameTerminal(id: string, title: string): void {
	const name = title.trim();
	if (name) useTerminalStore.getState().rename(id, name.slice(0, MAX_TITLE));
}
