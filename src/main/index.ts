import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { app, BrowserWindow, dialog } from 'electron';
import log from 'electron-log/main';

import { APP_ID } from '@shared/constants';
import type { FeatureFailure, LaunchRequest } from '@shared/ipc/channels/app';

import { readSettings, registerAppHandlers } from './core/app-handlers';
import { registerAppScheme, serveRenderer } from './core/app-protocol';
import { startFeatures } from './core/features';
import { attachIpc, emitEvent, router } from './core/ipc';
import { launchPathFromArgv, resolveLaunchTarget, sameFolder } from './core/launch';
import { createSecretsService, registerSecretsHandlers } from './core/secrets/secrets-handlers';
import { installGlobalSecurity } from './core/security';
import { shutdownWithin } from './core/shutdown';
import { JsonStore } from './core/store/json-store';
import { registerUpdater } from './core/update/updater';
import { createMainWindow } from './core/window';
import { registerWindowHandlers, watchWindowState } from './core/window-handlers';
import { createWorkspace } from './core/workspace';
import type { WorkspaceWatcher } from './core/workspace/watcher';
import type { WorkspaceService } from './core/workspace/workspace-service';
import { aiFeature } from './features/ai';
import { dataFeature } from './features/data';
import { gitFeature } from './features/git';
import { createHistory, historyFeature } from './features/history';
import { lspFeature } from './features/lsp';
import { pythonFeature } from './features/python';
import { searchFeature } from './features/search';
import { tasksFeature } from './features/tasks';
import { templatesFeature } from './features/templates';
import { terminalFeature } from './features/terminal';

// Logs live next to the rest of userData so --user-data-dir (tests) isolates them too.
log.transports.file.resolvePathFn = () => join(app.getPath('userData'), 'logs', 'main.log');
log.initialize();
// A forgotten promise must still leave a trace in the log file.
process.on('unhandledRejection', (reason) => log.error('[main] unhandled rejection', reason));
registerAppScheme();
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

let store: JsonStore | null = null;
let features: { stopAll(): Promise<void> } | null = null;
let featureFailures: readonly FeatureFailure[] = [];
let watcher: WorkspaceWatcher | null = null;
let mainWindow: BrowserWindow | null = null;
/** Set once startup is done: what to do with the path a second start was given. */
let onLaunchArgs: ((argv: readonly string[], cwd: string) => void) | null = null;

// One Anvil per profile: a second process would keep its own copy of settings and secrets and
// overwrite the first one's on save (and run a second updater). Relaunching focuses this window.
// The lock lives in userData, so e2e runs with their own --user-data-dir stay independent.
const isPrimary = app.requestSingleInstanceLock();
if (!isPrimary) app.quit();
app.on('second-instance', (_event, argv, workingDirectory) => {
	onLaunchArgs?.(argv, workingDirectory);
	const win = mainWindow;
	if (!win) {
		// macOS keeps running with no window; open one once startup has finished.
		if (store && features) openWindow(store);
		return;
	}
	if (win.isMinimized()) win.restore();
	win.show();
	win.focus();
});

/**
 * `Anvil.exe <folder|file>` at startup opens that folder before the features start (nothing is
 * unsaved yet); a file is handed to the page once it loads. Later starts go through the page,
 * which asks about unsaved work first.
 */
function applyLaunchPath(workspace: WorkspaceService): void {
	let pending: LaunchRequest | null = null;
	const launched = launchPathFromArgv(process.argv, process.cwd(), app.isPackaged);
	const target = launched ? resolveLaunchTarget(launched, workspace.getRoot()) : null;
	if (target) {
		try {
			if (!sameFolder(target.folder, workspace.getRoot())) workspace.open(target.folder);
			if (target.file) pending = { folder: null, file: target.file };
		} catch (error) {
			log.warn('[launch] could not open the launch path', error);
		}
	}
	router.handle('app:takeLaunchRequest', () => {
		const request = pending;
		pending = null;
		return request;
	});
	onLaunchArgs = (argv, cwd) => {
		const path = launchPathFromArgv(argv, cwd, app.isPackaged);
		const next = path ? resolveLaunchTarget(path, workspace.getRoot()) : null;
		if (!next) return;
		const here = sameFolder(next.folder, workspace.getRoot());
		if (here && !next.file) return;
		emitEvent('app:launchRequest', { folder: here ? null : next.folder, file: next.file });
	};
}

async function start(): Promise<void> {
	installGlobalSecurity();
	serveRenderer(join(__dirname, '../renderer'));
	attachIpc();

	const userData = app.getPath('userData');
	store = new JsonStore(
		join(userData, 'settings.json'),
		(key, issues) =>
			log.warn('[store] invalid value, using default', { key, issues: issues.slice(0, 300) }),
		250,
		(error) => log.error('[store] saving settings failed, will retry', error),
	);
	const settings = store;
	const secrets = createSecretsService();
	registerAppHandlers(settings, () => featureFailures);
	registerWindowHandlers(() => mainWindow);
	registerSecretsHandlers(secrets);
	registerUpdater(() => readSettings(settings).autoUpdate);

	const dataDir = (id: string): string => {
		const dir = join(userData, 'features', id);
		mkdirSync(dir, { recursive: true });
		return dir;
	};
	const history = createHistory(dataDir('history'));
	const ws = createWorkspace(settings, {
		afterWrite: (rel, content) => {
			const root = ws.workspace.getRoot();
			if (root && readSettings(settings).localHistory) history.snapshot(root, rel, content);
		},
	});
	watcher = ws.watcher;
	applyLaunchPath(ws.workspace);

	const started = await startFeatures(
		[
			aiFeature,
			gitFeature,
			lspFeature,
			searchFeature,
			terminalFeature,
			pythonFeature,
			dataFeature,
			historyFeature(history),
			tasksFeature,
			templatesFeature,
		],
		{ settings, secrets, workspace: ws.workspace, dataDir },
	);
	features = started;
	featureFailures = started.failures;

	openWindow(settings);
	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) openWindow(settings);
	});
}

function openWindow(settings: JsonStore): void {
	const win = createMainWindow(settings);
	mainWindow = win;
	watchWindowState(win);
	win.on('closed', () => {
		if (mainWindow === win) mainWindow = null;
	});
	// Windows logoff and shutdown skip the quit events; keep the last settings change at least.
	win.on('session-end', () => settings.flush());
}

if (isPrimary) {
	app.whenReady()
		.then(start)
		.catch((error: unknown) => {
			log.error('[main] fatal startup error', error);
			// Without this, Anvil simply never opens and the user has nothing to go on.
			dialog.showErrorBox(
				'Anvil failed to start',
				`${error instanceof Error ? error.message : String(error)}\n\nDetails are in the log: ${join(app.getPath('userData'), 'logs', 'main.log')}`,
			);
			app.exit(1);
		});
}

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

// `will-quit` (not `before-quit`) runs only once every window has really closed: a window can
// still veto the quit to ask about unsaved files, and the features must keep working until then.
let shuttingDown = false;
app.on('will-quit', (event) => {
	if (shuttingDown) return;
	shuttingDown = true;
	event.preventDefault();
	void shutdownWithin({
		// Settings first: the updater's installer force-kills a slow quit after a couple of seconds.
		steps: [() => store?.flush(), () => features?.stopAll(), () => watcher?.stop()],
		// Settings changed in the last debounce window must reach disk even if cleanup failed.
		finally: () => store?.flush(),
		timeoutMs: 5000,
		logError: (message, error) =>
			error === undefined ? log.error(message) : log.error(message, error),
		// Every window is closed and settings are flushed: a second app.quit() from inside a
		// prevented will-quit doesn't reliably quit again, so exit outright.
	}).finally(() => app.exit(0));
});
