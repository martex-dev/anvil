import type { JSX } from 'react';

import { UI_FONTS, uiFontFamily } from '@shared/fonts';
import type { Settings } from '@shared/settings';

import { SkinGallery } from '../../features/themes/SkinGallery';
import { ThemeGallery } from '../../features/themes/ThemeGallery';
import { palettePatch, resolveLook, uiFontPatch } from '../../skins/look';
import { Select } from '../../ui/Select';
import { AccentPicker } from './AccentPicker';
import { SettingRow } from './SettingRow';
import { SettingSegmented } from './SettingSegmented';
import { SettingStepper } from './SettingStepper';
import { SettingToggle } from './SettingToggle';

function Section({
	title,
	hint,
	children,
}: {
	title: string;
	hint: string;
	children: JSX.Element;
}): JSX.Element {
	return (
		<div className='py-3'>
			<p className='text-13 text-fg-0'>{title}</p>
			<p className='text-12 text-fg-2'>{hint}</p>
			{children}
		</div>
	);
}

export function AppearanceSettings({
	s,
	update,
}: {
	s: Settings;
	update: (p: Partial<Settings>) => void;
}): JSX.Element {
	const look = resolveLook(s);
	const { skin } = look;
	return (
		<div className='divide-y divide-glass-edge'>
			<Section
				title='Skin'
				hint='A whole different program: layout, chrome, fonts and icons. Ctrl+Alt+Y previews them live.'
			>
				<SkinGallery value={skin.id} onChange={(id) => update({ skin: id })} />
			</Section>
			<Section
				title={`${skin.name} colors`}
				hint={`${look.palette.description}. Ctrl+Alt+T flips through them live.`}
			>
				<ThemeGallery
					palettes={skin.palettes}
					value={look.palette.id}
					onChange={(id) => update(palettePatch(s, id))}
				/>
			</Section>
			<SettingRow
				label='Accent'
				description='The color that drives focus, cursor and highlights: the variant’s own, a preset, or any color.'
			>
				<AccentPicker s={s} update={update} />
			</SettingRow>
			<SettingRow
				label='Interface font'
				description={`The fonts ${skin.name} is designed for.`}
			>
				<Select
					aria-label='Interface font'
					value={look.uiFontId}
					onValueChange={(id) => update(uiFontPatch(s, id))}
					options={skin.fonts.ui.map((id) => {
						// Each font previews in its own face, like the editor font list.
						const family = uiFontFamily(id);
						return {
							value: id,
							label: UI_FONTS.find((f) => f.id === id)?.name ?? id,
							...(family ? { fontFamily: family } : {}),
						};
					})}
					className='w-52'
				/>
			</SettingRow>
			<SettingRow label='Density' description='Spacing across the whole interface.'>
				<SettingSegmented
					aria-label='Density'
					value={s.density}
					options={['compact', 'cozy', 'roomy'] as const}
					onChange={(density) => update({ density })}
				/>
			</SettingRow>
			<SettingRow
				label='Effects'
				description='Scanlines, glows, sweeps and grain. "Off" is calmest and cheapest.'
			>
				<SettingSegmented
					aria-label='Effects'
					value={s.fx}
					options={['full', 'subtle', 'off'] as const}
					onChange={(fx) => update({ fx })}
				/>
			</SettingRow>
			<SettingRow
				label='Side bar'
				description={
					skin.layout.sidebar === 'drawer'
						? `${skin.name} slides the side bar in as a drawer.`
						: 'Which side the side bar sits on.'
				}
			>
				<SettingSegmented
					aria-label='Side bar'
					value={s.sidebarSide}
					options={['skin', 'left', 'right'] as const}
					onChange={(sidebarSide) => update({ sidebarSide })}
				/>
			</SettingRow>
			{skin.id === 'cyber' && (
				<>
					<SettingRow
						label='Glass'
						description='Blur and translucency on the panes. "Off" is fastest on integrated GPUs and battery.'
					>
						<SettingSegmented
							aria-label='Glass'
							value={s.glass}
							options={['full', 'subtle', 'off'] as const}
							onChange={(glass) => update({ glass })}
						/>
					</SettingRow>
					<SettingToggle
						label='Ambient background'
						description='The glow and drifting grid behind the glass.'
						value={s.ambient}
						onChange={(ambient) => update({ ambient })}
					/>
				</>
			)}
			<SettingToggle
				label='Tab tint'
				description='Tabs tinted by file type, with a red dot on files that have errors.'
				value={s.tabTint}
				onChange={(tabTint) => update({ tabTint })}
			/>
			<SettingToggle
				label='Reduce motion'
				description='Turns off animations and smooth scrolling (and calms every skin’s effects).'
				value={s.reduceMotion}
				onChange={(reduceMotion) => update({ reduceMotion })}
			/>
			<SettingStepper
				label='UI text size'
				value={s.uiFontSize}
				min={11}
				max={15}
				onChange={(uiFontSize) => update({ uiFontSize })}
			/>
		</div>
	);
}
