import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCcw } from 'lucide-react';
import type { JSX } from 'react';

import { describeError } from '../../lib/global-errors';
import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { Switch } from '../../ui/Switch';
import { UPDATE_KEY, useInstallUpdate, useUpdateStatus } from '../hooks/use-update';
import { describeUpdate } from '../update-text';
import { SettingRow } from './SettingRow';

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
	const client = useQueryClient();
	const check = useMutation({
		mutationFn: () => call('update:check'),
		onSuccess: (next) => client.setQueryData(UPDATE_KEY, next),
		onError: (error) => toast.error('Update check failed', describeError(error)),
	});
	const { install, isPending: installing } = useInstallUpdate();
	const disabled = status.data?.state === 'disabled';
	// A check is already under way (or its download is): another click would only race it.
	const busy = status.data?.state === 'checking' || status.data?.state === 'downloading';
	return (
		<SettingRow
			label={`Updates · Anvil ${version.isError ? '(version unknown)' : (version.data ?? '')}`}
			description={describeUpdate(status.data)}
			htmlFor='auto-update'
		>
			<div className='flex items-center gap-3'>
				{status.data?.state === 'ready' ? (
					<Button
						size='sm'
						variant='primary'
						icon={<RefreshCcw size={12} />}
						loading={installing}
						onClick={install}
					>
						Restart to update
					</Button>
				) : (
					<Button
						size='sm'
						disabled={disabled || busy}
						loading={check.isPending || busy}
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
