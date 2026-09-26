import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import log from 'electron-log/main';
import type { z } from 'zod';

import { type EventEnvelope, type InvokeEnvelope, TRANSPORT } from '@shared/ipc/api';
import {
	type AnvilEvent,
	eventContract,
	type EventPayload,
	ipcContract,
} from '@shared/ipc/contract';
import { err } from '@shared/ipc/result';

import { APP_ORIGIN } from './app-protocol';
import { IpcRouter } from './ipc-router';

export const router = new IpcRouter(ipcContract, {
	error: (message, meta) => log.error(message, meta),
	warn: (message, meta) => log.warn(message, meta),
	debug: (message, meta) => log.debug(message, meta),
});

/** Only our own renderer (dev server or packaged file) may call privileged IPC. */
function isTrustedSender(event: IpcMainInvokeEvent): boolean {
	const url = event.senderFrame?.url;
	if (!url) return false;
	const devUrl = process.env['ELECTRON_RENDERER_URL'];
	if (devUrl && url.startsWith(devUrl)) return true;
	return url.startsWith(`${APP_ORIGIN}/`);
}

export function attachIpc(): void {
	ipcMain.handle(TRANSPORT.invoke, async (event, envelope: InvokeEnvelope) => {
		if (!isTrustedSender(event)) {
			log.warn('[ipc] rejected call from untrusted frame', { url: event.senderFrame?.url });
			return err('FORBIDDEN', 'Untrusted sender');
		}
		if (
			typeof envelope !== 'object' ||
			envelope === null ||
			typeof envelope.channel !== 'string'
		) {
			return err('BAD_ENVELOPE', 'Malformed IPC call');
		}
		return router.dispatch(envelope.channel, envelope.input);
	});
}

/** Pushes a validated event to every app window. */
export function emitEvent<E extends AnvilEvent>(event: E, payload: EventPayload<E>): void {
	const checked = (eventContract[event] as z.ZodType).safeParse(payload);
	if (!checked.success) {
		log.error('[ipc] refusing to emit invalid event payload', { event });
		return;
	}
	const envelope: EventEnvelope = { event, payload: checked.data };
	for (const win of BrowserWindow.getAllWindows()) {
		if (!win.isDestroyed()) win.webContents.send(TRANSPORT.event, envelope);
	}
}
