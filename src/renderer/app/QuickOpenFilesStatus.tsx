import type { JSX } from 'react';

import { ErrorState } from '../ui/ErrorState';

interface QuickOpenFilesStatusProps {
	hasRoot: boolean;
	loading: boolean;
	error: Error | null;
	onRetry: () => void;
	/** The file list loaded but nothing matches (or the folder is empty). */
	empty: boolean;
	query: string;
}

const message = 'px-3 py-6 text-center text-13 text-fg-2';

/** Quick Open's files-mode states: no folder, loading, error with Retry, and no matches. */
export function QuickOpenFilesStatus({
	hasRoot,
	loading,
	error,
	onRetry,
	empty,
	query,
}: QuickOpenFilesStatusProps): JSX.Element | null {
	if (!hasRoot) return <div className={message}>Open a folder first (Ctrl+O).</div>;
	if (loading) return <div className='shimmer mx-2 my-3 h-6 rounded-md' />;
	if (error)
		return (
			<ErrorState
				title='Could not list files'
				message={error.message}
				onRetry={onRetry}
				className='min-h-0 py-4'
			/>
		);
	if (empty)
		return (
			<div className={message}>
				{query ? `No files match “${query}”.` : 'No files in this folder.'}
			</div>
		);
	return null;
}
