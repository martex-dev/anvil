import { afterEach, describe, expect, it, vi } from 'vitest';

import { WORKSPACE_KEY } from '../../app/hooks/use-workspace';
import { queryClient } from '../../lib/query-client';
import { useLayoutStore } from '../../stores/layout-store';
import { toast } from '../../stores/toast-store';
import {
	type FileTreeHandle,
	registerExplorerTree,
	withExplorerTree,
} from './explorer-tree-registry';

vi.mock('../../lib/ipc', () => ({ call: vi.fn() }));

function handle(): FileTreeHandle {
	return {
		startCreate: vi.fn(),
		collapseAll: vi.fn(),
		refresh: vi.fn(),
		revealActive: vi.fn(),
		renameFocused: vi.fn(),
		deleteFocused: vi.fn(),
	};
}

function openFolder(root: string | null): void {
	queryClient.setQueryData(WORKSPACE_KEY, { root, name: root, recent: [] });
}

afterEach(() => {
	queryClient.clear();
	vi.restoreAllMocks();
});

describe('withExplorerTree', () => {
	it('warns and does nothing without an open folder', () => {
		openFolder(null);
		const warn = vi.spyOn(toast, 'warn');
		const action = vi.fn();
		withExplorerTree(action);
		expect(warn).toHaveBeenCalledWith('Open a folder first');
		expect(action).not.toHaveBeenCalled();
	});

	it('shows the Explorer and runs on the mounted tree', () => {
		openFolder('C:\\proj');
		useLayoutStore.getState().showView('search');
		const tree = handle();
		const unregister = registerExplorerTree({ current: tree });
		withExplorerTree((t) => t.collapseAll());
		expect(tree.collapseAll).toHaveBeenCalledOnce();
		expect(useLayoutStore.getState().sideView).toBe('explorer');
		unregister();
	});

	it('queues the action until the tree mounts when the Explorer was hidden', () => {
		openFolder('C:\\proj');
		withExplorerTree((t) => t.startCreate('dir'));
		const tree = handle();
		const unregister = registerExplorerTree({ current: tree });
		expect(tree.startCreate).toHaveBeenCalledWith('dir');
		unregister();
		// Consumed: a later mount does not replay it.
		const again = handle();
		registerExplorerTree({ current: again })();
		expect(again.startCreate).not.toHaveBeenCalled();
	});
});
