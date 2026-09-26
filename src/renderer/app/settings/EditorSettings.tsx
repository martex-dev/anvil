import type { JSX } from 'react';

import { EDITOR_FONTS, type Settings } from '@shared/settings';

import { repaintShield } from '../../features/editor/extras/shield';
import { resolveLook } from '../../skins/look';
import { Select } from '../../ui/Select';
import { SettingRow } from './SettingRow';
import { SettingSegmented } from './SettingSegmented';
import { SettingStepper } from './SettingStepper';
import { SettingToggle } from './SettingToggle';

const LINE_HEIGHTS = ['1.3', '1.45', '1.55', '1.65', '1.8', '2'];

export function EditorSettings({
	s,
	update,
}: {
	s: Settings;
	update: (p: Partial<Settings>) => void;
}): JSX.Element {
	const look = resolveLook(s);
	const font = EDITOR_FONTS.find((f) => f.id === look.codeFontId);
	const skinFont = EDITOR_FONTS.find((f) => f.id === look.skin.fonts.code)?.name ?? '';
	return (
		<div className='divide-y divide-glass-edge'>
			<SettingRow
				label='Font'
				description='All bundled: no install needed. Any font works with any skin.'
			>
				<Select
					aria-label='Editor font'
					value={s.editorFont}
					onValueChange={(v) => update({ editorFont: v as Settings['editorFont'] })}
					options={[
						{ value: 'skin', label: `Skin default (${skinFont})` },
						...EDITOR_FONTS.map((f) => ({
							value: f.id,
							label: f.ligatures ? f.name : `${f.name} (no ligatures)`,
						})),
					]}
					className='w-52'
				/>
			</SettingRow>
			<SettingStepper
				label='Font size'
				description='Ctrl+= / Ctrl+- also work.'
				value={s.editorFontSize}
				min={10}
				max={24}
				onChange={(editorFontSize) => update({ editorFontSize })}
			/>
			<SettingRow label='Line height' description='Air between lines, relative to font size.'>
				<SettingSegmented
					value={String(s.editorLineHeight)}
					options={LINE_HEIGHTS}
					onChange={(v) => update({ editorLineHeight: Number(v) })}
				/>
			</SettingRow>
			<SettingRow label='Cursor'>
				<SettingSegmented
					value={s.cursorStyle}
					options={['line', 'block', 'underline'] as const}
					onChange={(cursorStyle) => update({ cursorStyle })}
				/>
			</SettingRow>
			<SettingToggle
				label='Neon cursor'
				description='The cursor glows in the accent color.'
				value={s.neonCursor}
				onChange={(neonCursor) => update({ neonCursor })}
			/>
			<SettingToggle
				label='Font ligatures'
				description={
					font?.ligatures === false
						? `${font.name} has none; applies to the other fonts.`
						: 'Joined symbols like => != >=.'
				}
				value={s.editorLigatures}
				onChange={(editorLigatures) => update({ editorLigatures })}
			/>
			<SettingStepper
				label='Tab size'
				value={s.tabSize}
				min={1}
				max={8}
				onChange={(tabSize) => update({ tabSize })}
			/>
			<SettingToggle
				label='Rainbow indentation'
				description='Each indent level gets its own faint tint, so deep nesting stays readable.'
				value={s.rainbowIndent}
				onChange={(rainbowIndent) => update({ rainbowIndent })}
			/>
			<SettingToggle
				label='Error lens'
				description='Errors and warnings written at the end of their line.'
				value={s.errorLens}
				onChange={(errorLens) => update({ errorLens })}
			/>
			<SettingToggle
				label='TODO highlight'
				description='TODO, FIXME, HACK and NOTE in comments get their own colors.'
				value={s.todoHighlight}
				onChange={(todoHighlight) => update({ todoHighlight })}
			/>
			<SettingToggle
				label='Color swatches'
				description='Inline swatches and a picker for #hex, rgb() and hsl() in any file.'
				value={s.colorSwatches}
				onChange={(colorSwatches) => update({ colorSwatches })}
			/>
			<SettingToggle
				label='Word wrap'
				description='Alt+Z toggles it from the editor.'
				value={s.wordWrap}
				onChange={(wordWrap) => update({ wordWrap })}
			/>
			<SettingToggle
				label='Minimap'
				value={s.minimap}
				onChange={(minimap) => update({ minimap })}
			/>
			<SettingToggle
				label='Trim trailing whitespace on save'
				value={s.trimTrailingWhitespace}
				onChange={(trimTrailingWhitespace) => update({ trimTrailingWhitespace })}
			/>
			<SettingToggle
				label='Final newline on save'
				description='Make sure every saved file ends with a newline.'
				value={s.insertFinalNewline}
				onChange={(insertFinalNewline) => update({ insertFinalNewline })}
			/>
			<SettingToggle
				label='Format Python on save'
				description='Runs ruff format from the selected environment (or PATH).'
				value={s.formatOnSave}
				onChange={(formatOnSave) => update({ formatOnSave })}
			/>
			<SettingToggle
				label='Local history'
				description='Snapshot every save (50 per file, 30 days) so you can roll back without git.'
				value={s.localHistory}
				onChange={(localHistory) => update({ localHistory })}
			/>
			<SettingToggle
				label='Secret shield'
				description='Blur .env values, flag API keys, private keys and seed phrases in code, and block commits that stage them.'
				value={s.secretShield}
				onChange={(secretShield) => {
					update({ secretShield });
					setTimeout(repaintShield, 50);
				}}
			/>
		</div>
	);
}
