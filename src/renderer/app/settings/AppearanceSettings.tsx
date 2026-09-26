import type { JSX } from 'react';

import type { Settings } from '@shared/settings';

import { ThemeGallery } from '../../features/themes/ThemeGallery';
import { themeById } from '../../styles/theme-list';
import { AccentPicker } from './AccentPicker';
import { SettingRow } from './SettingRow';
import { SettingSegmented } from './SettingSegmented';
import { SettingStepper } from './SettingStepper';
import { SettingToggle } from './SettingToggle';

export function AppearanceSettings({
	s,
	update,
}: {
	s: Settings;
	update: (p: Partial<Settings>) => void;
}): JSX.Element {
	return (
		<div className='divide-y divide-glass-edge'>
			<div className='py-3'>
				<p className='text-13 text-fg-0'>Color theme</p>
				<p className='text-12 text-fg-2'>
					{themeById(s.theme).description}. Ctrl+Alt+T picks with a live preview.
				</p>
				<ThemeGallery value={s.theme} onChange={(theme) => update({ theme })} />
			</div>
			<SettingRow
				label='Accent'
				description='The neon that drives focus, cursor and highlights: the theme’s own, a preset, or any color.'
			>
				<AccentPicker s={s} update={update} />
			</SettingRow>
			<SettingRow
				label='Glass'
				description='Blur and translucency on the panes. "Off" is fastest on integrated GPUs and battery.'
			>
				<SettingSegmented
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
			<SettingToggle
				label='Tab tint'
				description='Tabs tinted by file type, with a red dot on files that have errors.'
				value={s.tabTint}
				onChange={(tabTint) => update({ tabTint })}
			/>
			<SettingToggle
				label='Reduce motion'
				description='Turns off animations and smooth scrolling.'
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
