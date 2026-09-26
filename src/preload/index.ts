import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

import { type AnvilApi, type EventEnvelope, TRANSPORT } from '@shared/ipc/api';

// One IPC listener fans out to every subscriber, instead of one ipcRenderer listener per
// subscription (which trips Node's max-listeners warning once many panels subscribe).
const handlers = new Map<string, Set<(payload: unknown) => void>>();

ipcRenderer.on(TRANSPORT.event, (_e: IpcRendererEvent, envelope: EventEnvelope) => {
	for (const handler of handlers.get(envelope.event) ?? []) handler(envelope.payload);
});

// Kept deliberately thin: no validation or logic here, main validates everything.
const api: AnvilApi = {
	invoke: (channel, ...args) => ipcRenderer.invoke(TRANSPORT.invoke, { channel, input: args[0] }),
	on: (event, handler) => {
		const set = handlers.get(event) ?? new Set();
		const wrapped = handler as (payload: unknown) => void;
		set.add(wrapped);
		handlers.set(event, set);
		return () => {
			set.delete(wrapped);
		};
	},
	platform: process.platform,
};

contextBridge.exposeInMainWorld('anvil', api);
