import { beforeEach, describe, expect, it, vi } from 'vitest';

const { call, toastError, focusedEditor } = vi.hoisted(() => ({
	call: vi.fn(),
	toastError: vi.fn(),
	focusedEditor: vi.fn(),
}));
vi.mock('../../lib/ipc', () => ({ call }));
vi.mock('../../lib/monaco/editors', () => ({ focusedEditor }));
vi.mock('../../lib/log', () => ({ rlog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../stores/toast-store', () => ({
	toast: { error: toastError, info: vi.fn(), success: vi.fn(), warn: vi.fn() },
}));

import { useTabsStore } from '../../stores/tabs-store';
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

describe('focus editor group', () => {
	it('moves keyboard focus into the chosen group', async () => {
		useTabsStore.setState({
			groups: [
				{ id: 0, tabIds: [], active: null },
				{ id: 1, tabIds: [], active: null },
			],
			focused: 0,
		});
		const editor = { focus: vi.fn() };
		focusedEditor.mockReturnValue(editor);
		await byId('view.focusGroup2').run();
		expect(useTabsStore.getState().focused).toBe(1);
		expect(editor.focus).toHaveBeenCalledOnce();
	});
});
