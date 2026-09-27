import { type JSX, lazy, Suspense, useState } from 'react';

import { ExplorerPanel } from '../features/explorer/ExplorerPanel';
import { GitPanel } from '../features/git/GitPanel';
import { SearchPanel } from '../features/search/SearchPanel';
import { cn } from '../lib/cn';
import { SIDE_VIEWS, type SideView, useLayoutStore } from '../stores/layout-store';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Spinner } from '../ui/Spinner';
import { VIEW_META } from './ActivityBar';
import { SideViewVisibleContext } from './side-view-visible';

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

/**
 * The left pane: one view at a time, with a HUD header ("02 / SEARCH"). A view mounts the first
 * time it is shown and then stays mounted, hidden, so switching away and back keeps its state
 * (open folders, a search, a half-written commit message, scroll positions).
 */
export function SideBar(): JSX.Element {
	const view = useLayoutStore((s) => s.sideView);
	const index = SIDE_VIEWS.indexOf(view) + 1;
	const [visited, setVisited] = useState<ReadonlySet<SideView>>(() => new Set([view]));
	if (!visited.has(view)) setVisited(new Set([...visited, view]));
	return (
		<aside
			aria-label={VIEW_META[view].label}
			data-part='sidebar'
			data-view={view}
			className='glass pane-focus animate-fade flex h-full min-w-0 flex-col overflow-hidden'
		>
			<header
				data-part='pane-header'
				className='flex h-9 shrink-0 items-center gap-2 border-b border-glass-edge px-3'
			>
				<span data-part='pane-index' className='num text-10 text-accent'>
					{String(index).padStart(2, '0')}
				</span>
				<span data-part='pane-rule' className='h-3 w-px bg-glass-edge' />
				<h2 data-part='pane-title' className='hud text-fg-1'>
					{VIEW_META[view].label}
				</h2>
			</header>
			<div data-part='pane-body' className='min-h-0 flex-1'>
				{SIDE_VIEWS.filter((v) => visited.has(v)).map((v) => (
					// The fade class is only on the shown view, so switching fades the new one in.
					<div
						key={v}
						data-side-view={v}
						hidden={v !== view}
						className={cn('h-full', v === view && 'animate-fade')}
					>
						<SideViewVisibleContext value={v === view}>
							<ErrorBoundary name={VIEW_META[v].label}>
								<Suspense
									fallback={
										<div className='flex h-24 items-center justify-center'>
											<Spinner />
										</div>
									}
								>
									<View view={v} />
								</Suspense>
							</ErrorBoundary>
						</SideViewVisibleContext>
					</div>
				))}
			</div>
		</aside>
	);
}
