import { beforeEach, describe, expect, it, vi } from 'vitest';

const { call, toastError } = vi.hoisted(() => ({ call: vi.fn(), toastError: vi.fn() }));
vi.mock('../../lib/ipc', () => ({ call }));
vi.mock('../../lib/log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../stores/toast-store', () => ({
	toast: { error: toastError, info: vi.fn(), success: vi.fn(), warn: vi.fn() },
}));

import { CORE_COMMANDS } from './core-commands';
import { runCommand } from './run';

const byId = (id: string): (typeof CORE_COMMANDS)[number] => {
	const command = CORE_COMMANDS.find((c) => c.id === id);
	if (!command) throw new Error(`missing ${id}`);
	return command;
};

describe('core commands', () => {
	beforeEach(() => {
		call.mockReset();
		toastError.mockReset();
	});

	it.each(['view.fullscreen', 'anvil.reload', 'anvil.devtools', 'anvil.logs'])(
		'%s surfaces an IPC failure as a toast',
		async (id) => {
			call.mockRejectedValue(new Error('boom'));
			await runCommand(byId(id));
			expect(toastError).toHaveBeenCalledWith(`${byId(id).title} failed`, 'boom');
		},
	);
});
