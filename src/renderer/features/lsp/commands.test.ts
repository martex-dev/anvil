import { beforeEach, describe, expect, it, vi } from 'vitest';

const restart = vi.fn<(languages: string[]) => Promise<void>>(async () => undefined);
vi.mock('../../lib/ipc', () => ({ call: vi.fn() }));
vi.mock('./lsp-clients', () => ({ restart }));

const { LSP_COMMANDS } = await import('./commands');
const { useLspStatus } = await import('./lsp-status');
const { useToastStore } = await import('../../stores/toast-store');

const run = async (id: string): Promise<void> => {
	const command = LSP_COMMANDS.find((c) => c.id === id);
	if (!command) throw new Error(`missing ${id}`);
	await command.run();
};

describe('language server commands', () => {
	beforeEach(() => {
		restart.mockClear();
		useLspStatus.getState().reset();
		useToastStore.setState({ toasts: [] });
	});

	it('restarts the servers that were running or failed, from the palette', async () => {
		useLspStatus.getState().set('python', 'error', 'crashed');
		useLspStatus.getState().set('typescript', 'ready');
		await run('lsp.restart');
		expect(restart).toHaveBeenCalledWith(['python', 'typescript']);
	});

	it('explains when no server has started yet', async () => {
		await run('lsp.restart');
		expect(restart).not.toHaveBeenCalled();
		expect(useToastStore.getState().toasts[0]?.title).toBe('No language servers running');
	});
});
