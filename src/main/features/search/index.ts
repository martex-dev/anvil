import { AnvilError } from '../../core/errors';
import type { MainFeature } from '../../core/features';
import { listFiles, Ripgrep } from './ripgrep';

export const searchFeature: MainFeature = {
	id: 'search',
	activate(ctx) {
		const rg = new Ripgrep();
		ctx.onDispose(() => rg.cancel());
		// Closing or switching folders makes a running search meaningless.
		ctx.workspace.onChange(() => rg.cancel());

		const root = (): string => {
			const r = ctx.workspace.root();
			if (!r) throw new AnvilError('SEARCH_NO_FOLDER', 'Open a folder to search in');
			return r;
		};
		ctx.ipc.handle('search:run', (query) => rg.search(root(), query));
		ctx.ipc.handle('search:files', () => listFiles(root()));
	},
};
