import { ArrowDownToLine, RefreshCcw } from 'lucide-react';
import type { JSX } from 'react';

import { useInstallUpdate, useUpdateStatus } from './hooks/use-update';

/** Status bar: download progress, then a one-click restart once the update is ready. */
export function UpdateIndicator(): JSX.Element | null {
	const status = useUpdateStatus().data;
	const { install, isPending } = useInstallUpdate();
	if (status?.state === 'downloading') {
		return (
			<span
				className='num flex items-center gap-1'
				title={`Downloading Anvil ${status.version}`}
				data-update='downloading'
			>
				<ArrowDownToLine size={12} className='text-accent' />
				{status.percent}%
			</span>
		);
	}
	if (status?.state !== 'ready') return null;
	return (
		<button
			type='button'
			onClick={install}
			aria-disabled={isPending || undefined}
			className='flex items-center gap-1 rounded-sm px-1 text-accent hover:bg-bg-3 focus-visible:shadow-glow focus-visible:outline-none'
			title='Quit, install the update and reopen Anvil'
			data-update='ready'
		>
			<RefreshCcw size={12} />
			Restart to update {status.version}
		</button>
	);
}
