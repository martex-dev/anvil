import type { JSX } from 'react';

import { useProblems } from '../../features/problems/problems-store';
import { cn } from '../../lib/cn';
import { useLayoutStore } from '../../stores/layout-store';
import { StatusSeg } from './StatusSeg';

/** `E:0 W:2`, lit when non-zero; opens the problems panel. */
export function StatusProblems(): JSX.Element {
	const errors = useProblems((s) => s.errors);
	const warnings = useProblems((s) => s.warnings);
	return (
		<StatusSeg
			onClick={() => useLayoutStore.getState().togglePanel('problems')}
			title='Problems'
		>
			<span className={cn(errors > 0 ? 'text-down' : 'text-fg-2')}>E:{errors}</span>
			<span className={cn(warnings > 0 ? 'text-warn' : 'text-fg-2')}>W:{warnings}</span>
		</StatusSeg>
	);
}
