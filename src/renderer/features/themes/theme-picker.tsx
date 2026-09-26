import { ACCENTS, FX_LEVELS, type Settings } from '@shared/settings';

import {
	getSettings,
	previewSkin,
	previewTheme,
	updateSettings,
} from '../../app/hooks/use-settings';
import { palettePatch, resolveLook } from '../../skins/look';
import { skinById, SKINS } from '../../skins/registry';
import { toast } from '../../stores/toast-store';
import { quickPick } from '../../ui/QuickPick';
import { ThemeSwatch } from './ThemeSwatch';

/** Palette quick pick for the current skin: the app recolors live as you arrow through. */
export async function pickTheme(): Promise<void> {
	const settings = getSettings();
	const { skin, palette } = resolveLook(settings);
	let previewing: string | null = null;
	const picked = await quickPick({
		title: skin.name.toLowerCase(),
		placeholder: `Pick a ${skin.name} color variant (arrows preview live)`,
		items: skin.palettes.map((p) => ({
			id: p.id,
			label: p.name,
			description: p.kind === 'light' ? 'light' : undefined,
			detail: p.description,
			icon: <ThemeSwatch id={p.id} />,
			keywords: [p.kind],
			current: p.id === palette.id,
		})),
		onActive: (id) => {
			if (!id || id === previewing) return;
			previewing = id;
			previewTheme(id);
		},
	});
	const chosen = skin.palettes.find((p) => p.id === picked);
	if (chosen && chosen.id !== palette.id) {
		try {
			await updateSettings(palettePatch(getSettings(), chosen.id));
		} catch (error) {
			// The save failed, so the preview must not linger as if the palette were set.
			previewTheme(null);
			throw error;
		}
		toast.info(`${skin.name}: ${chosen.name}`);
	} else {
		previewTheme(null);
	}
}

/** Steps through the current skin's palettes without opening anything. */
export async function nextTheme(step: 1 | -1 = 1): Promise<void> {
	const settings = getSettings();
	const { skin, palette } = resolveLook(settings);
	const i = skin.palettes.findIndex((p) => p.id === palette.id);
	const next = skin.palettes[(i + step + skin.palettes.length) % skin.palettes.length];
	if (!next) return;
	await updateSettings(palettePatch(settings, next.id));
	toast.info(`${skin.name}: ${next.name}`);
}

/** Skin quick pick: the whole app (layout, chrome, fonts) switches live as you arrow through. */
export async function pickSkin(): Promise<void> {
	const current = skinById(getSettings().skin).id;
	let previewing: string | null = null;
	const picked = await quickPick({
		title: 'skin',
		placeholder: 'Pick a skin: a whole different program (arrows preview live)',
		items: SKINS.map((s) => ({
			id: s.id,
			label: s.name,
			description: `${s.palettes.length} variants`,
			detail: s.tagline,
			icon: <ThemeSwatch id={s.defaultPalette} />,
			current: s.id === current,
		})),
		onActive: (id) => {
			if (!id || id === previewing) return;
			previewing = id;
			previewSkin(id);
		},
	});
	if (picked && picked !== current) {
		try {
			await updateSettings({ skin: picked });
		} catch (error) {
			// As with palettes: a failed save must not leave the previewed skin on screen.
			previewSkin(null);
			throw error;
		}
		toast.info(`Skin: ${skinById(picked).name}`);
	} else {
		previewSkin(null);
	}
}

export async function nextSkin(): Promise<void> {
	const i = SKINS.findIndex((s) => s.id === skinById(getSettings().skin).id);
	const next = SKINS[(i + 1) % SKINS.length];
	if (!next) return;
	await updateSettings({ skin: next.id });
	toast.info(`Skin: ${next.name}`);
}

/** Full → subtle → off: how much the skin animates and decorates. */
export async function cycleEffects(): Promise<void> {
	const fx = getSettings().fx;
	const next = FX_LEVELS[(FX_LEVELS.indexOf(fx) + 1) % FX_LEVELS.length] ?? 'full';
	await updateSettings({ fx: next });
	toast.info(`Effects: ${next}`);
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
