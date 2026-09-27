import { type BrowserWindow, dialog } from 'electron';
import log from 'electron-log/main';

import { APP_NAME } from '@shared/constants';

/** Chromium's ERR_ABORTED: a newer navigation (or a reload) replaced the load. Not a failure. */
const ERR_ABORTED = -3;

/**
 * Shows the window and asks what to do. The main window starts hidden until the renderer
 * paints, so a failure before that would otherwise leave an invisible, silent Anvil.
 */
async function ask(
	win: BrowserWindow,
	message: string,
	detail: string,
	buttons: [string, string],
	/** What Escape or closing the box means; the harmless choice. */
	cancelId: 0 | 1 = 1,
): Promise<0 | 1 | null> {
	if (win.isDestroyed()) return null;
	win.show();
	const { response } = await dialog.showMessageBox(win, {
		type: 'error',
		title: APP_NAME,
		message,
		detail,
		buttons,
		defaultId: 0,
		cancelId,
	});
	if (win.isDestroyed()) return null;
	return response === 0 ? 0 : 1;
}

/**
 * A renderer that fails to load, crashes or hangs leaves a blank or frozen window: log why and
 * offer to load the interface again. `reload` loads the app's own URL, not whatever the failed
 * navigation left behind.
 */
export function watchRenderer(win: BrowserWindow, reload: () => void): void {
	const report = (what: string) => (error: unknown) => log.error(`[window] ${what}`, error);

	win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
		if (!isMainFrame || code === ERR_ABORTED) return;
		log.error('[window] loading the interface failed', { code, description, url });
		ask(
			win,
			'Anvil could not load its interface',
			`${description} (${code}). Details are in the log.`,
			['Reload', 'Close'],
		)
			.then((choice) => {
				if (choice === 0) reload();
				else if (choice === 1) win.close();
			})
			.catch(report('load failure dialog failed'));
	});

	win.webContents.on('render-process-gone', (_event, details) => {
		log.error('[window] renderer process gone', {
			reason: details.reason,
			exitCode: details.exitCode,
		});
		if (details.reason === 'clean-exit') return;
		ask(
			win,
			'The Anvil window stopped working',
			`Reason: ${details.reason}. Reloading restores the interface; unsaved editor changes in this window are lost.`,
			['Reload', 'Close'],
		)
			.then((choice) => {
				if (choice === 0) reload();
				else if (choice === 1) win.close();
			})
			.catch(report('crash dialog failed'));
	});

	// One question per hang: Chromium can repeat 'unresponsive' while the renderer stays stuck.
	let asking = false;
	win.on('unresponsive', () => {
		log.warn('[window] renderer is not responding');
		if (asking) return;
		asking = true;
		ask(
			win,
			'Anvil is not responding',
			'The window may recover on its own. Reloading restores it now; unsaved editor changes in this window are lost.',
			['Keep waiting', 'Reload'],
			0,
		)
			.then((choice) => {
				if (choice === 1) reload();
			})
			.catch(report('unresponsive dialog failed'))
			.finally(() => {
				asking = false;
			});
	});
	win.on('responsive', () => log.info('[window] renderer is responding again'));
}
