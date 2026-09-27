import { rlog } from '../../lib/log';
import { breakpointsRoot, sourceBreakpoints, useBreakpoints } from './breakpoints';
import type { DapClient } from './dap-client';
import { isRecord } from './dap-types';
import { absolutePath } from './paths';

/**
 * Keeps the adapter's breakpoints in step with the editor's while a session runs. DAP sets a
 * file's breakpoints as a whole list, so each change resends that file's list (and an empty one
 * when its last breakpoint goes).
 */

/** What the adapter was last told per file, as JSON, so only changed files are resent. */
let sent = new Map<string, string>();
let active: DapClient | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

export function resetBreakpointSync(): void {
	sent = new Map();
	active = null;
	clearTimeout(timer);
}

async function sendFile(dap: DapClient, root: string, path: string): Promise<void> {
	const list = sourceBreakpoints(useBreakpoints.getState().items, path);
	const json = JSON.stringify(list);
	if (sent.get(path) === json) return;
	sent.set(path, json);
	const body = await dap.request('setBreakpoints', {
		source: { path: absolutePath(root, path) },
		breakpoints: list,
	});
	const results = Array.isArray(body['breakpoints']) ? body['breakpoints'] : [];
	const rejected = list
		.filter((_, i) => {
			const r: unknown = results[i];
			return isRecord(r) && r['verified'] === false;
		})
		.map((b) => b.line);
	useBreakpoints.getState().setRejected(path, rejected);
}

async function sync(dap: DapClient): Promise<void> {
	const root = breakpointsRoot();
	if (!root || active !== dap) return;
	const paths = new Set([...sent.keys(), ...useBreakpoints.getState().items.map((b) => b.path)]);
	for (const path of paths) {
		try {
			await sendFile(dap, root, path);
		} catch (error) {
			// One file failing (it was deleted) must not keep the others from being set.
			rlog.warn('debug', `setBreakpoints failed for ${path}`, error);
		}
	}
}

/** Sends every breakpoint once the adapter is initialized; later edits follow automatically. */
export async function configureBreakpoints(dap: DapClient): Promise<void> {
	active = dap;
	await sync(dap);
}

useBreakpoints.subscribe((s, prev) => {
	const dap = active;
	if (!dap || s.items === prev.items) return;
	// Typing above breakpoints moves them on every keystroke; batch those into one update.
	clearTimeout(timer);
	timer = setTimeout(() => void sync(dap), 200);
});
