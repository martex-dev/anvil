import { z } from 'zod';

import { TerminalPresetIdSchema } from '@shared/ipc/channels/terminal';

import type { TermTab } from './terminal-store';

const KEY = 'anvil.terminals';

/** Matches the ids newTerminal() makes; main rejects anything else as a session id. */
const StoredTabSchema = z.object({
	id: z.string().regex(/^anvil-[0-9a-f-]{8,58}$/),
	preset: TerminalPresetIdSchema,
	title: z.string().min(1).max(200),
	role: z.string().min(1).optional(),
	root: z.string().optional(),
});

export interface StoredTerminals {
	tabs: TermTab[];
	active: string | null;
}

/**
 * Validates restored terminal tabs (opaque JSON from storage, possibly from an older version):
 * invalid or duplicate entries are dropped, and the active tab is kept if it survived. Accepts
 * the older bare-array form.
 */
export function parseStoredTerminals(raw: unknown): StoredTerminals {
	const record: unknown = Array.isArray(raw) ? { tabs: raw } : raw;
	if (typeof record !== 'object' || record === null) return { tabs: [], active: null };
	const { tabs: list, active } = record as { tabs?: unknown; active?: unknown };
	const tabs: TermTab[] = [];
	for (const entry of Array.isArray(list) ? list : []) {
		const parsed = StoredTabSchema.safeParse(entry);
		if (!parsed.success || tabs.some((t) => t.id === parsed.data.id)) continue;
		const { id, preset, title, role, root } = parsed.data;
		tabs.push({
			id,
			preset,
			title,
			...(role ? { role } : {}),
			...(root !== undefined ? { root } : {}),
		});
	}
	return { tabs, active: tabs.find((t) => t.id === active)?.id ?? tabs[0]?.id ?? null };
}

export function loadTerminals(): StoredTerminals {
	try {
		return parseStoredTerminals(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
	} catch {
		// No storage (or unreadable JSON): start without restored tabs.
		return { tabs: [], active: null };
	}
}

export function saveTerminals({ tabs, active }: StoredTerminals): void {
	try {
		const stored = tabs.map(({ id, preset, title, role, root }) => ({
			id,
			preset,
			title,
			role,
			root,
		}));
		localStorage.setItem(KEY, JSON.stringify({ tabs: stored, active }));
	} catch {
		// Storage full or unavailable: terminal tabs just won't be restored.
	}
}
