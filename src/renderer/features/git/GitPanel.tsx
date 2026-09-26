import { ArrowDown, ArrowUp, CloudUpload, GitBranch, RefreshCw, TriangleAlert } from 'lucide-react';
import { type JSX, useState } from 'react';

import type { GitChange } from '@shared/ipc/channels/git';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { call } from '../../lib/ipc';
import { getLoadedMonaco } from '../../lib/monaco/load';
import { useTabsStore } from '../../stores/tabs-store';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';
import { getModel, languageOverride } from '../editor/file-ops';
import { ChangeList } from './ChangeList';
import { CommitBox } from './CommitBox';
import { languageForFile } from './diff-language';
import { useGitActions, useGitStatus } from './use-git';

/**
 * Diff highlighting: the open buffer's language (what the editor shows), else the editor's own
 * cousins for grammar-less files, else Monaco's registry by file name.
 */
function diffLanguage(name: string, workspacePath: string | null): string | null {
	const open = workspacePath ? getModel(workspacePath) : null;
	if (open) return open.getLanguageId();
	return (
		languageOverride(name) ??
		languageForFile(name, getLoadedMonaco()?.languages.getLanguages() ?? null)
	);
}

/** Opens a git change as a diff tab (HEAD/index vs working tree). */
export async function openDiff(change: GitChange, staged: boolean): Promise<void> {
	const name = change.path.split('/').at(-1) ?? change.path;
	try {
		const d = await call('git:diff', {
			path: change.path,
			staged,
			...(change.from ? { from: change.from } : {}),
		});
		if (d.binary) {
			toast.info('Binary file', `${name} can't be shown as a text diff.`);
			return;
		}
		useTabsStore.getState().open({
			id: `diff:git:${staged ? 'staged' : 'wt'}:${change.path}`,
			kind: 'diff',
			path: null,
			title: `${name} ${staged ? '(staged)' : '(changes)'}`,
			preview: true,
			diff: {
				title: `${change.path} · ${staged ? 'HEAD ↔ index' : 'index ↔ working tree'}`,
				original: d.original,
				modified: d.modified,
				language: diffLanguage(name, change.workspacePath),
				path: change.workspacePath,
			},
		});
	} catch (error) {
		toast.error('Could not load the diff', error instanceof Error ? error.message : undefined);
	}
}

export function GitPanel(): JSX.Element {
	const { info } = useWorkspace();
	const { status, isLoading, error, refetch } = useGitStatus();
	const actions = useGitActions();
	// Only a refresh the user asked for shows a spinner; the 5 s poll would make it flicker.
	const [refreshing, setRefreshing] = useState(false);
	const refresh = (): void => {
		setRefreshing(true);
		void refetch().finally(() => setRefreshing(false));
	};

	if (!info.root) {
		return (
			<EmptyState
				icon={<GitBranch size={22} />}
				title='No folder open'
				description='Open a project to see its changes.'
			/>
		);
	}
	if (isLoading) {
		return (
			<div className='flex h-24 items-center justify-center'>
				<Spinner label='Reading repository' />
			</div>
		);
	}
	// Only a failure with nothing to show replaces the panel. A failed poll after a good one (a
	// terminal git holding the index lock) keeps the last status, and the unsent commit message.
	if (error && !status)
		return <ErrorState title='Git failed' message={error.message} onRetry={refresh} />;
	if (!status?.isRepo) {
		return (
			<EmptyState
				icon={<GitBranch size={22} />}
				title='Not a git repository'
				description='Run `git init` in a terminal to start tracking this folder.'
			/>
		);
	}

	const clean = status.staged.length === 0 && status.unstaged.length === 0;
	return (
		<div className='flex h-full flex-col'>
			<div className='flex h-7 shrink-0 items-center gap-1 border-b border-glass-edge pr-1 pl-2 text-12'>
				<GitBranch size={13} className='text-accent' />
				<span
					className='num min-w-0 flex-1 truncate text-fg-0'
					title={status.tracking ?? 'No upstream'}
				>
					{status.detached ? `(detached) ${status.branch ?? ''}` : status.branch}
				</span>
				{(status.ahead > 0 || status.behind > 0) && (
					<span
						className='num flex items-center gap-1 text-11 text-fg-1'
						title={`${status.behind} behind, ${status.ahead} ahead`}
					>
						<ArrowDown size={11} />
						{status.behind}
						<ArrowUp size={11} />
						{status.ahead}
					</span>
				)}
				<IconButton
					size='sm'
					label={
						actions.pulling
							? 'Pulling…'
							: status.tracking
								? 'Pull'
								: 'Pull (no upstream: publish the branch first)'
					}
					icon={
						actions.pulling ? (
							<Spinner size={12} label='Pulling' />
						) : (
							<ArrowDown size={13} />
						)
					}
					// Without an upstream, git pull can only fail with "no tracking information".
					disabled={actions.busy || !status.tracking}
					onClick={actions.pull}
				/>
				<IconButton
					size='sm'
					label={
						actions.pushing ? 'Pushing…' : status.tracking ? 'Push' : 'Publish Branch'
					}
					icon={
						actions.pushing ? (
							<Spinner size={12} label='Pushing' />
						) : status.tracking ? (
							<ArrowUp size={13} />
						) : (
							<CloudUpload size={13} />
						)
					}
					disabled={actions.busy}
					onClick={actions.push}
				/>
				<IconButton
					size='sm'
					label={refreshing ? 'Refreshing…' : 'Refresh'}
					icon={
						refreshing ? (
							<Spinner size={12} label='Refreshing' />
						) : (
							<RefreshCw size={13} />
						)
					}
					aria-busy={refreshing || undefined}
					onClick={refresh}
				/>
			</div>
			{error && (
				<div
					role='status'
					className='flex shrink-0 items-center gap-1.5 border-b border-glass-edge py-0.5 pr-1 pl-2 text-11 text-warn'
				>
					<TriangleAlert size={12} className='shrink-0' />
					<span className='min-w-0 flex-1 truncate' title={error.message}>
						Couldn&rsquo;t refresh: {error.message}
					</span>
					<Button variant='ghost' size='sm' loading={refreshing} onClick={refresh}>
						Retry
					</Button>
				</div>
			)}
			<CommitBox
				root={info.root}
				branch={status.branch}
				stagedCount={status.staged.length}
				busy={actions.busy}
				onCommit={actions.commit}
			/>
			<div className='min-h-0 flex-1 overflow-auto pb-2'>
				{clean ? (
					<p className='px-3 py-4 text-center text-12 text-fg-2'>
						No changes. Working tree is clean.
					</p>
				) : (
					<>
						<ChangeList
							title='Staged Changes'
							changes={status.staged}
							staged
							busy={actions.busy}
							onOpen={(c) => void openDiff(c, true)}
							onToggle={actions.unstage}
						/>
						<ChangeList
							title='Changes'
							changes={status.unstaged}
							staged={false}
							busy={actions.busy}
							onOpen={(c) => void openDiff(c, false)}
							onToggle={actions.stage}
						/>
					</>
				)}
			</div>
		</div>
	);
}
