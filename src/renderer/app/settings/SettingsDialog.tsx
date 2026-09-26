import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type JSX, type ReactNode } from 'react';

import { REPO_URL } from '@shared/constants';
import { SECRET_SPECS } from '@shared/secrets';
import { ACCENTS, type Settings } from '@shared/settings';

import {
	pickModel,
	PROVIDER_LABEL,
	saveAiSettings,
	useAiSettings,
} from '../../features/ai/ai-settings';
import { repaintShield } from '../../features/editor/extras/shield';
import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { type SettingsTab, useUiStore } from '../../stores/ui-store';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Input } from '../../ui/Input';
import { Switch } from '../../ui/Switch';
import { Tabs } from '../../ui/Tabs';
import { useSettings } from '../hooks/use-settings';
import { SecretRow } from './SecretRow';
import { SettingRow } from './SettingRow';
import { UpdatesSetting } from './UpdatesSetting';

const SAVED_SECRETS_KEY = ['secrets', 'saved'] as const;

function Toggle({
	label,
	description,
	value,
	onChange,
}: {
	label: string;
	description?: ReactNode;
	value: boolean;
	onChange: (v: boolean) => void;
}): JSX.Element {
	const id = `set-${label.replace(/\W+/g, '-').toLowerCase()}`;
	return (
		<SettingRow label={label} description={description} htmlFor={id}>
			<Switch id={id} aria-label={label} checked={value} onCheckedChange={onChange} />
		</SettingRow>
	);
}

function Stepper({
	label,
	description,
	value,
	min,
	max,
	onChange,
}: {
	label: string;
	description?: string;
	value: number;
	min: number;
	max: number;
	onChange: (v: number) => void;
}): JSX.Element {
	return (
		<SettingRow label={label} description={description}>
			<div className='flex items-center gap-1'>
				<Button
					size='sm'
					variant='ghost'
					disabled={value <= min}
					onClick={() => onChange(value - 1)}
					aria-label={`Decrease ${label}`}
				>
					−
				</Button>
				<span className='num w-8 text-center text-13 text-fg-0'>{value}</span>
				<Button
					size='sm'
					variant='ghost'
					disabled={value >= max}
					onClick={() => onChange(value + 1)}
					aria-label={`Increase ${label}`}
				>
					+
				</Button>
			</div>
		</SettingRow>
	);
}

function Segmented<T extends string>({
	value,
	options,
	onChange,
}: {
	value: T;
	options: readonly T[];
	onChange: (v: T) => void;
}): JSX.Element {
	return (
		<div
			role='radiogroup'
			className='flex overflow-hidden rounded-md border border-border-strong'
		>
			{options.map((o) => (
				<button
					key={o}
					type='button'
					role='radio'
					aria-checked={o === value}
					onClick={() => onChange(o)}
					className={cn(
						'px-2.5 py-1 text-12 capitalize',
						o === value ? 'bg-accent-soft text-fg-0' : 'text-fg-2 hover:text-fg-1',
					)}
				>
					{o}
				</button>
			))}
		</div>
	);
}

function Appearance({
	s,
	update,
}: {
	s: Settings;
	update: (p: Partial<Settings>) => void;
}): JSX.Element {
	return (
		<div className='divide-y divide-glass-edge'>
			<SettingRow
				label='Accent'
				description='One neon color drives focus, cursor and highlights.'
			>
				<div className='flex gap-1.5'>
					{ACCENTS.map((a) => (
						<button
							key={a}
							type='button'
							aria-label={a}
							aria-pressed={s.accent === a}
							onClick={() => update({ accent: a })}
							className={cn(
								'size-6 rounded-full outline-none transition-transform transition-fast hover:scale-110 focus-visible:shadow-glow',
								s.accent === a &&
									'outline-2 outline-offset-2 outline-fg-0 outline-solid',
							)}
							style={{
								background: `var(--accent-${a})`,
								boxShadow: `0 0 12px -2px var(--accent-${a})`,
							}}
						/>
					))}
				</div>
			</SettingRow>
			<SettingRow
				label='Glass'
				description='Blur and translucency on the panes. "Off" is fastest on integrated GPUs and battery.'
			>
				<Segmented
					value={s.glass}
					options={['full', 'subtle', 'off'] as const}
					onChange={(glass) => update({ glass })}
				/>
			</SettingRow>
			<Toggle
				label='Ambient background'
				description='The glow and drifting grid behind the glass.'
				value={s.ambient}
				onChange={(ambient) => update({ ambient })}
			/>
			<Toggle
				label='Reduce motion'
				description='Turns off animations and smooth scrolling.'
				value={s.reduceMotion}
				onChange={(reduceMotion) => update({ reduceMotion })}
			/>
			<Stepper
				label='UI text size'
				value={s.uiFontSize}
				min={11}
				max={15}
				onChange={(uiFontSize) => update({ uiFontSize })}
			/>
		</div>
	);
}

function Editor({
	s,
	update,
}: {
	s: Settings;
	update: (p: Partial<Settings>) => void;
}): JSX.Element {
	return (
		<div className='divide-y divide-glass-edge'>
			<Stepper
				label='Font size'
				description='Ctrl+= / Ctrl+- also work.'
				value={s.editorFontSize}
				min={10}
				max={24}
				onChange={(editorFontSize) => update({ editorFontSize })}
			/>
			<Stepper
				label='Tab size'
				value={s.tabSize}
				min={1}
				max={8}
				onChange={(tabSize) => update({ tabSize })}
			/>
			<Toggle
				label='Font ligatures'
				description='JetBrains Mono ligatures (=> != >=).'
				value={s.editorLigatures}
				onChange={(editorLigatures) => update({ editorLigatures })}
			/>
			<Toggle
				label='Word wrap'
				value={s.wordWrap}
				onChange={(wordWrap) => update({ wordWrap })}
			/>
			<Toggle label='Minimap' value={s.minimap} onChange={(minimap) => update({ minimap })} />
			<Toggle
				label='Format Python on save'
				description='Runs ruff format from the selected environment (or PATH).'
				value={s.formatOnSave}
				onChange={(formatOnSave) => update({ formatOnSave })}
			/>
			<Toggle
				label='Local history'
				description='Snapshot every save (50 per file, 30 days) so you can roll back without git.'
				value={s.localHistory}
				onChange={(localHistory) => update({ localHistory })}
			/>
			<Toggle
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

function Ai({ s, update }: { s: Settings; update: (p: Partial<Settings>) => void }): JSX.Element {
	const { settings, keys } = useAiSettings();
	if (!settings) return <div className='shimmer h-24 rounded-md' />;
	return (
		<div className='divide-y divide-glass-edge'>
			<SettingRow
				label='Chat model'
				description={`Chat, inline edit (Ctrl+I) and one-click actions · ${PROVIDER_LABEL[settings.chat.provider]}${keys?.[settings.chat.provider] ? '' : ' · key missing'}`}
			>
				<Button size='sm' onClick={() => void pickModel('chat')}>
					<span className='font-mono'>{settings.chat.model}</span>
				</Button>
			</SettingRow>
			<SettingRow
				label='Autocomplete model'
				description={`Ghost text while typing · ${PROVIDER_LABEL[settings.completion.provider]}. Pick something fast and cheap.`}
			>
				<Button size='sm' onClick={() => void pickModel('completion')}>
					<span className='font-mono'>{settings.completion.model}</span>
				</Button>
			</SettingRow>
			<Toggle
				label='AI autocomplete'
				description='Suggestions appear in gray; Tab accepts, Esc dismisses.'
				value={s.ghostText}
				onChange={(ghostText) => update({ ghostText })}
			/>
			<Stepper
				label='Autocomplete delay (×50 ms)'
				description='Wait this long after you stop typing before asking.'
				value={Math.round(s.ghostDelayMs / 50)}
				min={2}
				max={40}
				onChange={(v) => update({ ghostDelayMs: v * 50 })}
			/>
			<SettingRow
				label='Ollama server'
				description='Local models, no key needed (ollama serve).'
			>
				<Input
					key={settings.ollamaUrl}
					defaultValue={settings.ollamaUrl}
					className='w-56 font-mono text-12'
					onBlur={(e) => {
						const url = e.target.value.trim();
						if (url && url !== settings.ollamaUrl)
							void saveAiSettings({ ...settings, ollamaUrl: url });
					}}
				/>
			</SettingRow>
		</div>
	);
}

function Keys(): JSX.Element {
	const client = useQueryClient();
	const saved = useQuery({
		queryKey: SAVED_SECRETS_KEY,
		queryFn: () => call('secrets:listSaved'),
	});
	const set = new Set(saved.data ?? []);
	return (
		<div className='flex flex-col gap-3'>
			<p className='text-12 text-fg-2'>
				Encrypted with Windows DPAPI and kept in the main process only. A saved key is never
				shown again or sent to the UI.
			</p>
			<ul className='divide-y divide-glass-edge rounded-lg border border-glass-edge'>
				{SECRET_SPECS.map((spec) => (
					<SecretRow
						key={spec.key}
						spec={spec}
						isSaved={set.has(spec.key)}
						onChanged={() =>
							void client.invalidateQueries({ queryKey: SAVED_SECRETS_KEY })
						}
					/>
				))}
			</ul>
		</div>
	);
}

function About({
	s,
	update,
}: {
	s: Settings;
	update: (p: Partial<Settings>) => void;
}): JSX.Element {
	const version = useQuery({
		queryKey: ['app', 'version'],
		queryFn: () => call('app:getVersion'),
	});
	return (
		<div className='flex flex-col gap-4'>
			<div className='flex items-center gap-4 py-2'>
				<span className='relative flex size-12 items-center justify-center'>
					<span className='accent-gradient absolute size-8 rotate-45 shadow-glow' />
					<span className='absolute size-3 rotate-45 bg-bg-1' />
				</span>
				<div>
					<p className='text-gradient font-mono text-20 font-bold tracking-[0.3em]'>
						ANVIL
					</p>
					<p className='num text-12 text-fg-2'>
						v{version.data ?? '…'} · an AI code editor for quant, trading, crypto, ML
						and data work
					</p>
				</div>
			</div>
			<UpdatesSetting
				autoUpdate={s.autoUpdate}
				onChange={(autoUpdate) => update({ autoUpdate })}
			/>
			<div className='flex gap-2'>
				<Button size='sm' onClick={() => void call('app:openExternal', REPO_URL)}>
					Source on GitHub
				</Button>
				<Button size='sm' variant='ghost' onClick={() => void call('app:openLogs')}>
					Open logs
				</Button>
			</div>
		</div>
	);
}

export function SettingsDialog(): JSX.Element {
	const open = useUiStore((st) => st.settingsOpen);
	const setOpen = useUiStore((st) => st.setSettingsOpen);
	const tab = useUiStore((st) => st.settingsTab);
	const setTab = useUiStore((st) => st.setSettingsTab);
	const { settings, update } = useSettings();
	const pane = (node: ReactNode): JSX.Element => <div className='px-5 py-2'>{node}</div>;
	return (
		<Dialog open={open} onOpenChange={setOpen} title='Settings' width='lg'>
			<div className='-mx-4 -my-3 h-[62vh]'>
				<Tabs
					aria-label='Settings sections'
					orientation='vertical'
					value={tab}
					onValueChange={(v) => setTab(v as SettingsTab)}
					className='h-full'
					items={[
						{
							value: 'appearance',
							label: 'Appearance',
							content: pane(<Appearance s={settings} update={update} />),
						},
						{
							value: 'editor',
							label: 'Editor',
							content: pane(<Editor s={settings} update={update} />),
						},
						{
							value: 'ai',
							label: 'AI',
							content: pane(<Ai s={settings} update={update} />),
						},
						{ value: 'keys', label: 'API Keys', content: pane(<Keys />) },
						{
							value: 'about',
							label: 'About',
							content: pane(<About s={settings} update={update} />),
						},
					]}
				/>
			</div>
		</Dialog>
	);
}
