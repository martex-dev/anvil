import type { JSX } from 'react';

import { Spinner } from '../../ui/Spinner';
import type { TreeRow } from './tree-model';

/** A folder's placeholder row while its listing loads, or the reason it failed. */
export function TreeStatusRow({
	row,
}: {
	row: Extract<TreeRow, { kind: 'loading' | 'error' }>;
}): JSX.Element {
	const style = { paddingLeft: 8 + row.depth * 12 + 16 };
	if (row.kind === 'loading') {
		return (
			<div className='flex h-6 items-center' style={style}>
				<Spinner size={12} />
			</div>
		);
	}
	return (
		<div
			className='flex h-6 items-center truncate text-11 text-down'
			style={style}
			title={row.message}
		>
			{row.message}
		</div>
	);
}
