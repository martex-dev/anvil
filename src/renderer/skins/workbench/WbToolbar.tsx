import type { JSX } from 'react';

import { VIEW_META } from '../../app/ActivityBar';
import { runCommandById, shortcutFor } from '../../app/commands/run';
import { useGitStatus } from '../../features/git/use-git';
import { SIDE_VIEWS, useLayoutStore } from '../../stores/layout-store';
import { SkinIcon } from '../SkinIcon';
import { FLOPPY, NEW_DOCUMENT, OPEN_FOLDER } from './art-tools';
import { PixelIcon } from './PixelIcon';
import { QuickOpenField } from './QuickOpenField';
import { ToolButton } from './ToolButton';

function Separator(): JSX.Element {
	return <span aria-hidden className='wb-tool-separator' />;
}

function Command({
	id,
	label,
	children,
}: {
	id: string;
	label: string;
	children: JSX.Element;
}): JSX.Element {
	return (
		<ToolButton label={label} shortcut={shortcutFor(id)} onClick={() => runCommandById(id)}>
			{children}
		</ToolButton>
	);
}

/**
 * The views switcher as a 1995 toolbar: file buttons, the side views as toggle buttons, run
 * and window toggles, then an address box for Quick Open.
 */
export function WbToolbar(): JSX.Element {
	const { status } = useGitStatus();
	const changes = status?.isRepo ? status.staged.length + status.unstaged.length : 0;
	const current = useLayoutStore((s) => (s.sideOpen ? s.sideView : null));
	const panelOpen = useLayoutStore((s) => s.panelOpen);
	const aiOpen = useLayoutStore((s) => s.aiOpen);
	return (
		<nav
			aria-label='Views'
			data-part='activity'
			data-orientation='horizontal'
			data-placement='top'
			className='wb-toolbar'
		>
			<span aria-hidden className='wb-grip' />
			<Command id='file.new' label='New file'>
				<PixelIcon art={NEW_DOCUMENT} />
			</Command>
			<Command id='file.openFolder' label='Open folder'>
				<PixelIcon art={OPEN_FOLDER} />
			</Command>
			<Command id='file.save' label='Save'>
				<PixelIcon art={FLOPPY} />
			</Command>
			<Separator />
			{SIDE_VIEWS.map((view, i) => (
				<ToolButton
					key={view}
					label={VIEW_META[view].label}
					shortcut={shortcutFor(VIEW_META[view].command)}
					view={view}
					index={i + 1}
					active={current === view}
					onClick={() => useLayoutStore.getState().toggleView(view)}
					{...(view === 'git' ? { badge: changes } : {})}
				>
					<SkinIcon name={view} />
				</ToolButton>
			))}
			<Separator />
			<Command id='python.runFile' label='Run Python file'>
				<SkinIcon name='play' />
			</Command>
			<ToolButton
				label='Terminal'
				shortcut={shortcutFor('view.togglePanel')}
				active={panelOpen}
				onClick={() => useLayoutStore.getState().togglePanel()}
			>
				<SkinIcon name='terminal' />
			</ToolButton>
			<ToolButton
				label='AI assistant'
				shortcut={shortcutFor('view.toggleAi')}
				view='ai'
				active={aiOpen}
				onClick={() => useLayoutStore.getState().toggleAi()}
			>
				<SkinIcon name='ai' />
			</ToolButton>
			<span data-part='activity-spacer' className='min-w-2 flex-1' />
			<QuickOpenField />
			<Separator />
			<ToolButton
				label='Settings'
				shortcut={shortcutFor('anvil.settings')}
				view='settings'
				onClick={() => runCommandById('anvil.settings')}
			>
				<SkinIcon name='settings' />
			</ToolButton>
		</nav>
	);
}
