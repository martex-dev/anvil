import { afterEach, describe, expect, it, vi } from 'vitest';

import { call, IpcCallError } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { openRecentFolder } from './workspace-actions';

// Keep the real IpcCallError so the code can check error codes.
vi.mock(import('../../lib/ipc'), async (importOriginal) => ({
	...(await importOriginal()),
	call: vi.fn(),
}));

/** Lets the async action settle. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
	vi.clearAllMocks();
	vi.restoreAllMocks();
});

describe('openRecentFolder', () => {
	it('drops a recent folder that no longer exists and says so', async () => {
		vi.mocked(call).mockImplementation((channel) =>
			channel === 'workspace:open'
				? Promise.reject(
						new IpcCallError(
							'workspace:open',
							'WORKSPACE_NOT_FOUND',
							'Folder not found: C:\\gone',
						),
					)
				: Promise.resolve({ root: null, name: null, recent: [] }),
		);
		const error = vi.spyOn(toast, 'error');
		openRecentFolder('C:\\gone');
		await flush();
		expect(call).toHaveBeenCalledWith('workspace:forgetRecent', 'C:\\gone');
		expect(error).toHaveBeenCalledWith(
			'Could not open folder',
			'Folder not found: C:\\gone. Removed it from recent folders.',
		);
	});

	it('keeps the folder in recent for other failures', async () => {
		vi.mocked(call).mockRejectedValue(
			new IpcCallError('workspace:open', 'FS_READ_FAILED', 'Access denied'),
		);
		const error = vi.spyOn(toast, 'error');
		openRecentFolder('C:\\locked');
		await flush();
		expect(call).not.toHaveBeenCalledWith('workspace:forgetRecent', expect.anything());
		expect(error).toHaveBeenCalledWith('Could not open folder', 'Access denied');
	});
});
