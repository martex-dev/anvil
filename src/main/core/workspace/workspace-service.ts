import { statSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import { z } from 'zod';

import type { WorkspaceInfo } from '@shared/ipc/channels/workspace';

import { AnvilError } from '../errors';
import type { SettingsStore } from '../store/json-store';

const MAX_RECENT = 10;
/** How long startup waits for the last folder; an offline network drive can take 30 s+. */
const RESTORE_TIMEOUT_MS = 3_000;
const CurrentSchema = z.string().nullable();
const RecentSchema = z.array(z.string()).max(50);

/** Windows paths are case-insensitive, and that is where Anvil runs first. */
const samePath = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** Re-raises outside the loop, so the error still reaches the process's error logging. */
function rethrowLater(error: unknown): void {
	queueMicrotask(() => {
		throw error;
	});
}

export type RestoreOutcome = 'restored' | 'none' | 'missing' | 'timeout';

function isDirectory(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}

/** The folder Anvil is working in. Shared by explorer, editor, terminals and git. */
export class WorkspaceService {
	private root: string | null = null;
	private readonly listeners = new Set<(info: WorkspaceInfo) => void>();

	constructor(
		private readonly settings: SettingsStore,
		/** A throwing listener is reported here instead of stopping the ones after it. */
		private readonly reportListenerError: (error: unknown) => void = rethrowLater,
	) {}

	/**
	 * Reopens last session's folder. Asynchronous with a deadline: a synchronous stat of a folder
	 * on an offline network drive blocked the main process, and so the window, for as long as
	 * Windows took to give up. A folder that vanished or doesn't answer in time just isn't
	 * reopened (it stays the saved folder, so the next start tries again).
	 */
	async restore(timeoutMs = RESTORE_TIMEOUT_MS): Promise<RestoreOutcome> {
		const saved = this.settings.get('workspace.current', CurrentSchema, null);
		if (!saved || this.root) return 'none';
		let timer: ReturnType<typeof setTimeout> | undefined;
		const deadline = new Promise<'timeout'>((done) => {
			timer = setTimeout(() => done('timeout'), timeoutMs);
		});
		const check = stat(saved).then(
			(s) => (s.isDirectory() ? ('restored' as const) : ('missing' as const)),
			() => 'missing' as const,
		);
		const outcome = await Promise.race([check, deadline]).finally(() => clearTimeout(timer));
		// The user may have opened a folder while this was waiting; theirs wins.
		if (outcome !== 'restored') return outcome;
		if (this.root) return 'none';
		this.root = saved;
		this.changed();
		return 'restored';
	}

	getRoot(): string | null {
		return this.root;
	}

	info(): WorkspaceInfo {
		return {
			root: this.root,
			name: this.root ? basename(this.root) : null,
			recent: this.settings.get('workspace.recent', RecentSchema, []),
		};
	}

	open(path: string): WorkspaceInfo {
		const absolute = resolve(path);
		if (!isDirectory(absolute)) {
			throw new AnvilError('WORKSPACE_NOT_FOUND', `Folder not found: ${absolute}`);
		}
		this.root = absolute;
		this.settings.set('workspace.current', CurrentSchema, absolute);
		const recent = [absolute, ...this.info().recent.filter((p) => !samePath(p, absolute))];
		this.settings.set('workspace.recent', RecentSchema, recent.slice(0, MAX_RECENT));
		return this.changed();
	}

	close(): WorkspaceInfo {
		this.root = null;
		this.settings.set('workspace.current', CurrentSchema, null);
		return this.changed();
	}

	/**
	 * Only the recent list changes, so root listeners (watcher, language servers, Python) are
	 * not notified; the caller refreshes the renderer's copy.
	 */
	forgetRecent(path: string): WorkspaceInfo {
		const recent = this.info().recent.filter((p) => !samePath(p, path));
		this.settings.set('workspace.recent', RecentSchema, recent);
		return this.info();
	}

	onChange(listener: (info: WorkspaceInfo) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private changed(): WorkspaceInfo {
		const info = this.info();
		// Every listener runs even if one throws: a watcher that failed to restart must not leave
		// the language servers and terminals on the old folder.
		for (const listener of this.listeners) {
			try {
				listener(info);
			} catch (error) {
				this.reportListenerError(error);
			}
		}
		return info;
	}
}
