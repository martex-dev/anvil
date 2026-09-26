import { Worker } from 'node:worker_threads';

import { AnvilError } from '../../core/errors';
import type { MainFeature } from '../../core/features';
import { toAbsolute } from '../../core/workspace/fs-guard';
import { activatedEnv, interpreter } from '../python/interpreter';
import { formatOf, isTextFormat } from './format';
import type { LoadSpec } from './store';
import workerPath from './worker?modulePath';
import { DataWorkerClient, unpackedPath } from './worker-client';

export const dataFeature: MainFeature = {
	id: 'data',
	activate(ctx) {
		// Parsing, filtering, sorting and profiling run in a worker thread so a large file never
		// blocks the main process (window, menus, terminals and every other IPC call).
		const client = new DataWorkerClient(() => new Worker(unpackedPath(workerPath)), ctx.log);
		ctx.onDispose(() => client.dispose());
		ctx.workspace.onChange(() => client.notify({ op: 'clear' }));

		const spec = (rel: string): LoadSpec => {
			const root = ctx.workspace.root();
			if (!root) throw new AnvilError('NO_WORKSPACE', 'No folder is open');
			const abs = toAbsolute(root, rel);
			const format = formatOf(abs);
			if (!format) throw new AnvilError('DATA_FORMAT', 'Not a data file Anvil can show');
			if (isTextFormat(format)) return { abs, rel, format, python: null };
			const python = interpreter.resolve(root);
			if (!python)
				throw new AnvilError(
					'DATA_NO_PYTHON',
					`${format} files are read with Python (polars or pandas). Select an interpreter first.`,
				);
			return { abs, rel, format, python: { path: python, env: activatedEnv(python) } };
		};

		ctx.ipc.handle('data:page', ({ path, ...query }) =>
			client.call({ op: 'page', spec: spec(path), query }),
		);
		ctx.ipc.handle('data:stats', ({ path, column }) =>
			client.call({ op: 'stats', spec: spec(path), column }),
		);
		ctx.ipc.handle('data:evict', (path) => {
			const root = ctx.workspace.root();
			if (root) client.notify({ op: 'evict', abs: toAbsolute(root, path) });
		});
	},
};
