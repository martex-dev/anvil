import {
	type ComponentType,
	type JSX,
	lazy,
	type ReactNode,
	Suspense,
	useEffect,
	useRef,
} from 'react';
import { useShallow } from 'zustand/react/shallow';

import { EditorArea } from '../features/editor/EditorArea';
import { cn } from '../lib/cn';
import { useLook } from '../skins/look-store';
import { useLayoutStore } from '../stores/layout-store';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Spinner } from '../ui/Spinner';
import { ActivityRail } from './ActivityRail';
import { BottomPanel } from './BottomPanel';
import { PaneSplitter } from './PaneSplitter';
import { SideBar } from './SideBar';
import { SideDrawer } from './SideDrawer';

const ChatPanel = lazy(() =>
	import('../features/ai/ChatPanel').then((m) => ({ default: m.ChatPanel })),
);

const resize: ReturnType<typeof useLayoutStore.getState>['resize'] = (patch) =>
	useLayoutStore.getState().resize(patch);

/*
 * Pane sizes are read by these small wrappers, not by the panes around them, so a splitter drag
 * (a store update per pointermove) re-renders only the resized wrapper. Their children are
 * elements created by the parent, which React skips when the wrapper re-renders.
 */
function SideWidth({ children }: { children: ReactNode }): JSX.Element {
	const width = useLayoutStore((s) => s.sideWidth);
	return (
		<div data-part='sidebar-slot' className='min-w-0 shrink-0' style={{ width }}>
			{children}
		</div>
	);
}

function PanelHeight({ children }: { children: ReactNode }): JSX.Element {
	const maximized = useLayoutStore((s) => s.panelMaximized);
	const height = useLayoutStore((s) => s.panelHeight);
	return (
		<div
			className={maximized ? 'min-h-0 flex-1' : 'shrink-0'}
			style={maximized ? undefined : { height }}
		>
			{children}
		</div>
	);
}

function AiWidth({ children }: { children: ReactNode }): JSX.Element {
	const width = useLayoutStore((s) => s.aiWidth);
	return (
		<aside
			aria-label='AI assistant'
			data-part='chat'
			className='glass pane-focus animate-fade min-w-0 shrink-0 overflow-hidden'
			style={{ width }}
		>
			{children}
		</aside>
	);
}

function SidePane({ side }: { side: 'left' | 'right' }): JSX.Element {
	const start = useRef(0);
	const sign = side === 'left' ? 1 : -1;
	const splitter = (
		<PaneSplitter
			pane='sideWidth'
			axis='x'
			label='Resize side bar'
			onStart={() => (start.current = useLayoutStore.getState().sideWidth)}
			onDrag={(d) => resize({ sideWidth: start.current + sign * d })}
			onReset={() => resize({ sideWidth: 272 })}
		/>
	);
	return (
		<>
			{side === 'right' && splitter}
			<SideWidth>
				<SideBar />
			</SideWidth>
			{side === 'left' && splitter}
		</>
	);
}

function EditorColumn(): JSX.Element {
	const { panelOpen, zen, panelMaximized } = useLayoutStore(
		useShallow((s) => ({
			panelOpen: s.panelOpen,
			zen: s.zen,
			panelMaximized: s.panelMaximized,
		})),
	);
	const start = useRef(0);
	const showPanel = panelOpen && !zen;
	return (
		<div data-part='editor-column' className='flex min-w-0 flex-1 flex-col'>
			{/* Hidden, not unmounted, while the panel is maximized: unmounting would dispose and
			    rebuild every Monaco editor on each maximize/restore. */}
			<div className={showPanel && panelMaximized ? 'hidden' : 'min-h-0 flex-1'}>
				<ErrorBoundary name='Editor' className='glass'>
					<EditorArea />
				</ErrorBoundary>
			</div>
			{showPanel && (
				<>
					{!panelMaximized && (
						<PaneSplitter
							pane='panelHeight'
							axis='y'
							label='Resize panel'
							onStart={() => (start.current = useLayoutStore.getState().panelHeight)}
							onDrag={(d) => resize({ panelHeight: start.current - d })}
							onReset={() => resize({ panelHeight: 240 })}
						/>
					)}
					<PanelHeight>
						<ErrorBoundary name='Panel' className='glass'>
							<BottomPanel />
						</ErrorBoundary>
					</PanelHeight>
				</>
			)}
		</div>
	);
}

function ChatPane(): JSX.Element {
	const start = useRef(0);
	return (
		<>
			<PaneSplitter
				pane='aiWidth'
				axis='x'
				label='Resize AI panel'
				onStart={() => (start.current = useLayoutStore.getState().aiWidth)}
				onDrag={(d) => resize({ aiWidth: start.current - d })}
				onReset={() => resize({ aiWidth: 380 })}
			/>
			<AiWidth>
				<ErrorBoundary name='AI assistant'>
					<Suspense
						fallback={
							<div className='flex h-full items-center justify-center'>
								<Spinner />
							</div>
						}
					>
						<ChatPanel />
					</Suspense>
				</ErrorBoundary>
			</AiWidth>
		</>
	);
}

/**
 * The panes, arranged the way the skin says: activity bar left, right, on top (rendered by the
 * shell) or as a hover rail; side bar left, right or as a drawer; chat on the right.
 */
export function Workbench({ Activity }: { Activity: ComponentType }): JSX.Element {
	const { layout } = useLook();
	const zen = useLayoutStore((s) => s.zen);
	const sideOpen = useLayoutStore((s) => s.sideOpen);
	const aiOpen = useLayoutStore((s) => s.aiOpen);
	const showSide = sideOpen && !zen;
	const docked = layout.sidebar !== 'drawer';
	// A drawer starts put away: a side bar left open by a docked skin would cover the editor.
	useEffect(() => {
		if (!docked) useLayoutStore.setState({ sideOpen: false });
	}, [docked]);
	const gap = <span data-part='pane-gap' className='w-[var(--pane-gap)] shrink-0' />;
	return (
		<div
			data-part='workbench'
			className={cn(
				'relative z-10 flex min-h-0 flex-1 px-[var(--pane-gap)] pb-[var(--pane-gap)]',
				zen && 'px-[8vw] pb-6',
			)}
		>
			{!zen && layout.activity === 'left' && (
				<>
					<Activity />
					{gap}
				</>
			)}
			{!zen && layout.activity === 'rail' && <ActivityRail Bar={Activity} />}
			{docked && showSide && layout.sidebar === 'left' && <SidePane side='left' />}
			<EditorColumn />
			{aiOpen && !zen && <ChatPane />}
			{docked && showSide && layout.sidebar === 'right' && <SidePane side='right' />}
			{!zen && layout.activity === 'right' && (
				<>
					{gap}
					<Activity />
				</>
			)}
			{!docked && <SideDrawer side={layout.activity === 'right' ? 'right' : 'left'} />}
		</div>
	);
}
