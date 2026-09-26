import type { JSX } from 'react';

import { shortcutFor } from '../../app/commands/run';
import { useWorkspace } from '../../app/hooks/use-workspace';
import { useEditorStore } from '../../features/editor/editor-store';
import { focusedTab, useTabsStore } from '../../stores/tabs-store';
import { useUiStore } from '../../stores/ui-store';
import { Fleuron } from './Fleuron';

/**
 * The running head of the page: the project in small caps, a fleuron, and the document in
 * italic. It doubles as the command center: click it (or Ctrl+P) to go to any file.
 */
export function DocumentTitle(): JSX.Element {
	const { info } = useWorkspace();
	const tab = useTabsStore(focusedTab);
	const dirty = useEditorStore((s) =>
		tab?.path ? Boolean(s.files.find((f) => f.path === tab.path)?.dirty) : false,
	);
	const openQuick = useUiStore((s) => s.openQuickOpen);
	const doc = tab ? (tab.kind === 'welcome' ? 'Welcome' : tab.title) : 'Untitled';
	const shortcut = shortcutFor('file.quickOpen') ?? 'Ctrl+P';
	return (
		<button
			type='button'
			data-part='command-center'
			onClick={() => openQuick('')}
			title={`Go to file, command or symbol (${shortcut})`}
			className='no-drag absolute left-1/2 flex max-w-[44vw] -translate-x-1/2 items-baseline gap-2.5 px-3 py-1 outline-none'
		>
			<span data-zen='project' className='truncate'>
				{info.name ?? 'Anvil'}
			</span>
			<Fleuron />
			<span data-zen='document' className='truncate'>
				{doc}
			</span>
			{dirty && <span data-zen='edited'>edited</span>}
		</button>
	);
}
