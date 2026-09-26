import { sep } from 'node:path';

import { BrowserWindow, dialog, shell } from 'electron';
import log from 'electron-log/main';

import { emitEvent, router } from '../ipc';
import type { SettingsStore } from '../store/json-store';
import { FsService } from './fs-service';
import { describeWatchError, WorkspaceWatcher } from './watcher';
import { WorkspaceService } from './workspace-service';

export interface WorkspaceServices {
	workspace: WorkspaceService;
	fs: FsService;
	watcher: WorkspaceWatcher;
}

export interface WorkspaceHooks {
	/** Runs after every successful save from the editor (local history snapshots). */
	afterWrite?: (rel: string, content: string) => void;
}

export function createWorkspace(
	settings: SettingsStore,
	hooks: WorkspaceHooks = {},
): WorkspaceServices {
	const workspace = new WorkspaceService(settings);
	const fs = new FsService({
		getRoot: () => workspace.getRoot(),
		trash: (abs) => shell.trashItem(abs),
		reveal: (abs) => shell.showItemInFolder(abs),
	});
	// One notice per watcher start: chokidar can report the same failure for many folders.
	let watchErrorShown = false;
	const watcher = new WorkspaceWatcher(
		(batch) => emitEvent('fs:changed', batch),
		(error) => {
			log.scope('watcher').warn('watch error', error);
			if (watchErrorShown) return;
			watchErrorShown = true;
			emitEvent('fs:watchError', { message: describeWatchError(error) });
		},
	);

	const restartWatcher = (root: string | null): void => {
		watchErrorShown = false;
		if (root) watcher.start(root);
		else void watcher.stop();
	};
	restartWatcher(workspace.getRoot());
	workspace.onChange((info) => {
		restartWatcher(info.root);
		emitEvent('workspace:changed', info);
	});

	router.handle('workspace:get', () => workspace.info());
	router.handle('workspace:openDialog', async () => {
		const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
		const current = workspace.getRoot();
		const options: Electron.OpenDialogOptions = {
			title: 'Open Folder',
			properties: ['openDirectory'],
			...(current ? { defaultPath: current } : {}),
		};
		const result = win
			? await dialog.showOpenDialog(win, options)
			: await dialog.showOpenDialog(options);
		const picked = result.filePaths[0];
		if (result.canceled || !picked) return workspace.info();
		return workspace.open(picked);
	});
	router.handle('workspace:open', (path) => workspace.open(path));
	router.handle('workspace:close', () => workspace.close());
	router.handle('workspace:forgetRecent', (path) => {
		const info = workspace.forgetRecent(path);
		// Keeps every window's recent list current without restarting root-bound services.
		emitEvent('workspace:changed', info);
		return info;
	});

	router.handle('fs:list', (rel) => fs.list(rel));
	router.handle('fs:readFile', (rel) => fs.readFile(rel));
	router.handle('fs:stat', (rel) => fs.stat(rel));
	router.handle('fs:writeFile', async ({ path, content, expectedMtimeMs, bom, encoding }) => {
		const result = await fs.writeFile(path, content, expectedMtimeMs, bom, encoding);
		try {
			hooks.afterWrite?.(path, content);
		} catch (error) {
			// History is a convenience; a failed snapshot must never fail the save itself.
			log.scope('history').warn('snapshot failed', error);
		}
		return result;
	});
	router.handle('fs:create', ({ parent, name, kind }) => fs.create(parent, name, kind));
	router.handle('fs:rename', ({ path, newName }) => fs.rename(path, newName));
	router.handle('fs:trash', (rel) => fs.trash(rel));
	router.handle('fs:reveal', (rel) => fs.reveal(rel));
	router.handle('fs:readDataUrl', (rel) => fs.readDataUrl(rel));
	router.handle('fs:rewatch', () => restartWatcher(workspace.getRoot()));
	// Relative paths use the OS separator too, so a copied path pastes cleanly into a shell.
	router.handle('fs:copyPath', ({ path, absolute }) =>
		absolute ? fs.absolute(path) : path.split('/').join(sep),
	);

	return { workspace, fs, watcher };
}
