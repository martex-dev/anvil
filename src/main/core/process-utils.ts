import { spawn } from 'node:child_process';

/**
 * Kills a process and all its children. Language servers spawn workers, so killing only the
 * direct child would orphan them on Windows.
 */
export function killTree(pid: number): Promise<void> {
	return new Promise((resolve) => {
		if (process.platform === 'win32') {
			const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
				windowsHide: true,
				stdio: 'ignore',
			});
			killer.on('exit', () => resolve());
			killer.on('error', () => resolve());
			return;
		}
		try {
			// Spawned with detached: true, so the negative pid addresses the whole group.
			process.kill(-pid, 'SIGTERM');
		} catch {
			// Already gone.
		}
		resolve();
	});
}
