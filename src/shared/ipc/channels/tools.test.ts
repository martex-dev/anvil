import { describe, expect, it } from 'vitest';

import { ProjectNameSchema } from './tools';

function error(name: string): string | undefined {
	return ProjectNameSchema.safeParse(name).error?.issues[0]?.message;
}

describe('ProjectNameSchema', () => {
	it('accepts ordinary project names', () => {
		for (const name of ['momentum-research', 'a', 'ml_v2.1', 'X9']) {
			expect(ProjectNameSchema.safeParse(name).success, name).toBe(true);
		}
	});

	it('limits the length to 64 like the folder it creates', () => {
		expect(ProjectNameSchema.safeParse('a'.repeat(64)).success).toBe(true);
		expect(error('a'.repeat(65))).toBe('At most 64 characters');
	});

	it('rejects names that do not start and end with a letter or digit', () => {
		for (const name of ['-x', 'x-', 'x.', 'x_', '.hidden']) {
			expect(error(name), name).toBe('Start and end with a letter or digit');
		}
	});

	it('rejects other characters', () => {
		expect(error('my project')).toBe('Letters, digits, dot, dash and underscore only');
		expect(error('a/b')).toBe('Letters, digits, dot, dash and underscore only');
	});

	it('rejects reserved Windows device names in any case', () => {
		for (const name of ['CON', 'nul', 'Com1', 'lpt9', 'aux.txt']) {
			expect(error(name), name).toBe('That name is reserved by Windows');
		}
		expect(ProjectNameSchema.safeParse('console').success).toBe(true);
	});
});
