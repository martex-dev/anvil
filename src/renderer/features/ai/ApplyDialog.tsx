import { Check, GitCompare, X } from 'lucide-react';
import type * as Monaco from 'monaco-editor';
import { Dialog as RadixDialog } from 'radix-ui';
import { type JSX, useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';

import { focusedEditor } from '../../lib/monaco/editors';
import { getLoadedMonaco } from '../../lib/monaco/load';
import { toWorkspacePath } from '../../lib/monaco/workspace-root';
import { useRegisterOverlay } from '../../stores/overlay-store';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { applyBlock } from './fences';

export interface Proposal {
	/** Workspace-relative file the change targets. */
	path: string;
	language: string;
	/** The code block from the reply. */
	block: string;
	/** Lines that were selected when Apply was clicked (1-based, inclusive). */
	selection: { startLine: number; endLine: number } | null;
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

/** Opens the preview, or explains why not when the target file isn't open any more. */
export function openApply(proposal: Proposal): void {
	if (!findModel(proposal.path)) {
		toast.info('Open the file first', `${proposal.path} isn't open in the editor anymore.`);
		return;
	}
	useApply.getState().set(proposal);
}

function Preview({ proposal }: { proposal: Proposal }): JSX.Element {
	const [mode, setMode] = useState<'selection' | 'file'>(
		proposal.selection ? 'selection' : 'file',
	);
	const hostRef = useRef<HTMLDivElement>(null);
	const target = findModel(proposal.path);
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
					autoFocus
				>
					Accept
				</Button>
			</header>
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
	// openApply checks the file up front; this only guards a model closed since then.
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
