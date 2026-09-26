import type { JSX } from 'react';

import { useEditorStore } from '../../features/editor/editor-store';
import { focusedTab, useTabsStore } from '../../stores/tabs-store';
import { StatusSeg } from './StatusSeg';

/** The focused file as vim prints it: `src/lab/strategy.py [+]`. */
export function StatusFile(): JSX.Element | null {
	const tab = useTabsStore(focusedTab);
	const dirty = useEditorStore((s) =>
		tab?.path ? Boolean(s.files.find((f) => f.path === tab.path)?.dirty) : false,
	);
	if (!tab) return null;
	return (
		<StatusSeg title={tab.path ?? tab.title} className='mf-seg-file'>
			<span className='truncate'>{tab.path ?? tab.title}</span>
			{dirty && <span className='text-warn'>[+]</span>}
		</StatusSeg>
	);
}
