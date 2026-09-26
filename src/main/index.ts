import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { app, BrowserWindow } from 'electron';
import log from 'electron-log/main';

import { APP_ID } from '@shared/constants';
import type { FeatureFailure } from '@shared/ipc/channels/app';

import { readSettings, registerAppHandlers } from './core/app-handlers';
import { registerAppScheme, serveRenderer } from './core/app-protocol';
import { startFeatures } from './core/features';
import { attachIpc } from './core/ipc';
import { createSecretsService, registerSecretsHandlers } from './core/secrets/secrets-handlers';
import { installGlobalSecurity } from './core/security';
import { JsonStore } from './core/store/json-store';
import { registerUpdater } from './core/update/updater';
import { createMainWindow } from './core/window';
import { createWorkspace } from './core/workspace';
import type { WorkspaceWatcher } from './core/workspace/watcher';
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

// One Anvil per profile: a second process would keep its own copy of settings and secrets and
// overwrite the first one's on save (and run a second updater). Relaunching focuses this window.
// The lock lives in userData, so e2e runs with their own --user-data-dir stay independent.
const isPrimary = app.requestSingleInstanceLock();
if (!isPrimary) app.quit();
app.on('second-instance', () => {
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
	win.on('closed', () => {
		if (mainWindow === win) mainWindow = null;
	});
}

if (isPrimary) {
	app.whenReady()
		.then(start)
		.catch((error: unknown) => {
			log.error('[main] fatal startup error', error);
			app.exit(1);
		});
}

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

let shuttingDown = false;
app.on('before-quit', (event) => {
	if (shuttingDown) return;
	shuttingDown = true;
	event.preventDefault();
	void (async () => {
		try {
			await features?.stopAll();
			await watcher?.stop();
			store?.flush();
		} catch (error) {
			log.error('[main] error during shutdown', error);
		}
		app.quit();
	})();
});
