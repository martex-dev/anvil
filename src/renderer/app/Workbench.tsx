import { type ComponentType, type JSX, lazy, Suspense, useRef } from 'react';

import { EditorArea } from '../features/editor/EditorArea';
import { cn } from '../lib/cn';
import { useLook } from '../skins/look-store';
import { useLayoutStore } from '../stores/layout-store';
import { Spinner } from '../ui/Spinner';
import { Splitter } from '../ui/Splitter';
import { ActivityRail } from './ActivityRail';
import { BottomPanel } from './BottomPanel';
import { SideBar } from './SideBar';
import { SideDrawer } from './SideDrawer';

const ChatPanel = lazy(() =>
	import('../features/ai/ChatPanel').then((m) => ({ default: m.ChatPanel })),
);

function SidePane({ side }: { side: 'left' | 'right' }): JSX.Element {
	const width = useLayoutStore((s) => s.sideWidth);
	const start = useRef(0);
	const sign = side === 'left' ? 1 : -1;
	const splitter = (
		<Splitter
			axis='x'
			label='Resize side bar'
			onStart={() => (start.current = useLayoutStore.getState().sideWidth)}
			onDrag={(d) =>
				useLayoutStore.getState().resize({ sideWidth: start.current + sign * d })
			}
			onReset={() => useLayoutStore.getState().resize({ sideWidth: 272 })}
		/>
	);
	return (
		<>
			{side === 'right' && splitter}
			<div data-part='sidebar-slot' className='min-w-0 shrink-0' style={{ width }}>
				<SideBar />
			</div>
			{side === 'left' && splitter}
		</>
	);
}

function EditorColumn(): JSX.Element {
	const layout = useLayoutStore();
	const start = useRef(0);
	const showPanel = layout.panelOpen && !layout.zen;
	return (
		<div data-part='editor-column' className='flex min-w-0 flex-1 flex-col'>
			{!(showPanel && layout.panelMaximized) && (
				<div className='min-h-0 flex-1'>
					<EditorArea />
				</div>
			)}
			{showPanel && (
				<>
					{!layout.panelMaximized && (
						<Splitter
							axis='y'
							label='Resize panel'
							onStart={() => (start.current = useLayoutStore.getState().panelHeight)}
							onDrag={(d) => layout.resize({ panelHeight: start.current - d })}
							onReset={() => layout.resize({ panelHeight: 240 })}
						/>
					)}
					<div
						className={layout.panelMaximized ? 'min-h-0 flex-1' : 'shrink-0'}
						style={layout.panelMaximized ? undefined : { height: layout.panelHeight }}
					>
						<BottomPanel />
					</div>
				</>
			)}
		</div>
	);
}

function ChatPane(): JSX.Element {
	const width = useLayoutStore((s) => s.aiWidth);
	const start = useRef(0);
	return (
		<>
			<Splitter
				axis='x'
				label='Resize AI panel'
				onStart={() => (start.current = useLayoutStore.getState().aiWidth)}
				onDrag={(d) => useLayoutStore.getState().resize({ aiWidth: start.current - d })}
				onReset={() => useLayoutStore.getState().resize({ aiWidth: 380 })}
			/>
			<aside
				aria-label='AI assistant'
				data-part='chat'
				className='glass pane-focus min-w-0 shrink-0 overflow-hidden'
				style={{ width }}
			>
				<Suspense
					fallback={
						<div className='flex h-full items-center justify-center'>
							<Spinner />
						</div>
					}
				>
					<ChatPanel />
				</Suspense>
			</aside>
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
