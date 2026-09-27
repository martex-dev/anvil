import type { JSX } from 'react';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { decorationFor, type GitDecorations } from './explorer-git';
import { InlineNameInput } from './InlineNameInput';
import { isFolder, parentOf, siblingNames, type TreeRow } from './tree-model';
import { TreeRowView } from './TreeRowView';
import { TreeStatusRow } from './TreeStatusRow';
import type { RowWindow } from './use-row-window';

interface FileTreeRowsProps {
	rows: TreeRow[];
	window: RowWindow;
	focused: string | null;
	activeFile: string | null;
	renaming: string | null;
	git: GitDecorations;
	/** Paths cut and waiting for Paste. */
	cut: ReadonlySet<string>;
	dropTarget: string | null;
	onCreate: (parent: string, name: string, kind: 'file' | 'dir') => Promise<void>;
	onCancelCreate: () => void;
	onRename: (entry: FsEntry, name: string) => Promise<void>;
	onCancelRename: () => void;
}

/** The visible slice of the tree's rows, with spacers standing in for the rest. */
export function FileTreeRows({
	rows,
	window: win,
	focused,
	activeFile,
	renaming,
	git,
	cut,
	dropTarget,
	onCreate,
	onCancelCreate,
	onRename,
	onCancelRename,
}: FileTreeRowsProps): JSX.Element {
	return (
		<>
			{win.before > 0 && <div aria-hidden style={{ height: win.before }} />}
			{rows.slice(win.start, win.end).map((row) => {
				if (row.kind === 'input') {
					return (
						<InlineNameInput
							key={`input-${row.parent}`}
							mode='create'
							kind={row.create}
							initial=''
							depth={row.depth}
							siblings={siblingNames(rows, row.parent)}
							onCancel={onCancelCreate}
							onSubmit={(name) => onCreate(row.parent, name, row.create)}
						/>
					);
				}
				if (row.kind === 'loading' || row.kind === 'error') {
					return <TreeStatusRow key={`${row.kind}-${row.dir}`} row={row} />;
				}
				const { entry } = row;
				if (renaming === entry.path) {
					return (
						<InlineNameInput
							key={`rename-${entry.path}`}
							mode='rename'
							kind={entry.kind}
							initial={entry.name}
							depth={row.depth}
							siblings={siblingNames(rows, parentOf(entry.path), entry.path)}
							onCancel={onCancelRename}
							onSubmit={(name) => onRename(entry, name)}
						/>
					);
				}
				return (
					<TreeRowView
						key={entry.path}
						entry={entry}
						depth={row.depth}
						expanded={row.expanded}
						focused={focused === entry.path}
						active={activeFile === entry.path}
						git={decorationFor(git, entry.path, isFolder(entry))}
						cut={cut.has(entry.path)}
						dropTarget={dropTarget === entry.path}
					/>
				);
			})}
			{win.after > 0 && <div aria-hidden style={{ height: win.after }} />}
		</>
	);
}
