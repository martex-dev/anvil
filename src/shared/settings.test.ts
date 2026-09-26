import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, SettingsPatchSchema } from './settings';

describe('SettingsPatchSchema', () => {
	it('keeps only the fields that were sent (no defaults filled in)', () => {
		expect(SettingsPatchSchema.parse({ fx: 'off' })).toEqual({ fx: 'off' });
	});

	it('merges into current settings without resetting the rest', () => {
		const current = { ...DEFAULT_SETTINGS, skin: 'mainframe', accent: 'lime' as const };
		const next = { ...current, ...SettingsPatchSchema.parse({ minimap: false }) };
		expect(next.skin).toBe('mainframe');
		expect(next.accent).toBe('lime');
		expect(next.minimap).toBe(false);
	});

	it('still validates values', () => {
		expect(SettingsPatchSchema.safeParse({ fx: 'bogus' }).success).toBe(false);
		expect(SettingsPatchSchema.safeParse({ uiFontSize: 99 }).success).toBe(false);
	});
});
