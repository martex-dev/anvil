import { create } from 'zustand';

export type SettingsTab = 'appearance' | 'editor' | 'ai' | 'keys' | 'about';
/** Quick Open modes, chosen by the first character typed, like VS Code. */
export type QuickOpenMode = 'files' | 'commands' | 'symbols' | 'line';

interface UiState {
	paletteOpen: boolean;
	quickOpen: { open: boolean; initial: string };
	settingsOpen: boolean;
	settingsTab: SettingsTab;
	shortcutsOpen: boolean;
	templatesOpen: boolean;
	setPaletteOpen: (open: boolean) => void;
	openQuickOpen: (initial?: string) => void;
	closeQuickOpen: () => void;
	openSettings: (tab?: SettingsTab) => void;
	setSettingsOpen: (open: boolean) => void;
	setSettingsTab: (tab: SettingsTab) => void;
	setShortcutsOpen: (open: boolean) => void;
	setTemplatesOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
	paletteOpen: false,
	quickOpen: { open: false, initial: '' },
	settingsOpen: false,
	settingsTab: 'appearance',
	shortcutsOpen: false,
	templatesOpen: false,
	setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
	openQuickOpen: (initial = '') => set({ quickOpen: { open: true, initial } }),
	closeQuickOpen: () => set({ quickOpen: { open: false, initial: '' } }),
	openSettings: (tab) => set((s) => ({ settingsOpen: true, settingsTab: tab ?? s.settingsTab })),
	setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
	setSettingsTab: (settingsTab) => set({ settingsTab }),
	setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
	setTemplatesOpen: (templatesOpen) => set({ templatesOpen }),
}));
