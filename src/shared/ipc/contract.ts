import type { z } from 'zod';

import { aiChannels, aiEvents } from './channels/ai';
import { appChannels } from './channels/app';
import { dataChannels } from './channels/data';
import { fsChannels, fsEvents } from './channels/fs';
import { gitChannels, gitEvents } from './channels/git';
import { lspChannels, lspEvents } from './channels/lsp';
import { pythonChannels, pythonEvents } from './channels/python';
import { searchChannels } from './channels/search';
import { secretChannels, secretEvents } from './channels/secrets';
import { settingsChannels, settingsEvents } from './channels/settings';
import { terminalChannels, terminalEvents } from './channels/terminal';
import { toolsChannels } from './channels/tools';
import { updateChannels, updateEvents } from './channels/update';
import { workspaceChannels, workspaceEvents } from './channels/workspace';
import { defineEvents } from './define';

/**
 * The single registry of IPC channels. Each domain declares its channels in ./channels/<domain>.ts
 * and is spread in here; nothing else in the app may invent a channel name.
 */
export const ipcContract = {
	...appChannels,
	...settingsChannels,
	...secretChannels,
	...workspaceChannels,
	...fsChannels,
	...terminalChannels,
	...gitChannels,
	...searchChannels,
	...lspChannels,
	...aiChannels,
	...pythonChannels,
	...dataChannels,
	...toolsChannels,
	...updateChannels,
};

/** Push events main → renderer. Payloads are validated in main before sending. */
export const eventContract = defineEvents({
	...settingsEvents,
	...secretEvents,
	...workspaceEvents,
	...fsEvents,
	...terminalEvents,
	...gitEvents,
	...lspEvents,
	...aiEvents,
	...pythonEvents,
	...updateEvents,
});

export type IpcContract = typeof ipcContract;
export type Channel = keyof IpcContract;
export type ChannelInput<C extends Channel> = z.input<IpcContract[C]['input']>;
export type ChannelParsedInput<C extends Channel> = z.output<IpcContract[C]['input']>;
export type ChannelOutput<C extends Channel> = z.output<IpcContract[C]['output']>;

export type EventContract = typeof eventContract;
export type AnvilEvent = keyof EventContract;
export type EventPayload<E extends AnvilEvent> = z.output<EventContract[E]>;

export function isChannel(name: string): name is Channel {
	return Object.prototype.hasOwnProperty.call(ipcContract, name);
}
