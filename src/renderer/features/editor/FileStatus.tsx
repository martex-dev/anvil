import { FileWarning } from 'lucide-react';
import type { JSX } from 'react';

import { requestOpenFile } from '../../stores/workbench-store';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import type { OpenFile } from './editor-store';

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
			/>
		);
	return null;
}
