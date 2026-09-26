import { describe, expect, it } from 'vitest';

import { settingsChannels } from './ipc/channels/settings';
import { applySettingsPatch, DEFAULT_SETTINGS, parseSettings } from './settings';

describe('parseSettings', () => {
	it('keeps valid fields when another field is invalid', () => {
		const { settings, invalid } = parseSettings({
			tabSize: 0,
			editorFontSize: 18,
			theme: 'latte',
		});
		expect(settings.tabSize).toBe(DEFAULT_SETTINGS.tabSize);
		expect(settings.editorFontSize).toBe(18);
		expect(settings.theme).toBe('latte');
		expect(invalid).toEqual(['tabSize']);
	});

	it('replaces a font id that no longer exists with the default', () => {
		const { settings, invalid } = parseSettings({ editorFont: 'gone', minimap: false });
		expect(settings.editorFont).toBe(DEFAULT_SETTINGS.editorFont);
		expect(settings.minimap).toBe(false);
		expect(invalid).toEqual(['editorFont']);
	});

	it('returns defaults without complaint when nothing is stored', () => {
		expect(parseSettings(undefined)).toEqual({ settings: DEFAULT_SETTINGS, invalid: [] });
	});

	it('drops unknown keys and reports a non-object value', () => {
		expect(parseSettings({ removedOption: true }).settings).toEqual(DEFAULT_SETTINGS);
		expect(parseSettings([1, 2]).invalid).toEqual(['<settings>']);
	});
});

describe('settings:update patches', () => {
	const input = settingsChannels['settings:update'].input;

	it('parses a one-key patch without filling in the other defaults', () => {
		expect(input.parse({ theme: 'nord' })).toEqual({ theme: 'nord' });
	});

	it('still validates the keys that are sent', () => {
		expect(input.safeParse({ editorFontSize: 99 }).success).toBe(false);
	});

	it('keeps every other stored setting when one changes', () => {
		const stored = { ...DEFAULT_SETTINGS, editorFontSize: 18, formatOnSave: true };
		const next = applySettingsPatch(stored, input.parse({ theme: 'nord' }));
		expect(next).toEqual({ ...stored, theme: 'nord' });
	});

	it('ignores keys sent as undefined', () => {
		const stored = { ...DEFAULT_SETTINGS, tabSize: 2 };
		expect(applySettingsPatch(stored, { tabSize: undefined }).tabSize).toBe(2);
	});
});
