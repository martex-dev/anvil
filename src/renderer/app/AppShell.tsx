import type { CSSProperties, JSX } from 'react';

import { AiStreamController } from '../features/ai/AiStreamController';
import { ApplyDialog } from '../features/ai/ApplyDialog';
import { InlineEditHost } from '../features/ai/InlineEditHost';
import { EditorBridge } from '../features/editor/EditorBridge';
import { LspController } from '../features/lsp/LspController';
import { SnapDialog } from '../features/snap/SnapDialog';
import { chromeFor } from '../skins/chrome-registry';
import { useLook } from '../skins/look-store';
import { useLayoutStore } from '../stores/layout-store';
import { QuickPickHost } from '../ui/QuickPick';
import { ActivityBar } from './ActivityBar';
import { CommandPalette } from './CommandPalette';
import { useGlobalShortcuts } from './commands/use-global-shortcuts';
import { useFsInvalidation } from './hooks/use-fs-invalidation';
import { useLayoutPersistence } from './hooks/use-layout-persistence';
import { useMonacoExtras } from './hooks/use-monaco-extras';
import { useApplySettings } from './hooks/use-settings';
import { QuickOpen } from './QuickOpen';
import { SettingsDialog } from './settings/SettingsDialog';
import { ShortcutsDialog } from './ShortcutsDialog';
import { StatusBar } from './StatusBar';
import { TemplatesDialog } from './TemplatesDialog';
import { TitleBar } from './TitleBar';
import { Workbench } from './Workbench';

import './commands/all';

/** Cyber Glass's two soft light sources and drifting grid; skins can replace it. */
function Ambient(): JSX.Element {
	return <div className='ambient' aria-hidden />;
}

/**
 * The window: title bar, optional skin bars, the workbench and the status bar, arranged by the
 * active skin. Everything a skin doesn't replace is the shared chrome, restyled by its CSS.
 */
export function AppShell(): JSX.Element {
	useGlobalShortcuts();
	useApplySettings();
	useFsInvalidation();
	useLayoutPersistence();
	useMonacoExtras();
	const { skin, layout } = useLook();
	const zen = useLayoutStore((s) => s.zen);
	const chrome = chromeFor(skin.id);
	const Title = chrome.TitleBar ?? TitleBar;
	const Activity = chrome.ActivityBar ?? ActivityBar;
	const Status = chrome.StatusBar ?? StatusBar;
	const Backdrop = chrome.Backdrop ?? Ambient;
	const { Top, Bottom, Overlay } = chrome;

	return (
		<div
			data-part='shell'
			data-editor-column={layout.editorColumn ? true : undefined}
			className='relative flex h-full flex-col'
			style={
				{
					'--pane-gap': `${layout.gap}px`,
					'--editor-column': `${layout.editorColumn ?? 0}px`,
				} as CSSProperties
			}
		>
			<Backdrop />
			<Title />
			{!zen && Top && <Top />}
			{!zen && layout.statusBar === 'top' && <Status />}
			{!zen && layout.activity === 'top' && (
				<div
					data-part='activity-row'
					className='relative z-10 shrink-0 px-[var(--pane-gap)] pb-[var(--pane-gap)]'
				>
					<Activity />
				</div>
			)}
			<Workbench Activity={Activity} />
			{!zen && layout.statusBar === 'bottom' && <Status />}
			{!zen && Bottom && <Bottom />}
			{Overlay && <Overlay />}

			<EditorBridge />
			<LspController />
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
