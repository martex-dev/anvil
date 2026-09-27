import type { MainFeature } from '../../core/features';
import { gitError } from './git-errors';
import { blame, headContent, log, show } from './git-history';
import { branches, checkout, fetchRemotes, pull, push } from './git-remote';
import { GitService } from './git-service';
import { stash, stashCommand, stashList } from './git-stash';

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
		ctx.ipc.handle('git:commit', ({ message, amend }) =>
			run(() => service.commit(message, amend ?? false)),
		);
		ctx.ipc.handle('git:lastCommitMessage', () =>
			run(async () => ({ message: await service.lastCommitMessage() }), false),
		);
		const repo = (): Promise<string> => service.repo();
		ctx.ipc.handle('git:pull', () => run(async () => pull(await repo())));
		ctx.ipc.handle('git:push', () => run(async () => push(await repo())));
		ctx.ipc.handle('git:fetch', ({ background }) =>
			run(async () => {
				try {
					return await fetchRemotes(await repo(), background ?? false);
				} catch (error) {
					// A background fetch fails often (offline, VPN, expired token) and on its own
					// schedule; it is logged here and the renderer stays quiet about it.
					if (background)
						ctx.log.warn('background fetch failed', { error: gitError(error).message });
					throw error;
				}
			}),
		);
		ctx.ipc.handle('git:stash', ({ message }) =>
			run(async () => stash(await repo(), message || undefined)),
		);
		ctx.ipc.handle('git:stashList', () => run(async () => stashList(await repo()), false));
		ctx.ipc.handle('git:stashApply', ({ index }) =>
			run(async () => stashCommand(await repo(), 'apply', index)),
		);
		ctx.ipc.handle('git:stashPop', ({ index }) =>
			run(async () => stashCommand(await repo(), 'pop', index)),
		);
		ctx.ipc.handle('git:stashDrop', ({ index }) =>
			run(async () => stashCommand(await repo(), 'drop', index)),
		);
		ctx.ipc.handle('git:branches', () => run(async () => branches(await repo()), false));
		ctx.ipc.handle('git:checkout', ({ branch, create }) =>
			run(async () => checkout(await repo(), branch, create)),
		);
		ctx.ipc.handle('git:log', ({ limit, path }) =>
			run(async () => {
				if (path === undefined) return log(await repo(), limit);
				const located = await service.locate(path);
				return located ? log(located.root, limit, located.repoPath) : [];
			}, false),
		);
		ctx.ipc.handle('git:show', ({ hash, path, parent }) =>
			run(async () => show(await repo(), hash, path, parent ?? false), false),
		);
		// Editor paths are relative to the open folder, which may be a subfolder of the repo.
		ctx.ipc.handle('git:blame', ({ path, line }) =>
			run(async () => {
				const located = await service.locate(path);
				return located ? blame(located.root, located.repoPath, line) : null;
			}, false),
		);
		ctx.ipc.handle('git:headContent', (path) =>
			run(async () => {
				const located = await service.locate(path);
				return {
					content: located ? await headContent(located.root, located.repoPath) : null,
				};
			}, false),
		);
		ctx.ipc.handle('git:scanStaged', () => run(() => service.scanStaged(), false));
	},
};
