import { type JSX, lazy, Suspense } from 'react';

import { ExplorerPanel } from '../features/explorer/ExplorerPanel';
import { GitPanel } from '../features/git/GitPanel';
import { SearchPanel } from '../features/search/SearchPanel';
import { SIDE_VIEWS, type SideView, useLayoutStore } from '../stores/layout-store';
import { Spinner } from '../ui/Spinner';
import { VIEW_META } from './ActivityBar';

const RunView = lazy(() =>
	import('../features/python/RunView').then((m) => ({ default: m.RunView })),
);
const OutlineView = lazy(() =>
	import('../features/outline/OutlineView').then((m) => ({ default: m.OutlineView })),
);
const TodoView = lazy(() =>
	import('../features/todos/TodoView').then((m) => ({ default: m.TodoView })),
);
const HistoryView = lazy(() =>
	import('../features/history/HistoryView').then((m) => ({ default: m.HistoryView })),
);
const SnippetsView = lazy(() =>
	import('../features/snippets/SnippetsView').then((m) => ({ default: m.SnippetsView })),
);
const ToolboxView = lazy(() =>
	import('../features/toolbox/ToolboxView').then((m) => ({ default: m.ToolboxView })),
);

function View({ view }: { view: SideView }): JSX.Element {
	switch (view) {
		case 'explorer':
			return <ExplorerPanel />;
		case 'search':
			return <SearchPanel />;
		case 'git':
			return <GitPanel />;
		case 'run':
			return <RunView />;
		case 'outline':
			return <OutlineView />;
		case 'todos':
			return <TodoView />;
		case 'history':
			return <HistoryView />;
		case 'snippets':
			return <SnippetsView />;
		case 'toolbox':
			return <ToolboxView />;
	}
}

/** The left pane: one view at a time, with a HUD header ("02 / SEARCH"). */
export function SideBar(): JSX.Element {
	const view = useLayoutStore((s) => s.sideView);
	const index = SIDE_VIEWS.indexOf(view) + 1;
	return (
		<aside
			aria-label={VIEW_META[view].label}
			className='glass pane-focus flex h-full min-w-0 flex-col overflow-hidden'
		>
			<header className='flex h-9 shrink-0 items-center gap-2 border-b border-glass-edge px-3'>
				<span className='num text-10 text-accent'>{String(index).padStart(2, '0')}</span>
				<span className='h-3 w-px bg-glass-edge' />
				<h2 className='hud text-fg-1'>{VIEW_META[view].label}</h2>
			</header>
			<div className='min-h-0 flex-1'>
				<Suspense
					fallback={
						<div className='flex h-24 items-center justify-center'>
							<Spinner />
						</div>
					}
				>
					<View view={view} />
				</Suspense>
			</div>
		</aside>
	);
}
