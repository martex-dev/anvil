import { describe, expect, it } from 'vitest';

import { describeWatchError } from './watcher';

const errno = (code: string): Error =>
	Object.assign(new Error(`${code}: watch 'C:\\Users\\me\\share'`), { code });

describe('describeWatchError', () => {
	it('explains common watch failures without leaking paths', () => {
		expect(describeWatchError(errno('EPERM'))).toBe(
			'A folder could not be watched (no permission)',
		);
		expect(describeWatchError(errno('EMFILE'))).toBe('The folder has too many files to watch');
		expect(describeWatchError(errno('EIO'))).toBe('Watching for changes failed (EIO)');
		expect(describeWatchError('weird')).toBe('Watching for changes failed');
		expect(describeWatchError(errno('EPERM'))).not.toContain('Users');
	});
});
