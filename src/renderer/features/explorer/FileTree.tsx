import { type JSX, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { matchesShortcut } from '../../lib/shortcuts';
import { toast } from '../../stores/toast-store';
import { useFocusOnViewRequest } from '../../stores/view-focus-store';
import { requestOpenFile, useWorkbenchStore } from '../../stores/workbench-store';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import { useGitStatus } from '../git/use-git';
import { ConfirmTrashDialog } from './ConfirmTrashDialog';
import { useExplorerClipboard } from './explorer-clipboard';
import { gitDecorations } from './explorer-git';
import { explorerMenuItems } from './explorer-menu';
import { transferPaths } from './explorer-ops';
import { type FileTreeHandle, registerExplorerTree } from './explorer-tree-registry';
import { ExplorerContextMenu } from './ExplorerContextMenu';
import { FileTreeRows } from './FileTreeRows';
import { useFsActions } from './fs-actions';
import {
	ancestorsOf,
	isFolder,
	isWithin,
	neighbourAfterRemoval,
	parentOf,
	type PendingCreate,
	treeItemId,
} from './tree-model';
import { useEntryActions } from './use-entry-actions';
import { useFileTree } from './use-file-tree';
import { useRowWindow } from './use-row-window';
import { rowPath, useTreeDnd } from './use-tree-dnd';
import { createTypeAhead, treeKeyHandler } from './use-tree-keyboard';
import { useTreeReveal } from './use-tree-reveal';

export type { FileTreeHandle } from './explorer-tree-registry';

interface FileTreeProps {
	root: string;
	handleRef: React.RefObject<FileTreeHandle | null>;
}

const NOTHING_CUT: ReadonlySet<string> = new Set();

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
	// The tree only renders once the root listing has loaded; focus it then.
	useFocusOnViewRequest('explorer', containerRef, !tree.isRootLoading && !tree.rootError);

	const entries = useMemo(
		() =>
			new Map(
				tree.rows.flatMap((r) => (r.kind === 'entry' ? [[r.entry.path, r.entry]] : [])),
			),
		[tree.rows],
	);
	const gitStatus = useGitStatus().status;
	const git = useMemo(() => gitDecorations(gitStatus), [gitStatus]);
	const heldPaths = useExplorerClipboard((s) => s.held);
	const cut = useMemo(
		() =>
			heldPaths?.mode === 'cut' && heldPaths.root === root
				? new Set(heldPaths.paths)
				: NOTHING_CUT,
		[heldPaths, root],
	);
	const win = useRowWindow(containerRef, tree.rows.length);

	const focusedEntry = focused ? entries.get(focused) : undefined;
	const focusedPath = focusedEntry?.path ?? null;
	const baseDir = (entry: FsEntry | null | undefined): string =>
		!entry ? '' : isFolder(entry) ? entry.path : parentOf(entry.path);

	const startCreate = (kind: 'file' | 'dir', target?: FsEntry | null): void => {
		const parent = baseDir(target ?? focusedEntry);
		if (parent) tree.expand([...ancestorsOf(`${parent}/x`)]);
		setPending({ parent, kind });
	};

	const reveal = (path: string): void => {
		tree.expand(ancestorsOf(path));
		setFocused(path);
	};
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
	// Pasted, duplicated or dropped items: show and select the last one.
	const placed = (list: FsEntry[]): void => {
		const last = list.at(-1);
		if (last) reveal(last.path);
	};
	const entryActions = useEntryActions(root, placed);
	const dnd = useTreeDnd(entries, (mode, paths, dir) => {
		void transferPaths(root, mode, paths, dir).then(placed);
	});

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

	useTreeReveal({
		rows: tree.rows,
		isRootLoading: tree.isRootLoading,
		containerRef,
		focused,
		activeFile,
		reveal,
	});

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
	/** Ctrl+X / C / V on the tree itself (never inside a name input, where they edit text). */
	const clipboardKey = (event: React.KeyboardEvent): boolean => {
		if (event.target !== event.currentTarget) return false;
		if (matchesShortcut(event, 'Ctrl+V')) {
			entryActions.paste(focusedEntry ? baseDir(focusedEntry) : '');
			return true;
		}
		const hold = matchesShortcut(event, 'Ctrl+X')
			? entryActions.cut
			: matchesShortcut(event, 'Ctrl+C')
				? entryActions.copy
				: null;
		if (!hold) return false;
		if (focusedPath) hold(focusedPath);
		return true;
	};
	// A keyboard-opened menu fires `contextmenu` on the tree itself, like a right-click on its
	// empty area; the key that opened it tells the two apart.
	const menuFromKeyboard = useRef(false);

	const menuItems = explorerMenuItems({
		target: menuTarget,
		startCreate,
		rename: setRenaming,
		remove: setConfirmDelete,
		actions: entryActions,
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
					data-drop-target={dnd.dropTarget === '' || undefined}
					className='min-h-full py-1 outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--accent)] data-[drop-target]:bg-accent-faint'
					onPointerDown={() => {
						menuFromKeyboard.current = false;
					}}
					onClick={(e) => {
						// Rows are found by `data-path`, so they need no handlers of their own.
						const entry = entries.get(rowPath(e.target) ?? '');
						if (!entry) return;
						setFocused(entry.path);
						openEntry(entry);
					}}
					onContextMenu={(e) => {
						// Shift+F10 / the Menu key target the focused tree, so act on its focused row.
						if (menuFromKeyboard.current) {
							menuFromKeyboard.current = false;
							setMenuTarget(focusedEntry ?? null);
							return;
						}
						// Anything but an entry row (empty space, a loading or error row, an inline
						// input) has no target, not the previously right-clicked one.
						const entry = entries.get(rowPath(e.target) ?? '') ?? null;
						if (entry) setFocused(entry.path);
						setMenuTarget(entry);
					}}
					onKeyDown={(e) => {
						menuFromKeyboard.current =
							e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey);
						if (clipboardKey(e)) {
							e.preventDefault();
							return;
						}
						onTreeKey(e);
					}}
					onDragStart={dnd.onDragStart}
					onDragOver={dnd.onDragOver}
					onDragLeave={dnd.onDragLeave}
					onDrop={dnd.onDrop}
					onDragEnd={dnd.onDragEnd}
				>
					<FileTreeRows
						rows={tree.rows}
						window={win}
						focused={focused}
						activeFile={activeFile}
						renaming={renaming}
						git={git}
						cut={cut}
						dropTarget={dnd.dropTarget}
						onCancelCreate={() => {
							setPending(null);
							restoreFocus();
						}}
						onCreate={async (parent, name, kind) => {
							// Stays open until this settles, so a failure keeps the typed name.
							const created = await actions.create(parent, name, kind);
							setPending(null);
							restoreFocus();
							// A nested name made folders on the way: open them to show the new item.
							reveal(created.path);
							if (created.kind === 'file') requestOpenFile({ path: created.path });
						}}
						onCancelRename={() => {
							setRenaming(null);
							restoreFocus();
						}}
						onRename={async (entry, name) => {
							const renamed = await actions.rename(entry.path, name);
							setRenaming(null);
							restoreFocus();
							setFocused(renamed.path);
						}}
					/>
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
