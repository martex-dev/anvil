import { Folder, FolderOpen, Link2 } from 'lucide-react';
import type { JSX } from 'react';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { FileBadge } from '../../ui/FileBadge';

interface EntryIconProps {
	kind: FsEntry['kind'];
	name: string;
	open?: boolean;
}

/** The Explorer's icon for a file, folder or link (also shown next to inline name inputs). */
export function EntryIcon({ kind, name, open = false }: EntryIconProps): JSX.Element {
	if (kind === 'dir')
		return open ? (
			<FolderOpen size={14} className='text-accent/80' />
		) : (
			<Folder size={14} className='text-accent/60' />
		);
	if (kind === 'symlink') return <Link2 size={14} className='text-fg-2' />;
	return <FileBadge name={name} />;
}
