import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '@shared/settings';

vi.mock('../../app/hooks/use-settings', () => ({
	getSettings: vi.fn(),
	previewSkin: vi.fn(),
	previewTheme: vi.fn(),
	updateSettings: vi.fn(),
}));
vi.mock('../../ui/QuickPick', () => ({ quickPick: vi.fn() }));
vi.mock('../../stores/toast-store', () => ({ toast: { info: vi.fn() } }));
vi.mock('./ThemeSwatch', () => ({ ThemeSwatch: () => null }));

import {
	getSettings,
	previewSkin,
	previewTheme,
	updateSettings,
} from '../../app/hooks/use-settings';
import { palettePatch, resolveLook } from '../../skins/look';
import { SKINS } from '../../skins/registry';
import { quickPick } from '../../ui/QuickPick';
import { pickSkin, pickTheme } from './theme-picker';

describe('pickTheme', () => {
	const { skin } = resolveLook(DEFAULT_SETTINGS);
	const current = skin.palettes[0]?.id ?? 'cyber';
	const other = skin.palettes[1]?.id ?? 'synthwave';
	const settings = { ...DEFAULT_SETTINGS, theme: current };
	beforeEach(() => {
		vi.mocked(getSettings).mockReturnValue(settings);
		vi.mocked(previewTheme).mockReset();
		vi.mocked(updateSettings).mockReset();
		vi.mocked(quickPick).mockResolvedValue(other);
	});

	it('restores the saved palette when saving the picked one fails', async () => {
		vi.mocked(updateSettings).mockRejectedValueOnce(new Error('disk full'));
		await expect(pickTheme()).rejects.toThrow('disk full');
		expect(previewTheme).toHaveBeenLastCalledWith(null);
	});

	it('keeps the picked palette once it is saved', async () => {
		vi.mocked(updateSettings).mockResolvedValueOnce(undefined);
		await pickTheme();
		expect(updateSettings).toHaveBeenCalledWith(palettePatch(settings, other));
		expect(previewTheme).not.toHaveBeenCalledWith(null);
	});
});

describe('pickSkin', () => {
	const current = SKINS[0]?.id ?? 'cyber';
	const other = SKINS.find((s) => s.id !== current)?.id ?? 'zen';
	beforeEach(() => {
		vi.mocked(getSettings).mockReturnValue({ ...DEFAULT_SETTINGS, skin: current });
		vi.mocked(previewSkin).mockReset();
		vi.mocked(updateSettings).mockReset();
		vi.mocked(quickPick).mockResolvedValue(other);
	});

	it('restores the saved skin when saving the picked one fails', async () => {
		vi.mocked(updateSettings).mockRejectedValueOnce(new Error('disk full'));
		await expect(pickSkin()).rejects.toThrow('disk full');
		expect(previewSkin).toHaveBeenLastCalledWith(null);
	});

	it('keeps the picked skin once it is saved', async () => {
		vi.mocked(updateSettings).mockResolvedValueOnce(undefined);
		await pickSkin();
		expect(updateSettings).toHaveBeenCalledWith({ skin: other });
		expect(previewSkin).not.toHaveBeenCalledWith(null);
	});
});
