import { useQuery } from '@tanstack/react-query';
import { BarChart3, X } from 'lucide-react';
import type { JSX } from 'react';

import type { DataColumn } from '@shared/ipc/channels/data';

import { call } from '../../lib/ipc';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';
import {
	formatCount,
	formatStat,
	formatStatText,
	isNumericType,
	profileScope,
	typeTag,
} from './data-format';
import { Histogram } from './Histogram';

interface ColumnProfileProps {
	path: string;
	index: number | null;
	column: DataColumn | undefined;
	/** Only the head of the file was loaded, so the stats cover only those rows. */
	truncated: boolean;
	onClose: () => void;
}

function Stat({
	label,
	value,
	hint,
}: {
	label: string;
	value: string;
	hint?: string;
}): JSX.Element {
	return (
		<div className='flex min-w-0 flex-col gap-0.5 rounded-sm border border-border/60 bg-bg-2/40 px-2 py-1.5'>
			<dt className='hud'>{label}</dt>
			<dd className='num selectable truncate text-13 text-fg-0' title={value}>
				{value}
				{hint && <span className='ml-1 text-11 text-fg-2'>{hint}</span>}
			</dd>
		</div>
	);
}

/**
 * Same layout as the loaded profile, so stepping through columns with the arrow keys doesn't
 * collapse and re-expand the panel. Static on purpose: it only shows for a moment.
 */
function ProfileSkeleton({ numeric }: { numeric: boolean }): JSX.Element {
	const labels = ['Count', 'Nulls', 'Unique', 'Min', 'Max', ...(numeric ? ['Mean', 'Std'] : [])];
	return (
		<div className='flex flex-col gap-4' aria-busy='true'>
			<dl className='grid grid-cols-2 gap-1.5'>
				{labels.map((label) => (
					<Stat key={label} label={label} value={'\u00a0'} />
				))}
			</dl>
			<section className='flex flex-col gap-2'>
				<h4 className='hud flex items-center gap-2'>
					<Spinner size={12} label='Profiling column' />
					Profiling column
				</h4>
				{numeric ? (
					<div>
						<div className='h-28 rounded-t-sm border-b border-border bg-bg-2/40' />
						<div className='mt-1 text-10'>{'\u00a0'}</div>
					</div>
				) : (
					<ul className='flex flex-col gap-1'>
						{Array.from({ length: 6 }, (_, i) => (
							<li key={i} className='flex flex-col gap-0.5'>
								<span className='text-10'>{'\u00a0'}</span>
								<span className='h-1 rounded-full bg-bg-3' />
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}

function ProfileBody({
	path,
	index,
	column,
	truncated,
}: {
	path: string;
	index: number;
	column: DataColumn;
	truncated: boolean;
}): JSX.Element {
	const stats = useQuery({
		queryKey: ['data', 'stats', path, index],
		queryFn: () => call('data:stats', { path, column: index }),
	});

	if (stats.isPending) return <ProfileSkeleton numeric={isNumericType(column.type)} />;
	if (stats.isError) {
		return (
			<ErrorState
				title='Could not profile column'
				message={stats.error.message}
				onRetry={() => void stats.refetch()}
			/>
		);
	}

	const s = stats.data;
	const numeric = isNumericType(column.type);
	const total = s.count + s.nulls;
	const nullPct = total > 0 ? (s.nulls / total) * 100 : 0;
	return (
		<div className='flex flex-col gap-4'>
			<dl className='grid grid-cols-2 gap-1.5'>
				<Stat label='Count' value={formatCount(s.count)} />
				<Stat
					label='Nulls'
					value={formatCount(s.nulls)}
					hint={`${nullPct < 0.1 && s.nulls > 0 ? '<0.1' : nullPct.toFixed(1)}%`}
				/>
				<Stat label='Unique' value={formatCount(s.unique)} />
				<Stat label='Min' value={formatStatText(s.min, numeric)} />
				<Stat label='Max' value={formatStatText(s.max, numeric)} />
				{numeric && <Stat label='Mean' value={formatStat(s.mean)} />}
				{numeric && <Stat label='Std' value={formatStat(s.std)} />}
			</dl>
			<section className='flex flex-col gap-2'>
				<h4 className='hud'>{numeric ? 'Distribution' : 'Top values'}</h4>
				{s.histogram.length > 0 ? (
					<Histogram
						bins={s.histogram}
						numeric={numeric}
						edges={{
							min: formatStatText(s.min, true),
							max: formatStatText(s.max, true),
						}}
					/>
				) : (
					<p className='text-12 text-fg-2'>No values to chart.</p>
				)}
			</section>
			<p className='text-11 text-fg-2'>{profileScope(truncated, total)}</p>
		</div>
	);
}

export function ColumnProfile({
	path,
	index,
	column,
	truncated,
	onClose,
}: ColumnProfileProps): JSX.Element {
	return (
		<aside
			aria-label='Column profile'
			className='animate-in flex w-72 shrink-0 flex-col border-l border-glass-edge bg-bg-1/40'
		>
			<header className='flex h-9 shrink-0 items-center gap-2 border-b border-glass-edge pr-1 pl-3'>
				<span className='hud'>Column profile</span>
				<span className='flex-1' />
				<IconButton
					size='sm'
					label='Hide column profile'
					icon={<X size={14} />}
					onClick={onClose}
				/>
			</header>
			{index === null || !column ? (
				<EmptyState
					icon={<BarChart3 size={20} />}
					title='No column selected'
					description='Select a cell to profile its column.'
				/>
			) : (
				<div className='min-h-0 flex-1 overflow-y-auto p-3'>
					<div className='mb-3 flex min-w-0 items-center gap-2'>
						<span
							className='selectable truncate text-14 font-medium text-fg-0'
							title={column.name}
						>
							{column.name}
						</span>
						<span className='hud rounded-sm border border-border px-1 py-px leading-none'>
							{typeTag(column.type)}
						</span>
					</div>
					<ProfileBody path={path} index={index} column={column} truncated={truncated} />
				</div>
			)}
		</aside>
	);
}
