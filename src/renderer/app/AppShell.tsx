import { type JSX, lazy, Suspense, useRef } from 'react';

import { AiStreamController } from '../features/ai/AiStreamController';
import { ApplyDialog } from '../features/ai/ApplyDialog';
import { InlineEditHost } from '../features/ai/InlineEditHost';
import { EditorArea } from '../features/editor/EditorArea';
import { EditorBridge } from '../features/editor/EditorBridge';
import { LspController } from '../features/lsp/LspController';
import { PythonController } from '../features/python/PythonController';
import { SnapDialog } from '../features/snap/SnapDialog';
import { cn } from '../lib/cn';
import { useLayoutStore } from '../stores/layout-store';
import { QuickPickHost } from '../ui/QuickPick';
import { Spinner } from '../ui/Spinner';
import { Splitter } from '../ui/Splitter';
import { ActivityBar } from './ActivityBar';
import { BottomPanel } from './BottomPanel';
import { CommandPalette } from './CommandPalette';
import { useGlobalShortcuts } from './commands/use-global-shortcuts';
import { useFsInvalidation } from './hooks/use-fs-invalidation';
import { useLayoutPersistence } from './hooks/use-layout-persistence';
import { useMonacoExtras } from './hooks/use-monaco-extras';
import { useApplySettings } from './hooks/use-settings';
import { QuickOpen } from './QuickOpen';
import { SettingsDialog } from './settings/SettingsDialog';
import { ShortcutsDialog } from './ShortcutsDialog';
import { SideBar } from './SideBar';
import { StatusBar } from './StatusBar';
import { TemplatesDialog } from './TemplatesDialog';
import { TitleBar } from './TitleBar';

import './commands/all';

const ChatPanel = lazy(() =>
	import('../features/ai/ChatPanel').then((m) => ({ default: m.ChatPanel })),
);

/**
 * The workbench: floating glass panes over an ambient background. Activity bar, side bar,
 * editor groups over the terminal panel, and the AI pane on the right.
 */
export function AppShell(): JSX.Element {
	const layout = useLayoutStore();
	const start = useRef(0);
	useGlobalShortcuts();
	useApplySettings();
	useFsInvalidation();
	useLayoutPersistence();
	useMonacoExtras();

	const zen = layout.zen;
	const showSide = layout.sideOpen && !zen;
	const showPanel = layout.panelOpen && !zen;
	const showAi = layout.aiOpen && !zen;

	return (
		<div className='relative flex h-full flex-col'>
			<div className='ambient' aria-hidden />
			<TitleBar />
			<div
				className={cn(
					'relative z-10 flex min-h-0 flex-1 px-1.5 pb-1.5',
					zen && 'px-[8vw] pb-6',
				)}
			>
				{!zen && <ActivityBar />}
				{!zen && <span className='w-1.5 shrink-0' />}
				{showSide && (
					<>
						<div className='min-w-0 shrink-0' style={{ width: layout.sideWidth }}>
							<SideBar />
						</div>
						<Splitter
							axis='x'
							label='Resize side bar'
							onStart={() => (start.current = useLayoutStore.getState().sideWidth)}
							onDrag={(d) => layout.resize({ sideWidth: start.current + d })}
							onReset={() => layout.resize({ sideWidth: 272 })}
						/>
					</>
				)}
				<div className='flex min-w-0 flex-1 flex-col'>
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
									onStart={() =>
										(start.current = useLayoutStore.getState().panelHeight)
									}
									onDrag={(d) =>
										layout.resize({ panelHeight: start.current - d })
									}
									onReset={() => layout.resize({ panelHeight: 240 })}
								/>
							)}
							<div
								className={layout.panelMaximized ? 'min-h-0 flex-1' : 'shrink-0'}
								style={
									layout.panelMaximized
										? undefined
										: { height: layout.panelHeight }
								}
							>
								<BottomPanel />
							</div>
						</>
					)}
				</div>
				{showAi && (
					<>
						<Splitter
							axis='x'
							label='Resize AI panel'
							onStart={() => (start.current = useLayoutStore.getState().aiWidth)}
							onDrag={(d) => layout.resize({ aiWidth: start.current - d })}
							onReset={() => layout.resize({ aiWidth: 380 })}
						/>
						<aside
							aria-label='AI assistant'
							className='glass pane-focus min-w-0 shrink-0 overflow-hidden'
							style={{ width: layout.aiWidth }}
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
				)}
			</div>
			{!zen && <StatusBar />}

			<EditorBridge />
			<LspController />
			<PythonController />
			<AiStreamController />
			<InlineEditHost />
			<CommandPalette />
			<QuickOpen />
			<QuickPickHost />
			<SettingsDialog />
			<ShortcutsDialog />
			<TemplatesDialog />
			<ApplyDialog />
			<SnapDialog />
		</div>
	);
}
