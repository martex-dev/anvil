import { type JSX, useState } from 'react';

import type { Settings } from '@shared/settings';

import {
	parseOllamaUrl,
	pickModel,
	PROVIDER_LABEL,
	saveAiSettings,
	useAiSettings,
} from '../../features/ai/ai-settings';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { ErrorState } from '../../ui/ErrorState';
import { Input } from '../../ui/Input';
import { SettingRow } from './SettingRow';
import { SettingStepper } from './SettingStepper';
import { SettingToggle } from './SettingToggle';
import { toastFailure } from './toast-failure';

export function AiSettings({
	s,
	update,
}: {
	s: Settings;
	update: (p: Partial<Settings>) => void;
}): JSX.Element {
	const { settings, keys, error, retry } = useAiSettings();
	// The typed URL until it is saved; then the box follows the saved settings again.
	const [draft, setDraft] = useState<string | null>(null);
	const [invalidUrl, setInvalidUrl] = useState(false);
	if (error)
		return (
			<ErrorState
				title='Could not load AI settings'
				message={error.message}
				onRetry={retry}
			/>
		);
	if (!settings) return <div className='shimmer h-24 rounded-md' />;
	const commitUrl = (text: string): void => {
		const url = parseOllamaUrl(text);
		setInvalidUrl(url === null);
		if (url === null) {
			toast.error(
				'Invalid Ollama URL',
				'Use http:// or https://, e.g. http://127.0.0.1:11434',
			);
			return;
		}
		if (url === settings.ollamaUrl) return setDraft(null);
		saveAiSettings({ ...settings, ollamaUrl: url })
			.then(() => setDraft(null))
			.catch(toastFailure('Could not save AI settings'));
	};
	return (
		<div className='divide-y divide-glass-edge'>
			<SettingRow
				label='Chat model'
				description={`Chat, inline edit (Ctrl+I) and one-click actions · ${PROVIDER_LABEL[settings.chat.provider]}${keys?.[settings.chat.provider] ? '' : ' · key missing'}`}
			>
				<Button
					size='sm'
					onClick={() =>
						pickModel('chat').catch(toastFailure('Could not set the chat model'))
					}
				>
					<span className='font-mono'>{settings.chat.model}</span>
				</Button>
			</SettingRow>
			<SettingRow
				label='Autocomplete model'
				description={`Ghost text while typing · ${PROVIDER_LABEL[settings.completion.provider]}. Pick something fast and cheap.`}
			>
				<Button
					size='sm'
					onClick={() =>
						pickModel('completion').catch(
							toastFailure('Could not set the autocomplete model'),
						)
					}
				>
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
				htmlFor='settings-ollama-url'
				description='Local models, no key needed (ollama serve). Enter or leaving the box saves.'
			>
				<Input
					id='settings-ollama-url'
					value={draft ?? settings.ollamaUrl}
					invalid={invalidUrl}
					spellCheck={false}
					className='w-56 font-mono text-12'
					onChange={(e) => {
						setDraft(e.target.value);
						setInvalidUrl(false);
					}}
					onKeyDown={(e) => {
						if (e.key === 'Enter') commitUrl(e.currentTarget.value);
					}}
					onBlur={(e) => {
						// Already flagged (Enter) and unchanged since: don't toast twice.
						if (invalidUrl) return;
						// An emptied box goes back to the saved URL instead of nagging.
						if (e.target.value.trim()) commitUrl(e.target.value);
						else setDraft(null);
					}}
				/>
			</SettingRow>
		</div>
	);
}
