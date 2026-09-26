import { type JSX, useEffect, useImperativeHandle, useRef, useState } from 'react';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { toast } from '../../stores/toast-store';
import { requestOpenFile, useWorkbenchStore } from '../../stores/workbench-store';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import { ConfirmTrashDialog } from './ConfirmTrashDialog';
import { explorerMenuItems } from './explorer-menu';
import { type FileTreeHandle, registerExplorerTree } from './explorer-tree-registry';
import { ExplorerContextMenu } from './ExplorerContextMenu';
import { useFsActions } from './fs-actions';
import { InlineNameInput } from './InlineNameInput';
import {
	ancestorsOf,
	isFolder,
	isWithin,
	neighbourAfterRemoval,
	parentOf,
	type PendingCreate,
	siblingNames,
	treeItemId,
} from './tree-model';
import { TreeRowView } from './TreeRowView';
import { TreeStatusRow } from './TreeStatusRow';
import { useFileTree } from './use-file-tree';
import { createTypeAhead, treeKeyHandler } from './use-tree-keyboard';

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
		!entry ? '' : isFolder(entry) ? entry.path : parentOf(entry.path);

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
		if (isFolder(entry)) {
			tree.toggle(entry.path);
			return;
		}
		if (!requestOpenFile({ path: entry.path })) {
			toast.warn('Open a folder first');
		}
	};

	const [typeAhead] = useState(() => createTypeAhead());
	const onTreeKey = treeKeyHandler({
		rows: tree.rows,
		focused,
		setFocused,
		toggle: tree.toggle,
		open: openEntry,
		rename: setRenaming,
		remove: setConfirmDelete,
		typeAhead,
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
					// DOM focus stays on the tree; this tells screen readers which row is current.
					aria-activedescendant={
						focusedPath && focusedPath !== renaming
							? treeItemId(focusedPath)
							: undefined
					}
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
									mode='create'
									kind={row.create}
									initial=''
									depth={row.depth}
									siblings={siblingNames(tree.rows, row.parent)}
									onCancel={() => {
										setPending(null);
										restoreFocus();
									}}
									onSubmit={async (name) => {
										// Stays open until this settles, so a failure keeps the typed name.
										const created = await actions.create(
											row.parent,
											name,
											row.create,
										);
										setPending(null);
										restoreFocus();
										setFocused(created.path);
										if (created.kind === 'file')
											requestOpenFile({ path: created.path });
									}}
								/>
							);
						}
						if (row.kind === 'loading' || row.kind === 'error') {
							return <TreeStatusRow key={`${row.kind}-${row.dir}`} row={row} />;
						}
						if (renaming === row.entry.path) {
							return (
								<InlineNameInput
									key={`rename-${row.entry.path}`}
									mode='rename'
									kind={row.entry.kind}
									initial={row.entry.name}
									depth={row.depth}
									siblings={siblingNames(
										tree.rows,
										parentOf(row.entry.path),
										row.entry.path,
									)}
									onCancel={() => {
										setRenaming(null);
										restoreFocus();
									}}
									onSubmit={async (name) => {
										const renamed = await actions.rename(row.entry.path, name);
										setRenaming(null);
										restoreFocus();
										setFocused(renamed.path);
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
									if (isFolder(row.entry)) tree.toggle(row.entry.path);
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
			<ConfirmTrashDialog
				path={confirmDelete}
				onCancel={() => setConfirmDelete(null)}
				onConfirm={(path) => {
					setConfirmDelete(null);
					// Keep keyboard navigation in place: focus the neighbour, not the top.
					const next = neighbourAfterRemoval(tree.rows, path);
					void actions.trash(path).then((trashed) => {
						if (trashed) setFocused((f) => (f && isWithin(f, path) ? next : f));
					});
				}}
			/>
		</>
	);
}
