import { AnvilError } from '../../core/errors';
import type { MainFeature } from '../../core/features';
import { listFiles, Ripgrep } from './ripgrep';

export const searchFeature: MainFeature = {
	id: 'search',
	activate(ctx) {
		const rg = new Ripgrep();
		// A separate lane, so the TODO view and Find-in-files never cancel each other.
		const todos = new Ripgrep();
		ctx.onDispose(() => {
			rg.cancel();
			todos.cancel();
		});
		// Closing or switching folders makes a running search meaningless.
		ctx.workspace.onChange(() => {
			rg.cancel();
			todos.cancel();
		});

		const root = (): string => {
			const r = ctx.workspace.root();
			if (!r) throw new AnvilError('SEARCH_NO_FOLDER', 'Open a folder to search in');
			return r;
		};
		ctx.ipc.handle('search:run', (query) => rg.search(root(), query));
		ctx.ipc.handle('search:todos', (query) => todos.search(root(), query));
		ctx.ipc.handle('search:files', () => listFiles(root()));
	},
};
