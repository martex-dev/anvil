import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { gitOp } from './git-ops';

// Source Control operations shared by the Git view and the palette. Each runs through gitOp:
// busy while it runs, a toast when it fails, a fresh status afterwards.

export async function initRepository(): Promise<void> {
	const done = await gitOp('Could not initialize the repository', async () => {
		await call('git:init');
		return true;
	});
	if (done) toast.success('Repository initialized', 'Changes in this folder are now tracked.');
}
