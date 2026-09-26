import { ACCENTS, type Settings } from '@shared/settings';

import { getSettings, previewTheme, updateSettings } from '../../app/hooks/use-settings';
import { toast } from '../../stores/toast-store';
import { themeById, THEMES } from '../../styles/theme-list';
import { quickPick } from '../../ui/QuickPick';
import { ThemeSwatch } from './ThemeSwatch';

/** Theme quick pick: the whole app re-themes live as you arrow through the list. */
export async function pickTheme(): Promise<void> {
	const current = themeById(getSettings().theme).id;
	let previewing: string | null = null;
	const picked = await quickPick({
		title: 'theme',
		placeholder: 'Pick a color theme (arrows preview live)',
		items: THEMES.map((t) => ({
			id: t.id,
			label: t.name,
			description: t.kind === 'light' ? 'light' : undefined,
			detail: t.description,
			icon: <ThemeSwatch id={t.id} />,
			keywords: [t.kind],
			current: t.id === current,
		})),
		onActive: (id) => {
			if (!id || id === previewing) return;
			previewing = id;
			previewTheme(id);
		},
	});
	if (picked && picked !== current) {
		await updateSettings({ theme: picked });
		toast.info(`Theme: ${themeById(picked).name}`);
	} else {
		previewTheme(null);
	}
}

/** Steps through themes without opening anything (bound to a key for quick flipping). */
export async function nextTheme(step: 1 | -1 = 1): Promise<void> {
	const i = THEMES.findIndex((t) => t.id === themeById(getSettings().theme).id);
	const next = THEMES[(i + step + THEMES.length) % THEMES.length];
	if (!next) return;
	await updateSettings({ theme: next.id });
	toast.info(`Theme: ${next.name}`);
}

const ACCENT_CYCLE: ReadonlyArray<Settings['accent']> = ['theme', ...ACCENTS];

/** Theme's own accent → presets → back. A custom color joins the cycle once you've set one. */
export async function cycleAccent(): Promise<void> {
	const accent = getSettings().accent;
	const order = accent === 'custom' ? [...ACCENT_CYCLE, 'custom' as const] : ACCENT_CYCLE;
	const next = order[(order.indexOf(accent) + 1) % order.length] ?? 'theme';
	await updateSettings({ accent: next });
	toast.info(`Accent: ${next === 'theme' ? 'from theme' : next}`);
}
