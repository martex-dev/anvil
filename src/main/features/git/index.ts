import type { MainFeature } from '../../core/features';
import { gitError } from './git-errors';
import { branches, checkout, pull, push } from './git-remote';
import { GitService } from './git-service';

export const gitFeature: MainFeature = {
	id: 'git',
	activate(ctx) {
		const service = new GitService(() => ctx.workspace.root());
		ctx.workspace.onChange(() => service.reset());
		const changed = (): void => ctx.emit('git:changed', {});
		const run = async <T>(op: () => Promise<T>, notifies = true): Promise<T> => {
			try {
				const result = await op();
				if (notifies) changed();
				return result;
			} catch (error) {
				throw gitError(error);
			}
		};

		ctx.ipc.handle('git:status', () => run(() => service.status(), false));
		ctx.ipc.handle('git:diff', ({ path, staged, from }) =>
			run(async () => ({ path, ...(await service.diff(path, staged, from)) }), false),
		);
		ctx.ipc.handle('git:stage', (paths) => run(() => service.stage(paths)));
		ctx.ipc.handle('git:unstage', (paths) => run(() => service.unstage(paths)));
		ctx.ipc.handle('git:init', () => run(() => service.init()));
		ctx.ipc.handle('git:discard', ({ tracked, untracked }) =>
			run(() => service.discard(tracked, untracked)),
		);
		ctx.ipc.handle('git:conflictMarkers', (paths) =>
			run(() => service.conflictMarkers(paths), false),
		);
		ctx.ipc.handle('git:commit', ({ message }) => run(() => service.commit(message)));
		const repo = (): Promise<string> => service.repo();
		ctx.ipc.handle('git:pull', () => run(async () => pull(await repo())));
		ctx.ipc.handle('git:push', () => run(async () => push(await repo())));
		ctx.ipc.handle('git:branches', () => run(async () => branches(await repo()), false));
		ctx.ipc.handle('git:checkout', ({ branch, create }) =>
			run(async () => checkout(await repo(), branch, create)),
		);
		ctx.ipc.handle('git:log', ({ limit }) => run(() => service.log(limit), false));
		ctx.ipc.handle('git:blame', ({ path, line }) =>
			run(() => service.blame(path, line), false),
		);
		ctx.ipc.handle('git:headContent', (path) =>
			run(async () => ({ content: await service.headContent(path) }), false),
		);
		ctx.ipc.handle('git:scanStaged', () => run(() => service.scanStaged(), false));
	},
};
