import { describe, expect, it } from 'vitest';

import { isInWorkspace } from './workspace-match';

const file = (
	path: string,
	authority = '',
): { scheme: string; authority: string; path: string } => ({
	scheme: 'file',
	authority,
	path,
});

describe('isInWorkspace', () => {
	it('matches files in a normal folder, case-insensitively', () => {
		expect(isInWorkspace('C:\\Users\\Me\\proj', file('/c:/Users/me/proj/src/a.py'))).toBe(true);
		expect(isInWorkspace('C:\\Users\\Me\\proj', file('/c:/Users/me/project2/a.py'))).toBe(
			false,
		);
		expect(
			isInWorkspace('C:\\Users\\Me\\proj', {
				...file('/c:/Users/me/proj/a.py'),
				scheme: 'inmemory',
			}),
		).toBe(false);
	});

	it('matches files on a drive root', () => {
		expect(isInWorkspace('D:\\', file('/d:/research/model.py'))).toBe(true);
		expect(isInWorkspace('D:\\', file('/e:/other.py'))).toBe(false);
	});

	it('matches files on a network share (server in the authority)', () => {
		const root = '\\\\server\\share\\quant';
		expect(isInWorkspace(root, file('/share/quant/a.py', 'server'))).toBe(true);
		expect(isInWorkspace(root, file('/share/other/a.py', 'server'))).toBe(false);
		expect(isInWorkspace(root, file('/share/quant/a.py', 'elsewhere'))).toBe(false);
	});

	it('works for POSIX folders', () => {
		expect(isInWorkspace('/home/me/proj/', file('/home/me/proj/a.ts'))).toBe(true);
	});
});
