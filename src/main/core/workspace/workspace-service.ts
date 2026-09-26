import { statSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { z } from 'zod';

import type { WorkspaceInfo } from '@shared/ipc/channels/workspace';

import { AnvilError } from '../errors';
import type { SettingsStore } from '../store/json-store';

const MAX_RECENT = 10;
const CurrentSchema = z.string().nullable();
const RecentSchema = z.array(z.string()).max(50);

function isDirectory(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}

/** The folder Anvil is working in. Shared by explorer, editor, terminals and git. */
export class WorkspaceService {
	private root: string | null;
	private readonly listeners = new Set<(info: WorkspaceInfo) => void>();

	constructor(private readonly settings: SettingsStore) {
		const saved = settings.get('workspace.current', CurrentSchema, null);
		// A folder that vanished since last run (unplugged drive, deleted) just isn't reopened.
		this.root = saved && isDirectory(saved) ? saved : null;
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
		const recent = [
			absolute,
			...this.info().recent.filter((p) => p.toLowerCase() !== absolute.toLowerCase()),
		];
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
		const recent = this.info().recent.filter((p) => p !== path);
		this.settings.set('workspace.recent', RecentSchema, recent);
		return this.info();
	}

	onChange(listener: (info: WorkspaceInfo) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private changed(): WorkspaceInfo {
		const info = this.info();
		for (const listener of this.listeners) listener(info);
		return info;
	}
}
