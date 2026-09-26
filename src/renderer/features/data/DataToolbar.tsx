import {
	ClipboardCopy,
	FileText,
	PanelRight,
	RefreshCw,
	Search,
	Table2,
	TriangleAlert,
	X,
} from 'lucide-react';
import type { JSX, RefObject } from 'react';

import type { DataPage } from '@shared/ipc/channels/data';

import { Badge } from '../../ui/Badge';
import { IconButton } from '../../ui/IconButton';
import { Input } from '../../ui/Input';
import { Spinner } from '../../ui/Spinner';
import { Tooltip } from '../../ui/Tooltip';
import { fileName, formatCount, isTextFormat, rowCountLabel } from './data-format';

interface DataToolbarProps {
	path: string;
	meta: DataPage | undefined;
	busy: boolean;
	filter: string;
	onFilterChange: (value: string) => void;
	onOpenAsText: () => void;
	onCopyCsv: () => void;
	copyLabel: string;
	onReload: () => void;
	profileOpen: boolean;
	onToggleProfile: () => void;
	/** The profile toggle; focus returns here when the profile panel closes itself. */
	profileToggleRef?: RefObject<HTMLButtonElement | null>;
	/** The filter box, focused by Ctrl+F and the "Filter Table Rows" command. */
	filterRef?: RefObject<HTMLInputElement | null>;
}

export function DataToolbar({
	path,
	meta,
	busy,
	filter,
	onFilterChange,
	onOpenAsText,
	onCopyCsv,
	copyLabel,
	onReload,
	profileOpen,
	onToggleProfile,
	profileToggleRef,
	filterRef,
}: DataToolbarProps): JSX.Element {
	const name = fileName(path);
	return (
		<div className='flex h-10 shrink-0 items-center gap-3 border-b border-glass-edge bg-bg-1/40 px-3'>
			<div className='flex min-w-0 items-center gap-2'>
				<Table2 size={14} className='shrink-0 text-accent' />
				<span className='truncate text-13 font-medium text-fg-0' title={path}>
					{name}
				</span>
				{meta && (
					<>
						<Badge tone='accent' className='uppercase'>
							{meta.format}
						</Badge>
						<span className='hud hidden shrink-0 lg:inline'>{meta.engine}</span>
					</>
				)}
			</div>
			{meta && (
				<span className='num shrink-0 text-12 text-fg-1'>
					<span className='text-fg-0'>
						{rowCountLabel(meta.totalRows, meta.loadedRows)}
					</span>{' '}
					× <span className='text-fg-0'>{formatCount(meta.columns.length)}</span> cols
				</span>
			)}
			{meta?.truncated && (
				<Tooltip content='Only the first rows of this very large file were loaded'>
					<span>
						<Badge tone='warn'>
							<TriangleAlert size={11} />
							Truncated
						</Badge>
					</span>
				</Tooltip>
			)}
			<span className='flex-1' />
			<Input
				ref={filterRef}
				className='w-56 shrink'
				leading={busy ? <Spinner size={12} label='Filtering' /> : <Search size={13} />}
				placeholder='Filter rows… (Ctrl+F)'
				aria-label='Filter rows (substring, any column)'
				value={filter}
				spellCheck={false}
				onChange={(e) => onFilterChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Escape' && filter) {
						e.stopPropagation();
						onFilterChange('');
					}
				}}
			/>
			{filter && (
				<IconButton
					size='sm'
					label='Clear filter'
					icon={<X size={14} />}
					onClick={() => onFilterChange('')}
				/>
			)}
			<div className='flex shrink-0 items-center gap-0.5'>
				{meta && isTextFormat(meta.format) && (
					<IconButton
						label='Open as text'
						icon={<FileText size={15} />}
						onClick={onOpenAsText}
					/>
				)}
				<IconButton
					label={copyLabel}
					icon={<ClipboardCopy size={15} />}
					onClick={onCopyCsv}
					disabled={!meta || meta.totalRows === 0}
				/>
				<IconButton
					label='Reload from disk'
					icon={<RefreshCw size={15} />}
					onClick={onReload}
				/>
				<IconButton
					ref={profileToggleRef}
					label={profileOpen ? 'Hide column profile' : 'Show column profile'}
					icon={<PanelRight size={15} />}
					active={profileOpen}
					onClick={onToggleProfile}
				/>
			</div>
		</div>
	);
}
