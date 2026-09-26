import type { JSX } from 'react';

import { runCommandById, shortcutFor } from '../../app/commands/run';
import type { CommandCategory } from '../../app/commands/types';
import { useWorkspace } from '../../app/hooks/use-workspace';
import { WindowControls } from '../../app/WindowControls';
import { PythonEnvChip } from '../../features/python/PythonEnvChip';
import { useLayoutStore } from '../../stores/layout-store';
import { focusedTab, useTabsStore } from '../../stores/tabs-store';
import { useUiStore } from '../../stores/ui-store';
import { IconButton } from '../../ui/IconButton';
import { SkinIcon } from '../SkinIcon';
import { PosterMenu } from './PosterMenu';

const MENUS: Array<{ label: string; categories: CommandCategory[] }> = [
	{ label: 'File', categories: ['File'] },
	{ label: 'Edit', categories: ['Edit'] },
	{ label: 'View', categories: ['View'] },
	{ label: 'Go', categories: ['Go'] },
	{ label: 'Run', categories: ['Run', 'Python', 'Terminal'] },
	{ label: 'AI', categories: ['AI'] },
	{ label: 'Git', categories: ['Git'] },
	{ label: 'Tools', categories: ['Tools', 'Anvil'] },
];

/** The file in front, as the poster's running head: PROJECT / SRC / LAB / FILE.PY. */
function RunningHead(): JSX.Element {
	const { info } = useWorkspace();
	const tab = useTabsStore((s) => focusedTab(s));
	const parts = tab?.path ? tab.path.split(/[\\/]/) : tab ? [tab.title] : [];
	const file = parts.at(-1) ?? 'No file';
	const dirs = parts.slice(0, -1);
	return (
		<div className='cc-head' title={tab?.path ?? undefined}>
			<span className='cc-head-project'>{info.name ?? 'Anvil'}</span>
			{dirs.map((d, i) => (
				<span key={`${d}-${i}`} className='cc-head-dir'>
					{d}
				</span>
			))}
			<span className='cc-head-file'>{file}</span>
		</div>
	);
}

/**
 * The title band: a solid ink strip with ANVIL set at poster size on an accent block, the menus
 * as bold words, the running head, a search box and square window boxes. It drags the window.
 */
export function PosterTitleBar(): JSX.Element {
	const openQuick = useUiStore((s) => s.openQuickOpen);
	const layout = useLayoutStore();
	return (
		<header data-part='titlebar' className='cc-band cc-title drag relative z-20 shrink-0'>
			<div data-part='brand' className='cc-brand'>
				<span className='cc-brand-word'>Anvil</span>
				<span className='cc-brand-cap' aria-hidden>
					<span>Code</span>
					<span>Editor</span>
				</span>
			</div>
			<nav data-part='menubar' className='cc-menus' aria-label='Menu'>
				{MENUS.map((m) => (
					<PosterMenu key={m.label} {...m} />
				))}
			</nav>
			<RunningHead />
			<button
				type='button'
				data-part='command-center'
				onClick={() => openQuick('')}
				className='cc-find no-drag'
			>
				<SkinIcon name='search' size={14} />
				<span className='cc-find-text'>Find anything</span>
				<span className='cc-find-key'>{shortcutFor('file.quickOpen') ?? 'Ctrl+P'}</span>
			</button>
			<div data-part='title-actions' className='cc-actions no-drag'>
				<PythonEnvChip compact />
				<IconButton
					size='md'
					label='Run Python file'
					shortcut={shortcutFor('python.runFile')}
					icon={<SkinIcon name='play' size={14} />}
					onClick={() => runCommandById('python.runFile')}
					className='cc-tbtn cc-tbtn-run'
				/>
				<IconButton
					size='md'
					label='Toggle side bar'
					shortcut={shortcutFor('view.toggleSide')}
					active={layout.sideOpen}
					icon={<SkinIcon name='sidebar' size={15} />}
					onClick={layout.toggleSide}
					className='cc-tbtn'
				/>
				<IconButton
					size='md'
					label='Toggle panel'
					shortcut={shortcutFor('view.togglePanel')}
					active={layout.panelOpen}
					icon={<SkinIcon name='panel' size={15} />}
					onClick={() => layout.togglePanel()}
					className='cc-tbtn'
				/>
				<IconButton
					size='md'
					label='Toggle AI'
					shortcut={shortcutFor('view.toggleAi')}
					active={layout.aiOpen}
					icon={<SkinIcon name='ai' size={15} />}
					onClick={() => layout.toggleAi()}
					className='cc-tbtn'
				/>
			</div>
			<WindowControls />
		</header>
	);
}
