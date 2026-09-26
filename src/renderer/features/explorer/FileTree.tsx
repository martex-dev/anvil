import { type JSX, useEffect, useImperativeHandle, useRef, useState } from 'react';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { requestOpenFile, useWorkbenchStore } from '../../stores/workbench-store';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import { compareWithSelected, selectedForCompare, selectForCompare } from '../editor/compare';
import { ExplorerContextMenu, type MenuItem } from './ExplorerContextMenu';
import { useFsActions } from './fs-actions';
import { InlineNameInput } from './InlineNameInput';
import { ancestorsOf, joinPath, parentOf, type PendingCreate } from './tree-model';
import { TreeRowView } from './TreeRowView';
import { useFileTree } from './use-file-tree';
import { treeKeyHandler } from './use-tree-keyboard';

export interface FileTreeHandle {
	startCreate: (kind: 'file' | 'dir') => void;
	collapseAll: () => void;
	refresh: () => void;
}

interface FileTreeProps {
	root: string;
	handleRef: React.RefObject<FileTreeHandle | null>;
}

export function FileTree({ root, handleRef }: FileTreeProps): JSX.Element {
	const [pending, setPending] = useState<PendingCreate | null>(null);
	const [renaming, setRenaming] = useState<string | null>(null);
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
	const [focused, setFocused] = useState<string | null>(null);
	const [menuTarget, setMenuTarget] = useState<FsEntry | null>(null);
	const tree = useFileTree(root, pending);
	const actions = useFsActions(root);
	const activeFile = useWorkbenchStore((s) => s.activeFile);
	const reveal = useWorkbenchStore((s) => s.reveal);
	const containerRef = useRef<HTMLDivElement>(null);

	const focusedEntry = tree.rows.find((r) => r.kind === 'entry' && r.entry.path === focused);
	const baseDir = (entry: FsEntry | null | undefined): string =>
		!entry ? '' : entry.kind === 'dir' ? entry.path : parentOf(entry.path);

	const startCreate = (kind: 'file' | 'dir', target?: FsEntry | null): void => {
		const parent = baseDir(
			target ?? (focusedEntry?.kind === 'entry' ? focusedEntry.entry : null),
		);
		if (parent) tree.expand([...ancestorsOf(`${parent}/x`)]);
		setPending({ parent, kind });
	};

	useImperativeHandle(handleRef, () => ({
		startCreate: (kind) => startCreate(kind),
		collapseAll: tree.collapseAll,
		refresh: tree.refetchAll,
	}));

	// Follow the editor: reveal and highlight the active file. Adjusting state during render
	// (instead of in an effect) avoids an extra render pass.
	const [seenActive, setSeenActive] = useState<string | null>(null);
	if (activeFile !== seenActive) {
		setSeenActive(activeFile);
		if (activeFile) {
			tree.expand(ancestorsOf(activeFile));
			setFocused(activeFile);
		}
	}

	// An explicit "Reveal in Explorer View" (e.g. from a tab): same, and the tree takes focus.
	const [seenReveal, setSeenReveal] = useState<number | null>(null);
	if (reveal && reveal.nonce !== seenReveal) {
		setSeenReveal(reveal.nonce);
		tree.expand(ancestorsOf(reveal.path));
		setFocused(reveal.path);
	}

	useEffect(() => {
		// Still loading: the tree isn't mounted yet, so wait for it before taking focus.
		const container = containerRef.current;
		if (!reveal || !container) return;
		container.focus();
		container
			.querySelector(`[data-path="${CSS.escape(reveal.path)}"]`)
			?.scrollIntoView({ block: 'nearest' });
		useWorkbenchStore.getState().clearReveal();
	}, [reveal, tree.isRootLoading]);

	useEffect(() => {
		if (!focused) return;
		containerRef.current
			?.querySelector(`[data-path="${CSS.escape(focused)}"]`)
			?.scrollIntoView({ block: 'nearest' });
	}, [focused]);

	const openEntry = (entry: FsEntry): void => {
		if (entry.kind === 'dir') {
			tree.toggle(entry.path);
			return;
		}
		if (!requestOpenFile({ path: entry.path })) {
			toast.warn('Open a folder first');
		}
	};

	const menuItems: Array<MenuItem | 'separator'> = [
		{ label: 'New File', onSelect: () => startCreate('file', menuTarget) },
		{ label: 'New Folder', onSelect: () => startCreate('dir', menuTarget) },
		'separator',
		{
			label: 'Rename',
			shortcut: 'F2',
			disabled: !menuTarget,
			onSelect: () => menuTarget && setRenaming(menuTarget.path),
		},
		{
			label: 'Delete',
			shortcut: 'Delete',
			danger: true,
			disabled: !menuTarget,
			onSelect: () => menuTarget && setConfirmDelete(menuTarget.path),
		},
		'separator',
		{
			label: 'Copy Relative Path',
			disabled: !menuTarget,
			onSelect: () => menuTarget && void navigator.clipboard.writeText(menuTarget.path),
		},
		{
			label: 'Reveal in File Explorer',
			onSelect: () => void call('fs:reveal', menuTarget?.path ?? '').catch(() => undefined),
		},
		'separator',
		{
			label: 'Select for Compare',
			disabled: menuTarget?.kind !== 'file',
			onSelect: () => menuTarget && selectForCompare(menuTarget.path),
		},
		{
			label: 'Compare with Selected',
			disabled: menuTarget?.kind !== 'file' || !selectedForCompare(),
			onSelect: () => menuTarget && void compareWithSelected(menuTarget.path),
		},
	];

	if (tree.isRootLoading) {
		return (
			<div className='flex h-24 items-center justify-center'>
				<Spinner />
			</div>
		);
	}
	if (tree.rootError)
		return <ErrorState message={tree.rootError.message} onRetry={tree.refetchAll} />;

	return (
		<>
			<ExplorerContextMenu items={menuItems}>
				<div
					ref={containerRef}
					role='tree'
					aria-label='Files'
					tabIndex={0}
					className='min-h-full py-1 outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--accent)]'
					onContextMenu={(e) => {
						if (e.target === e.currentTarget) setMenuTarget(null);
					}}
					onKeyDown={treeKeyHandler({
						rows: tree.rows,
						focused,
						setFocused,
						toggle: tree.toggle,
						open: openEntry,
						rename: setRenaming,
						remove: setConfirmDelete,
					})}
				>
					{tree.rows.map((row) => {
						if (row.kind === 'input') {
							return (
								<InlineNameInput
									key={`input-${row.parent}`}
									initial=''
									depth={row.depth}
									onCancel={() => setPending(null)}
									onSubmit={(name) => {
										setPending(null);
										void actions
											.create(row.parent, name, row.create)
											.then((created) => {
												if (!created) return;
												setFocused(created.path);
												if (created.kind === 'file')
													requestOpenFile({ path: created.path });
											});
									}}
								/>
							);
						}
						if (row.kind === 'loading') {
							return (
								<div
									key={`loading-${row.dir}`}
									className='flex h-6 items-center'
									style={{ paddingLeft: 8 + row.depth * 12 + 16 }}
								>
									<Spinner size={12} />
								</div>
							);
						}
						if (row.kind === 'error') {
							return (
								<div
									key={`error-${row.dir}`}
									className='flex h-6 items-center truncate text-11 text-down'
									style={{ paddingLeft: 8 + row.depth * 12 + 16 }}
									title={row.message}
								>
									{row.message}
								</div>
							);
						}
						if (renaming === row.entry.path) {
							return (
								<InlineNameInput
									key={`rename-${row.entry.path}`}
									initial={row.entry.name}
									depth={row.depth}
									onCancel={() => setRenaming(null)}
									onSubmit={(name) => {
										setRenaming(null);
										void actions
											.rename(row.entry.path, name)
											.then((renamed) => {
												if (renamed)
													setFocused(
														joinPath(
															parentOf(row.entry.path),
															renamed.name,
														),
													);
											});
									}}
								/>
							);
						}
						return (
							<TreeRowView
								key={row.entry.path}
								entry={row.entry}
								depth={row.depth}
								expanded={row.expanded}
								focused={focused === row.entry.path}
								active={activeFile === row.entry.path}
								onClick={() => {
									setFocused(row.entry.path);
									if (row.entry.kind === 'dir') tree.toggle(row.entry.path);
									else openEntry(row.entry);
								}}
								onDoubleClick={() => undefined}
								onContextMenu={() => {
									setFocused(row.entry.path);
									setMenuTarget(row.entry);
								}}
							/>
						);
					})}
				</div>
			</ExplorerContextMenu>
			<Dialog
				open={confirmDelete !== null}
				onOpenChange={(open) => !open && setConfirmDelete(null)}
				title='Move to Recycle Bin?'
				description={<span className='selectable font-mono'>{confirmDelete}</span>}
				width='sm'
				footer={
					<>
						<Button variant='ghost' onClick={() => setConfirmDelete(null)}>
							Cancel
						</Button>
						<Button
							variant='danger'
							autoFocus
							onClick={() => {
								const path = confirmDelete;
								setConfirmDelete(null);
								if (path) void actions.trash(path);
							}}
						>
							Move to Recycle Bin
						</Button>
					</>
				}
			/>
		</>
	);
}
