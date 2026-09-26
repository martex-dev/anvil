import { describe, expect, it } from 'vitest';

import { AnvilError } from '../errors';
import { mapFsError } from './fs-errors';

function errno(code: string): NodeJS.ErrnoException {
	return Object.assign(new Error(`${code}: resource busy, open 'C:\\Users\\me\\data.csv'`), {
		code,
	});
}

describe('mapFsError', () => {
	it('names the relative path and a readable reason instead of the raw errno text', () => {
		const error = mapFsError(errno('EBUSY'), 'data/prices.csv', 'save');
		expect(error).toMatchObject({
			code: 'FS_LOCKED',
			message: 'Cannot save "data/prices.csv": it is open in another program',
		});
		expect(error.message).not.toContain('C:\\Users');
		expect(mapFsError(errno('ENOSPC'), 'a.txt', 'save').code).toBe('FS_DISK_FULL');
		expect(mapFsError(errno('EACCES'), 'a.txt', 'rename').code).toBe('FS_PERMISSION');
	});

	it('keeps the errno for unknown codes and passes AnvilErrors through', () => {
		expect(mapFsError(errno('EIO'), '', 'open')).toMatchObject({
			code: 'FS_FAILED',
			message: 'Cannot open "." (EIO)',
		});
		const original = new AnvilError('FS_CONFLICT', 'changed');
		expect(mapFsError(original, 'a.txt', 'save')).toBe(original);
	});
});
