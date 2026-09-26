import { TriangleAlert } from 'lucide-react';
import type { JSX } from 'react';

import { Button } from '../../ui/Button';
import { formatCount, PAGE_SIZE } from './data-format';
import type { PageFailure } from './use-data-pages';

interface RowErrorBannerProps {
	failures: PageFailure[];
	totalRows: number;
}

/** Explains rows that failed to load (they show as dashes in the grid) and retries them. */
export function RowErrorBanner({ failures, totalRows }: RowErrorBannerProps): JSX.Element | null {
	const first = failures[0];
	if (!first) return null;
	const from = first.page * PAGE_SIZE + 1;
	const to = Math.min(totalRows, (first.page + 1) * PAGE_SIZE);
	const more = failures.length > 1 ? ` (and ${failures.length - 1} more blocks)` : '';
	return (
		<div
			role='alert'
			className='flex shrink-0 items-center gap-2 border-t border-glass-edge bg-bg-1 px-3 py-1 text-12 text-fg-1'
		>
			<TriangleAlert size={13} className='shrink-0 text-down' />
			<span className='selectable min-w-0 flex-1 truncate' title={first.message}>
				Could not load rows {formatCount(from)}–{formatCount(to)}
				{more}: {first.message}
			</span>
			<Button size='sm' onClick={() => failures.forEach((f) => f.retry())}>
				Retry
			</Button>
		</div>
	);
}
