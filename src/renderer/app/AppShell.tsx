import { type JSX, lazy, type ReactNode, Suspense, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';

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
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { QuickPickHost } from '../ui/QuickPick';
import { Spinner } from '../ui/Spinner';
import { ActivityBar } from './ActivityBar';
import { BottomPanel } from './BottomPanel';
import { CommandPalette } from './CommandPalette';
import { useGlobalShortcuts } from './commands/use-global-shortcuts';
import { useFeatureErrors } from './hooks/use-feature-errors';
import { useFitPanesToWindow } from './hooks/use-fit-panes';
import { useFocusRescue } from './hooks/use-focus-rescue';
import { useFsInvalidation } from './hooks/use-fs-invalidation';
import { useLayoutPersistence } from './hooks/use-layout-persistence';
import { useMonacoExtras } from './hooks/use-monaco-extras';
import { useSecretsReset } from './hooks/use-secrets-reset';
import { useApplySettings } from './hooks/use-settings';
import { useZenEscape } from './hooks/use-zen-escape';
import { PaneSplitter } from './PaneSplitter';
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

const resize: ReturnType<typeof useLayoutStore.getState>['resize'] = (patch) =>
	useLayoutStore.getState().resize(patch);

/*
 * Pane sizes are read by these small wrappers, not by AppShell, so a splitter drag (a store
 * update per pointermove) re-renders only the resized wrapper. Their children are elements
 * created by AppShell, which React skips when the wrapper re-renders.
 */
function SideWidth({ children }: { children: ReactNode }): JSX.Element {
	const width = useLayoutStore((s) => s.sideWidth);
	return (
		<div className='min-w-0 shrink-0' style={{ width }}>
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
			className='glass pane-focus animate-fade min-w-0 shrink-0 overflow-hidden'
			style={{ width }}
		>
			{children}
		</aside>
	);
}

/**
 * The workbench: floating glass panes over an ambient background. Activity bar, side bar,
 * editor groups over the terminal panel, and the AI pane on the right.
 */
export function AppShell(): JSX.Element {
	const { sideOpen, panelOpen, aiOpen, zen, panelMaximized } = useLayoutStore(
		useShallow((s) => ({
			sideOpen: s.sideOpen,
			panelOpen: s.panelOpen,
			aiOpen: s.aiOpen,
			zen: s.zen,
			panelMaximized: s.panelMaximized,
		})),
	);
	const start = useRef(0);
	useGlobalShortcuts();
	useApplySettings();
	useFsInvalidation();
	useFocusRescue();
	useFitPanesToWindow();
	useLayoutPersistence();
	useMonacoExtras();
	useFeatureErrors();
	useSecretsReset();
	useZenEscape();

	const showSide = sideOpen && !zen;
	const showPanel = panelOpen && !zen;
	const showAi = aiOpen && !zen;

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
						<SideWidth>
							<SideBar />
						</SideWidth>
						<PaneSplitter
							pane='sideWidth'
							axis='x'
							label='Resize side bar'
							onStart={() => (start.current = useLayoutStore.getState().sideWidth)}
							onDrag={(d) => resize({ sideWidth: start.current + d })}
							onReset={() => resize({ sideWidth: 272 })}
						/>
					</>
				)}
				<div className='flex min-w-0 flex-1 flex-col'>
					{/* Hidden, not unmounted, while the panel is maximized: unmounting would dispose
					    and rebuild every Monaco editor on each maximize/restore. */}
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
									onStart={() =>
										(start.current = useLayoutStore.getState().panelHeight)
									}
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
				{showAi && (
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
