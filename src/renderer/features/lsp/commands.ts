import { RotateCcw, ShieldCheck, ShieldOff } from 'lucide-react';

import type { LspLanguage } from '@shared/ipc/channels/lsp';

import type { Command } from '../../app/commands/types';
import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { restart } from './lsp-clients';
import { LANGUAGE_LABEL, useLspStatus } from './lsp-status';

/** Languages whose server is running, starting or failed (not the never-started ones). */
function activeLanguages(): LspLanguage[] {
	const status = useLspStatus.getState().status;
	return (Object.keys(status) as LspLanguage[]).filter((l) => status[l].state !== 'idle');
}

/** Same as clicking the status bar item: restarts every server that was running or failed. */
async function restartServers(): Promise<void> {
	const languages = activeLanguages();
	if (languages.length === 0) {
		toast.info(
			'No language servers running',
			'They start when you open a Python or TypeScript file in the folder.',
		);
		return;
	}
	await restart(languages);
	const failed = languages.filter((l) => useLspStatus.getState().status[l].state === 'error');
	if (failed.length > 0) {
		toast.error(
			'Language server failed to start',
			failed
				.map(
					(l) =>
						`${LANGUAGE_LABEL[l]}: ${useLspStatus.getState().status[l].message ?? 'unknown error'}`,
				)
				.join('\n'),
		);
	} else {
		toast.success(`Restarted ${languages.map((l) => LANGUAGE_LABEL[l]).join(' and ')}`);
	}
}

/**
 * Switches the TypeScript server between the bundled version and the open folder's own
 * node_modules/typescript. The folder's version runs code from the folder, so it is an explicit,
 * per-folder choice rather than automatic.
 */
async function setWorkspaceTs(enabled: boolean): Promise<void> {
	try {
		const current = await call('lsp:workspaceTs');
		if (enabled && !current.available) {
			toast.info('No workspace TypeScript', 'This folder has no node_modules/typescript.');
			return;
		}
		await call('lsp:setWorkspaceTs', { enabled });
		// A TypeScript server that isn't running yet picks the choice up when it starts.
		await restart(activeLanguages());
		toast.success(
			enabled ? "Using this folder's TypeScript" : 'Using the bundled TypeScript',
			enabled ? 'Only do this for folders you trust: it runs their code.' : undefined,
		);
	} catch (error) {
		toast.error(
			'Could not switch TypeScript version',
			error instanceof Error ? error.message : undefined,
		);
	}
}

export const LSP_COMMANDS: Command[] = [
	{
		id: 'lsp.restart',
		title: 'Restart Language Servers',
		category: 'Tools',
		keywords: [
			'lsp',
			'basedpyright',
			'pyright',
			'typescript',
			'intellisense',
			'stuck',
			'crashed',
		],
		icon: RotateCcw,
		run: restartServers,
	},
	{
		id: 'lsp.useWorkspaceTs',
		title: 'Use Workspace TypeScript (trust this folder)',
		category: 'Tools',
		keywords: ['typescript', 'tsserver', 'version', 'language server', 'trust'],
		icon: ShieldCheck,
		run: () => setWorkspaceTs(true),
	},
	{
		id: 'lsp.useBundledTs',
		title: 'Use Bundled TypeScript',
		category: 'Tools',
		keywords: ['typescript', 'tsserver', 'version', 'language server'],
		icon: ShieldOff,
		run: () => setWorkspaceTs(false),
	},
];
