import { FileWarning, FolderOpen, Table } from 'lucide-react';
import type { JSX } from 'react';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import type { OpenFile } from './editor-store';
import { canOpenAsTable } from './open';

function reveal(path: string): void {
	call('fs:reveal', path).catch((error: unknown) =>
		toast.error(
			'Could not reveal the file',
			error instanceof Error ? error.message : undefined,
		),
	);
}

/** What a code tab shows instead of the editor: a failed read, a binary or a too-large file. */
export function FileStatus({ file }: { file: OpenFile }): JSX.Element | null {
	if (file.state === 'error')
		return (
			<ErrorState
				title={`Couldn't open ${file.name}`}
				message={file.error ?? 'Unknown error'}
				// Opening an errored file again re-reads it (e.g. once another program unlocks it).
				onRetry={() => requestOpenFile({ path: file.path })}
			/>
		);
	if (file.state === 'binary' || file.state === 'tooLarge')
		return (
			<EmptyState
				icon={<FileWarning size={22} />}
				title={file.state === 'binary' ? 'Binary file' : 'File too large'}
				description={
					file.state === 'binary'
						? `${file.name} isn't text, so it isn't shown here.`
						: `${file.name} is over 5 MB. Open it in another program.`
				}
				action={
					<div className='flex flex-wrap justify-center gap-2'>
						{canOpenAsTable(file.path) && (
							<Button
								size='sm'
								variant='primary'
								icon={<Table size={13} />}
								onClick={() => requestOpenFile({ path: file.path, as: 'data' })}
							>
								Open as Table
							</Button>
						)}
						<Button
							size='sm'
							icon={<FolderOpen size={13} />}
							onClick={() => reveal(file.path)}
						>
							Reveal in File Explorer
						</Button>
					</div>
				}
			/>
		);
	return null;
}
