import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { JSX, ReactNode } from 'react';

import { REPO_URL } from '@shared/constants';
import { SECRET_SPECS } from '@shared/secrets';
import type { Settings } from '@shared/settings';

import {
	pickModel,
	PROVIDER_LABEL,
	saveAiSettings,
	useAiSettings,
} from '../../features/ai/ai-settings';
import { call } from '../../lib/ipc';
import { type SettingsTab, useUiStore } from '../../stores/ui-store';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Input } from '../../ui/Input';
import { Tabs } from '../../ui/Tabs';
import { useSettings } from '../hooks/use-settings';
import { AppearanceSettings } from './AppearanceSettings';
import { EditorSettings } from './EditorSettings';
import { SecretRow } from './SecretRow';
import { SettingRow } from './SettingRow';
import { SettingStepper } from './SettingStepper';
import { SettingToggle } from './SettingToggle';
import { UpdatesSetting } from './UpdatesSetting';

const SAVED_SECRETS_KEY = ['secrets', 'saved'] as const;

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
			<SettingToggle
				label='AI autocomplete'
				description='Suggestions appear in gray; Tab accepts, Esc dismisses.'
				value={s.ghostText}
				onChange={(ghostText) => update({ ghostText })}
			/>
			<SettingStepper
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
							content: pane(<AppearanceSettings s={settings} update={update} />),
						},
						{
							value: 'editor',
							label: 'Editor',
							content: pane(<EditorSettings s={settings} update={update} />),
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
