import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '@shared/settings';

vi.mock('../../app/hooks/use-settings', () => ({
	getSettings: vi.fn(),
	previewTheme: vi.fn(),
	updateSettings: vi.fn(),
}));
vi.mock('../../ui/QuickPick', () => ({ quickPick: vi.fn() }));
vi.mock('../../stores/toast-store', () => ({ toast: { info: vi.fn() } }));
vi.mock('./ThemeSwatch', () => ({ ThemeSwatch: () => null }));

import { getSettings, previewTheme, updateSettings } from '../../app/hooks/use-settings';
import { THEMES } from '../../styles/theme-list';
import { quickPick } from '../../ui/QuickPick';
import { pickTheme } from './theme-picker';

describe('pickTheme', () => {
	const current = THEMES[0]?.id ?? 'cyber';
	const other = THEMES[1]?.id ?? 'synthwave';
	beforeEach(() => {
		vi.mocked(getSettings).mockReturnValue({ ...DEFAULT_SETTINGS, theme: current });
		vi.mocked(previewTheme).mockReset();
		vi.mocked(quickPick).mockResolvedValue(other);
	});

	it('restores the saved theme when saving the picked one fails', async () => {
		vi.mocked(updateSettings).mockRejectedValueOnce(new Error('disk full'));
		await expect(pickTheme()).rejects.toThrow('disk full');
		expect(previewTheme).toHaveBeenLastCalledWith(null);
	});

	it('keeps the picked theme once it is saved', async () => {
		vi.mocked(updateSettings).mockResolvedValueOnce(undefined);
		await pickTheme();
		expect(updateSettings).toHaveBeenCalledWith({ theme: other });
		expect(previewTheme).not.toHaveBeenCalledWith(null);
	});
});
