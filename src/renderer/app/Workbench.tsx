import {
	type ComponentType,
	type JSX,
	lazy,
	type ReactNode,
	Suspense,
	useEffect,
	useRef,
	useState,
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
function SideWidth({ open, children }: { open: boolean; children: ReactNode }): JSX.Element {
	const width = useLayoutStore((s) => s.sideWidth);
	// display:none inline, so no skin rule on the slot can show a closed side bar.
	return (
		<div
			data-part='sidebar-slot'
			className='min-w-0 shrink-0'
			style={{ width, display: open ? undefined : 'none' }}
		>
			{children}
		</div>
	);
}

/**
 * The bottom panel's slot. A closed panel stays mounted, out of the flow and invisible at its
 * last size: unmounting disposed every xterm, and on reopen the replayed backlog garbled TUIs
 * like Claude Code and lost the scroll position. `display: none` would zero the size and make
 * xterm refit to nothing; `inert` keeps focus and clicks out of it.
 */
function PanelHeight({ shown, children }: { shown: boolean; children: ReactNode }): JSX.Element {
	const maximized = useLayoutStore((s) => s.panelMaximized);
	const height = useLayoutStore((s) => s.panelHeight);
	const fill = shown && maximized;
	return (
		<div
			data-part='panel-slot'
			data-hidden={!shown || undefined}
			inert={!shown}
			className={cn(
				fill ? 'min-h-0 flex-1' : 'shrink-0',
				!shown && 'pointer-events-none invisible absolute inset-x-0 bottom-0',
			)}
			style={fill ? undefined : { height }}
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

/**
 * The docked side bar. Once shown it stays mounted while closed (Ctrl+B), like the views inside
 * it, so the explorer's open folders or a half-written commit message survive.
 */
function SidePane({ side, open }: { side: 'left' | 'right'; open: boolean }): JSX.Element | null {
	const [shown, setShown] = useState(open);
	if (open && !shown) setShown(true);
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
	if (!shown) return null;
	return (
		<>
			{open && side === 'right' && splitter}
			<SideWidth open={open}>
				<SideBar />
			</SideWidth>
			{open && side === 'left' && splitter}
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
	// Mounted the first time it is shown, then kept (see PanelHeight): a panel that starts closed
	// must not boot its restored terminals behind the user's back.
	const [panelMounted, setPanelMounted] = useState(showPanel);
	if (showPanel && !panelMounted) setPanelMounted(true);
	return (
		<div data-part='editor-column' className='relative flex min-w-0 flex-1 flex-col'>
			{/* Hidden, not unmounted, while the panel is maximized: unmounting would dispose and
			    rebuild every Monaco editor on each maximize/restore. */}
			<div className={showPanel && panelMaximized ? 'hidden' : 'min-h-0 flex-1'}>
				<ErrorBoundary name='Editor' className='glass'>
					<EditorArea />
				</ErrorBoundary>
			</div>
			{showPanel && !panelMaximized && (
				<PaneSplitter
					pane='panelHeight'
					axis='y'
					label='Resize panel'
					onStart={() => (start.current = useLayoutStore.getState().panelHeight)}
					onDrag={(d) => resize({ panelHeight: start.current - d })}
					onReset={() => resize({ panelHeight: 240 })}
				/>
			)}
			{panelMounted && (
				<PanelHeight shown={showPanel}>
					<ErrorBoundary name='Panel' className='glass'>
						<BottomPanel />
					</ErrorBoundary>
				</PanelHeight>
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
	// A drawer starts put away: a side bar left open by a docked skin would cover the editor. The
	// store remembers the mode, so the saved layout arriving later doesn't reopen it.
	useEffect(() => {
		useLayoutStore.getState().setSideDrawer(!docked);
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
			{docked && layout.sidebar === 'left' && <SidePane side='left' open={showSide} />}
			<EditorColumn />
			{aiOpen && !zen && <ChatPane />}
			{docked && layout.sidebar === 'right' && <SidePane side='right' open={showSide} />}
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
