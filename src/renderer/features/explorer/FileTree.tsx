import { type JSX, useEffect, useImperativeHandle, useRef, useState } from 'react';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { toast } from '../../stores/toast-store';
import { requestOpenFile, useWorkbenchStore } from '../../stores/workbench-store';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import { explorerMenuItems } from './explorer-menu';
import { type FileTreeHandle, registerExplorerTree } from './explorer-tree-registry';
import { ExplorerContextMenu } from './ExplorerContextMenu';
import { useFsActions } from './fs-actions';
import { InlineNameInput } from './InlineNameInput';
import { ancestorsOf, joinPath, parentOf, type PendingCreate } from './tree-model';
import { TreeRowView } from './TreeRowView';
import { useFileTree } from './use-file-tree';
import { treeKeyHandler } from './use-tree-keyboard';

export type { FileTreeHandle } from './explorer-tree-registry';

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

	const reveal = (path: string): void => {
		tree.expand(ancestorsOf(path));
		setFocused(path);
	};
	const focusedPath = focusedEntry?.kind === 'entry' ? focusedEntry.entry.path : null;
	// Closing an inline name input unmounts the focused element, dropping focus to <body>. Hand
	// it back to the tree (after the unmount) so arrows, F2 and Delete keep working, unless the
	// user already moved focus somewhere else, e.g. by clicking the editor.
	const restoreFocus = (): void => {
		requestAnimationFrame(() => {
			const active = document.activeElement;
			if (!active || active === document.body) {
				containerRef.current?.focus({ preventScroll: true });
			}
		});
	};
	const withFocused = (action: (path: string) => void) => (): void => {
		if (focusedPath) action(focusedPath);
		else toast.info('Select a file or folder in the Explorer first');
	};

	useImperativeHandle(handleRef, () => ({
		startCreate: (kind) => startCreate(kind),
		collapseAll: tree.collapseAll,
		refresh: tree.refetchAll,
		revealActive: () => {
			if (activeFile) reveal(activeFile);
			else toast.info('No active file to reveal');
		},
		renameFocused: withFocused(setRenaming),
		deleteFocused: withFocused(setConfirmDelete),
	}));
	// Palette commands reach the tree through this registration (see explorer/commands.ts).
	useEffect(() => registerExplorerTree(handleRef), [handleRef]);

	// Follow the editor: reveal and highlight the active file. Adjusting state during render
	// (instead of in an effect) avoids an extra render pass.
	const [seenActive, setSeenActive] = useState<string | null>(null);
	if (activeFile !== seenActive) {
		setSeenActive(activeFile);
		if (activeFile) reveal(activeFile);
	}

	// Scroll the focused row into view once it exists: revealing a nested file expands folders
	// whose listings load later, so the row may only appear after a few more renders.
	const scrolledTo = useRef<string | null>(null);
	useEffect(() => {
		if (!focused) scrolledTo.current = null;
		if (!focused || scrolledTo.current === focused) return;
		const row = containerRef.current?.querySelector(`[data-path="${CSS.escape(focused)}"]`);
		if (!row) return;
		scrolledTo.current = focused;
		row.scrollIntoView({ block: 'nearest' });
	}, [focused, tree.rows]);

	const openEntry = (entry: FsEntry): void => {
		if (entry.kind === 'dir') {
			tree.toggle(entry.path);
			return;
		}
		if (!requestOpenFile({ path: entry.path })) {
			toast.warn('Open a folder first');
		}
	};

	const onTreeKey = treeKeyHandler({
		rows: tree.rows,
		focused,
		setFocused,
		toggle: tree.toggle,
		open: openEntry,
		rename: setRenaming,
		remove: setConfirmDelete,
	});
	// A keyboard-opened menu fires `contextmenu` on the tree itself, like a right-click on its
	// empty area; the key that opened it tells the two apart.
	const menuFromKeyboard = useRef(false);

	const menuItems = explorerMenuItems({
		target: menuTarget,
		startCreate,
		rename: setRenaming,
		remove: setConfirmDelete,
	});

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
					onPointerDown={() => {
						menuFromKeyboard.current = false;
					}}
					onContextMenu={(e) => {
						// Shift+F10 / the Menu key target the focused tree, so act on its focused row.
						if (menuFromKeyboard.current) {
							menuFromKeyboard.current = false;
							setMenuTarget(
								focusedEntry?.kind === 'entry' ? focusedEntry.entry : null,
							);
							return;
						}
						// Entry rows set their own target. Anything else (empty space, a loading or
						// error row, an inline input) has none, not the previously right-clicked one.
						const onRow =
							e.target instanceof Element && e.target.closest('[role="treeitem"]');
						if (!onRow) setMenuTarget(null);
					}}
					onKeyDown={(e) => {
						menuFromKeyboard.current =
							e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey);
						onTreeKey(e);
					}}
				>
					{tree.rows.map((row) => {
						if (row.kind === 'input') {
							return (
								<InlineNameInput
									key={`input-${row.parent}`}
									initial=''
									depth={row.depth}
									onCancel={() => {
										setPending(null);
										restoreFocus();
									}}
									onSubmit={(name) => {
										setPending(null);
										restoreFocus();
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
									onCancel={() => {
										setRenaming(null);
										restoreFocus();
									}}
									onSubmit={(name) => {
										setRenaming(null);
										restoreFocus();
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
