import { spawn } from 'node:child_process';

/**
 * Kills a process and all its children. Language servers spawn workers, so killing only the
 * direct child would orphan them. On POSIX the target should be spawned with `detached: true`
 * so it leads its own process group; otherwise only the process itself is signalled.
 * Resolves once the process (group) is gone, escalating to SIGKILL after `graceMs`.
 */
export function killTree(pid: number, graceMs = 2_000): Promise<void> {
	if (process.platform === 'win32') {
		return new Promise((resolve) => {
			const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
				windowsHide: true,
				stdio: 'ignore',
			});
			killer.on('exit', () => resolve());
			killer.on('error', () => resolve());
		});
	}
	// The negative pid addresses the whole group; ESRCH means there is no such group.
	const target = signal(-pid, 'SIGTERM') ? -pid : pid;
	if (target === pid && !signal(pid, 'SIGTERM')) return Promise.resolve();
	return waitForExit(target, graceMs).then((exited) => {
		if (!exited) signal(target, 'SIGKILL');
	});
}

/** Sends a signal; false when the target no longer exists. */
function signal(target: number, sig: NodeJS.Signals | 0): boolean {
	try {
		process.kill(target, sig);
		return true;
	} catch (error) {
		// EPERM still means "exists"; only ESRCH means it is gone.
		return (error as NodeJS.ErrnoException).code === 'EPERM';
	}
}

function waitForExit(target: number, timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	return new Promise((resolve) => {
		const poll = (): void => {
			if (!signal(target, 0)) resolve(true);
			else if (Date.now() >= deadline) resolve(false);
			else setTimeout(poll, 50);
		};
		poll();
	});
}
