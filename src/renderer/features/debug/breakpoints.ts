import { create } from 'zustand';

import { isRecord, num, str } from './dap-types';

export interface Breakpoint {
	/** Workspace-relative, '/'-separated. */
	path: string;
	line: number;
	enabled: boolean;
	/** Python expression; the program only stops when it is true. */
	condition?: string | undefined;
	/** Stop on the n-th hit ("5", ">= 10", "% 3"). */
	hitCondition?: string | undefined;
	/** A logpoint prints this (with {expressions}) instead of stopping. */
	logMessage?: string | undefined;
}

export type BreakpointOptions = Pick<Breakpoint, 'condition' | 'hitCondition' | 'logMessage'>;

interface BreakpointState {
	items: Breakpoint[];
	/** `path:line` of breakpoints the adapter could not place (no code on that line). */
	rejected: ReadonlySet<string>;
	toggle: (path: string, line: number) => void;
	/** Adds or updates the breakpoint on a line with a condition, hit count or log message. */
	set: (path: string, line: number, options: BreakpointOptions) => void;
	remove: (path: string, line: number) => void;
	setEnabled: (path: string, line: number, enabled: boolean) => void;
	setAllEnabled: (enabled: boolean) => void;
	/** Rewrites one file's breakpoints (after an edit moved them); a no-op when nothing moved. */
	relocate: (path: string, map: (line: number) => number) => void;
	setRejected: (path: string, lines: readonly number[]) => void;
	clear: () => void;
}

export const placeKey = (path: string, line: number): string => `${path}:${line}`;

const byPlace = (x: Breakpoint, y: Breakpoint): number =>
	x.path.localeCompare(y.path) || x.line - y.line;

const blank = (s: string | undefined): string | undefined => (s?.trim() ? s.trim() : undefined);

/** Breakpoint fields that are set, so stored JSON and DAP payloads stay minimal. */
function options(o: BreakpointOptions): BreakpointOptions {
	const condition = blank(o.condition);
	const hitCondition = blank(o.hitCondition);
	const logMessage = blank(o.logMessage);
	return {
		...(condition ? { condition } : {}),
		...(hitCondition ? { hitCondition } : {}),
		...(logMessage ? { logMessage } : {}),
	};
}

/** Validates stored breakpoints (opaque JSON from localStorage) one by one. */
export function parseBreakpoints(raw: unknown): Breakpoint[] {
	if (!Array.isArray(raw)) return [];
	const out: Breakpoint[] = [];
	for (const b of raw) {
		if (!isRecord(b)) continue;
		const path = str(b['path']);
		const line = num(b['line']);
		if (!path || line === undefined || line < 1 || !Number.isInteger(line)) continue;
		out.push({
			path,
			line,
			enabled: b['enabled'] !== false,
			...options({
				condition: str(b['condition']),
				hitCondition: str(b['hitCondition']),
				logMessage: str(b['logMessage']),
			}),
		});
	}
	return out.sort(byPlace);
}

/** The DAP `setBreakpoints` list for one file: enabled breakpoints only. */
export function sourceBreakpoints(
	items: readonly Breakpoint[],
	path: string,
): Array<{ line: number } & BreakpointOptions> {
	return items
		.filter((b) => b.path === path && b.enabled)
		.map((b) => ({ line: b.line, ...options(b) }));
}

const same = (b: Breakpoint, path: string, line: number): boolean =>
	b.path === path && b.line === line;

export const useBreakpoints = create<BreakpointState>((set) => ({
	items: [],
	rejected: new Set(),
	toggle: (path, line) =>
		set((s) => ({
			items: s.items.some((b) => same(b, path, line))
				? s.items.filter((b) => !same(b, path, line))
				: [...s.items, { path, line, enabled: true }].sort(byPlace),
		})),
	set: (path, line, o) =>
		set((s) => ({
			items: [
				...s.items.filter((b) => !same(b, path, line)),
				{ path, line, enabled: true, ...options(o) },
			].sort(byPlace),
		})),
	remove: (path, line) => set((s) => ({ items: s.items.filter((b) => !same(b, path, line)) })),
	setEnabled: (path, line, enabled) =>
		set((s) => ({
			items: s.items.map((b) => (same(b, path, line) ? { ...b, enabled } : b)),
		})),
	setAllEnabled: (enabled) => set((s) => ({ items: s.items.map((b) => ({ ...b, enabled })) })),
	relocate: (path, map) =>
		set((s) => {
			let changed = false;
			const seen = new Set<number>();
			const items: Breakpoint[] = [];
			for (const b of s.items) {
				if (b.path !== path) {
					items.push(b);
					continue;
				}
				const line = map(b.line);
				if (line !== b.line) changed = true;
				// Deleting the lines between two breakpoints folds them onto one line: keep one.
				if (seen.has(line)) {
					changed = true;
					continue;
				}
				seen.add(line);
				items.push(line === b.line ? b : { ...b, line });
			}
			return changed ? { items: items.sort(byPlace) } : s;
		}),
	setRejected: (path, lines) =>
		set((s) => {
			const next = new Set([...s.rejected].filter((k) => !k.startsWith(`${path}:`)));
			for (const line of lines) next.add(placeKey(path, line));
			return { rejected: next };
		}),
	clear: () => set({ items: [], rejected: new Set() }),
}));

/**
 * Breakpoints hold workspace-relative paths, so each folder keeps its own list, like bookmarks.
 */
const keyFor = (root: string): string => `anvil.breakpoints:${root.toLowerCase()}`;

/** The open folder (native path) whose breakpoints are loaded; null before one is open. */
let currentRoot: string | null = null;
/** True while swapping in another folder's list, so that swap isn't saved back. */
let switching = false;

export function breakpointsRoot(): string | null {
	return currentRoot;
}

/** Loads the breakpoints of the folder that is now open. */
export function setBreakpointsRoot(root: string | null): void {
	if (root === currentRoot) return;
	currentRoot = root;
	switching = true;
	try {
		let items: Breakpoint[] = [];
		try {
			items = root
				? parseBreakpoints(JSON.parse(localStorage.getItem(keyFor(root)) ?? '[]'))
				: [];
		} catch {
			// Storage blocked or a corrupt value: start this folder with no breakpoints.
		}
		useBreakpoints.setState({ items, rejected: new Set() });
	} finally {
		switching = false;
	}
}

useBreakpoints.subscribe((s, prev) => {
	if (switching || !currentRoot || s.items === prev.items) return;
	try {
		localStorage.setItem(keyFor(currentRoot), JSON.stringify(s.items));
	} catch {
		// Losing breakpoints on a full storage is acceptable; they are cheap to set again.
	}
});
