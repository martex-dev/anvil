import { describe, expect, it } from 'vitest';

import { useLayoutStore } from '../../stores/layout-store';
import { TOOLBOX_COMMANDS } from './commands';
import { TOOLS } from './tool-list';
import { useToolboxStore } from './toolbox-store';

describe('toolbox commands', () => {
	it('registers one palette command per tool', () => {
		expect(TOOLBOX_COMMANDS.map((c) => c.id)).toEqual(TOOLS.map((t) => `toolbox.${t.id}`));
		for (const command of TOOLBOX_COMMANDS) expect(command.title).toMatch(/^Toolbox: /);
	});

	it('opens the toolbox on the chosen tool', async () => {
		useLayoutStore.setState({ sideView: 'explorer', sideOpen: false });
		const jwt = TOOLBOX_COMMANDS.find((c) => c.id === 'toolbox.jwt');
		await jwt?.run();
		expect(useToolboxStore.getState().activeTool).toBe('jwt');
		expect(useLayoutStore.getState()).toMatchObject({ sideView: 'toolbox', sideOpen: true });
	});
});
