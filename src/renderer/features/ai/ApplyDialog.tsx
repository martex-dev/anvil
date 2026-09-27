import { AlertTriangle, Check, GitCompare, X } from 'lucide-react';
import type * as Monaco from 'monaco-editor';
import { Dialog as RadixDialog } from 'radix-ui';
import {
	type JSX,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react';
import { create } from 'zustand';

import { focusedEditor } from '../../lib/monaco/editors';
import { getLoadedMonaco } from '../../lib/monaco/load';
import { toWorkspacePath } from '../../lib/monaco/workspace-root';
import { useRegisterOverlay } from '../../stores/overlay-store';
import { toast } from '../../stores/toast-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { Button } from '../../ui/Button';
import { type ApplyTarget, applyWarnings, locateSelection } from './apply-target';
import { applyBlock } from './fences';

export interface Proposal {
	/** Workspace-relative file the change targets. */
	path: string;
	language: string;
	/** The code block from the reply. */
	block: string;
	/** The asked-about lines, where they are in the file now (1-based, inclusive). */
	selection: { startLine: number; endLine: number } | null;
	/** The file's version when the preview opened: a change after that makes the diff stale. */
	version: number;
}

export const useApply = create<{ proposal: Proposal | null; set: (p: Proposal | null) => void }>(
	(set) => ({
		proposal: null,
		set: (proposal) => set({ proposal }),
	}),
);

/** Set by Accept: closing then returns focus to the editor instead of the Apply button. */
let focusEditorOnClose = false;

function findModel(path: string): Monaco.editor.ITextModel | null {
	const monaco = getLoadedMonaco();
	return monaco?.editor.getModels().find((m) => toWorkspacePath(m.uri) === path) ?? null;
}

/**
 * Previews `block` against the file the question was about, on the lines asked about (found
 * again if edits moved them), or explains why not.
 */
export function openApplyTo(target: ApplyTarget, block: string): void {
	const model = findModel(target.path);
	if (!model) {
		toast.info('Open the file first', `The question was about ${target.path}.`, {
			label: 'Open',
			run: () => void requestOpenFile({ path: target.path }),
		});
		return;
	}
	let selection: Proposal['selection'] = null;
	if (target.selection) {
		selection = locateSelection(model.getValue(), target.selection);
		if (!selection)
			toast.warn(
				'The asked-about lines changed',
				`Previewing against the whole of ${target.path}. Check the diff before accepting.`,
			);
	}
	useApply.getState().set({
		path: target.path,
		language: model.getLanguageId(),
		block,
		selection,
		version: model.getVersionId(),
	});
}

/** The model's version, re-rendering on every edit, so a stale preview shows at once. */
function useVersion(model: Monaco.editor.ITextModel | null): number {
	const subscribe = useCallback(
		(changed: () => void) => {
			const listener = model?.onDidChangeContent(changed);
			return () => listener?.dispose();
		},
		[model],
	);
	return useSyncExternalStore(subscribe, () => model?.getVersionId() ?? -1);
}

function Preview({ proposal }: { proposal: Proposal }): JSX.Element {
	const [mode, setMode] = useState<'selection' | 'file'>(
		proposal.selection ? 'selection' : 'file',
	);
	const hostRef = useRef<HTMLDivElement>(null);
	const target = findModel(proposal.path);
	// Accepting writes `proposed` over the whole file: if the file changed after the preview
	// opened, that would silently undo the change, so the preview refuses instead.
	const stale = useVersion(target) !== proposal.version;
	const original = target?.getValue() ?? '';
	const proposed = useMemo(
		() =>
			applyBlock(original, proposal.block, mode === 'selection' ? proposal.selection : null),
		[original, proposal, mode],
	);

	// Built once per proposal (Preview is keyed on it); toggling the mode only swaps the
	// text in its models, so the diff keeps its scroll position instead of flashing blank.
	const initial = useRef({ original, proposed });
	const modelsRef = useRef<{
		left: Monaco.editor.ITextModel;
		right: Monaco.editor.ITextModel;
	} | null>(null);
	useEffect(() => {
		const monaco = getLoadedMonaco();
		if (!monaco || !hostRef.current) return;
		const diff = monaco.editor.createDiffEditor(hostRef.current, {
			automaticLayout: true,
			readOnly: true,
			originalEditable: false,
			renderSideBySide: true,
			minimap: { enabled: false },
			// Its menu would render outside the modal, where pointer events are blocked.
			contextmenu: false,
			hideUnchangedRegions: { enabled: true },
		});
		const left = monaco.editor.createModel(initial.current.original, proposal.language);
		const right = monaco.editor.createModel(initial.current.proposed, proposal.language);
		diff.setModel({ original: left, modified: right });
		modelsRef.current = { left, right };
		return () => {
			modelsRef.current = null;
			diff.dispose();
			left.dispose();
			right.dispose();
		};
	}, [proposal.language]);

	useEffect(() => {
		const models = modelsRef.current;
		if (!models) return;
		if (models.left.getValue() !== original) models.left.setValue(original);
		if (models.right.getValue() !== proposed) models.right.setValue(proposed);
	}, [original, proposed]);

	const accept = (): void => {
		const model = findModel(proposal.path);
		if (!model) {
			toast.error('File is no longer open', proposal.path);
			useApply.getState().set(null);
			return;
		}
		// Checked again here: an edit can land between the last render and the click.
		if (model.getVersionId() !== proposal.version) return;
		// One undoable edit, kept apart from any typing just before it; the editor marks the
		// file unsaved and Ctrl+S writes it.
		model.pushStackElement();
		model.pushEditOperations(
			[],
			[{ range: model.getFullModelRange(), text: proposed }],
			() => null,
		);
		model.pushStackElement();
		toast.success(
			'Applied: review and save',
			`${proposal.path} (Ctrl+S to save, Ctrl+Z to undo)`,
		);
		// Straight back to the code, so Ctrl+S / Ctrl+Z act on the change.
		focusEditorOnClose = true;
		useApply.getState().set(null);
	};

	const warnings = applyWarnings({
		path: proposal.path,
		stale,
		original,
		block: proposal.block,
		wholeFile: mode === 'file',
	});

	return (
		<div className='flex h-full flex-col' data-apply-preview={proposal.path}>
			<header className='flex flex-wrap items-center gap-2 border-b border-glass-edge px-4 py-2.5'>
				<GitCompare size={15} className='text-accent' />
				<RadixDialog.Title className='min-w-0 flex-1 truncate text-13 font-normal text-fg-0'>
					Proposed change to <code className='text-accent'>{proposal.path}</code>
				</RadixDialog.Title>
				<RadixDialog.Description className='sr-only'>
					Review the diff, then accept to edit the file or discard.
				</RadixDialog.Description>
				{proposal.selection && (
					<div
						role='group'
						aria-label='Apply to'
						className='flex overflow-hidden rounded-md border border-border-strong text-11'
					>
						{(['selection', 'file'] as const).map((m) => (
							<button
								key={m}
								type='button'
								aria-pressed={mode === m}
								onClick={() => setMode(m)}
								className={
									mode === m
										? 'bg-accent-soft px-2 py-1 text-fg-0'
										: 'px-2 py-1 text-fg-2 hover:text-fg-1'
								}
							>
								{m === 'selection'
									? `Replace lines ${proposal.selection?.startLine}-${proposal.selection?.endLine}`
									: 'Replace whole file'}
							</button>
						))}
					</div>
				)}
				<Button
					size='sm'
					variant='ghost'
					icon={<X size={12} />}
					onClick={() => useApply.getState().set(null)}
				>
					Discard
				</Button>
				<Button
					size='sm'
					variant='primary'
					icon={<Check size={12} />}
					onClick={accept}
					disabled={stale}
					// Only for a line edit: with Accept focused, a stray Enter on a whole-file
					// preview would swap the file for a snippet. Radix focuses Discard instead.
					autoFocus={proposal.selection !== null}
				>
					Accept
				</Button>
			</header>
			{warnings.length > 0 && (
				<div
					role='status'
					className='flex flex-col gap-0.5 border-b border-warn/30 bg-warn-soft px-4 py-1.5 text-12 text-warn'
				>
					{warnings.map((w) => (
						<p key={w} className='flex items-start gap-1.5'>
							<AlertTriangle size={12} className='mt-0.5 shrink-0' />
							{w}
						</p>
					))}
				</div>
			)}
			<div
				ref={hostRef}
				className='min-h-0 flex-1'
				style={{ background: 'var(--editor-bg)' }}
			/>
		</div>
	);
}

/** Full-screen modal sheet with the diff of an AI code block against the file. */
export function ApplyDialog(): JSX.Element {
	const proposal = useApply((s) => s.proposal);
	useRegisterOverlay(proposal !== null);
	// openApplyTo checks the file up front; this only guards a model closed since then.
	const missing = proposal !== null && !findModel(proposal.path);
	// Radix traps focus inside, marks the rest of the app inert (aria-modal), closes on Escape
	// or a scrim click, and puts focus back where it was (the chat's Apply button) on close.
	// The sheet is an opaque plate, not glass: no backdrop-filter under the Monaco diff.
	return (
		<RadixDialog.Root
			open={proposal !== null && !missing}
			onOpenChange={(open) => {
				if (!open) useApply.getState().set(null);
			}}
		>
			<RadixDialog.Portal>
				<RadixDialog.Overlay className='animate-fade fixed inset-0 z-40 bg-scrim scrim-blur' />
				<RadixDialog.Content
					className='animate-in fixed top-1/2 left-1/2 z-50 h-[80vh] w-[min(1200px,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-glass-edge bg-bg-1 shadow-panel outline-none'
					onCloseAutoFocus={(e) => {
						if (!focusEditorOnClose) return;
						focusEditorOnClose = false;
						e.preventDefault();
						focusedEditor()?.focus();
					}}
				>
					{proposal && (
						<Preview
							key={`${proposal.path}:${proposal.block.length}:${proposal.block.slice(0, 40)}`}
							proposal={proposal}
						/>
					)}
				</RadixDialog.Content>
			</RadixDialog.Portal>
		</RadixDialog.Root>
	);
}
