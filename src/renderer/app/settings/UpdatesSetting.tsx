import { useMutation, useQuery } from '@tanstack/react-query';
import { RefreshCcw } from 'lucide-react';
import type { JSX } from 'react';

import type { UpdateStatus } from '@shared/ipc/channels/update';

import { call } from '../../lib/ipc';
import { Button } from '../../ui/Button';
import { Switch } from '../../ui/Switch';
import { useUpdateStatus } from '../hooks/use-update';
import { SettingRow } from './SettingRow';

function describe(status: UpdateStatus | undefined): string {
	switch (status?.state) {
		case undefined:
			return '…';
		case 'disabled':
			return `Updates are off: ${status.reason.toLowerCase()}.`;
		case 'idle':
			return status.lastChecked
				? `Up to date (checked ${new Date(status.lastChecked).toLocaleString()}).`
				: 'Checks a minute after start, then every 6 hours.';
		case 'checking':
			return 'Checking…';
		case 'downloading':
			return `Downloading ${status.version}: ${status.percent}%`;
		case 'ready':
			return `${status.version} is downloaded: restart to install it.`;
		case 'error':
			return `Last check failed: ${status.message}`;
	}
}

export function UpdatesSetting({
	autoUpdate,
	onChange,
}: {
	autoUpdate: boolean;
	onChange: (autoUpdate: boolean) => void;
}): JSX.Element {
	const status = useUpdateStatus();
	const version = useQuery({
		queryKey: ['app', 'version'],
		queryFn: () => call('app:getVersion'),
	});
	const check = useMutation({ mutationFn: () => call('update:check') });
	const disabled = status.data?.state === 'disabled';
	return (
		<SettingRow
			label={`Updates · Anvil ${version.data ?? ''}`}
			description={describe(status.data)}
			htmlFor='auto-update'
		>
			<div className='flex items-center gap-3'>
				{status.data?.state === 'ready' ? (
					<Button
						size='sm'
						variant='primary'
						icon={<RefreshCcw size={12} />}
						onClick={() => void call('update:install')}
					>
						Restart to update
					</Button>
				) : (
					<Button
						size='sm'
						disabled={disabled}
						loading={check.isPending}
						onClick={() => check.mutate()}
					>
						Check now
					</Button>
				)}
				<Switch
					id='auto-update'
					aria-label='Check for updates automatically'
					checked={autoUpdate}
					disabled={disabled}
					onCheckedChange={onChange}
				/>
			</div>
		</SettingRow>
	);
}
