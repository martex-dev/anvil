import { ArrowDown, ArrowUp, GitBranch, GitPullRequestArrow, RefreshCw } from 'lucide-react';
import type { JSX } from 'react';

import type { GitChange } from '@shared/ipc/channels/git';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { call } from '../../lib/ipc';
import { useTabsStore } from '../../stores/tabs-store';
import { toast } from '../../stores/toast-store';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';
import { ChangeList } from './ChangeList';
import { CommitBox } from './CommitBox';
import { useGitActions, useGitStatus } from './use-git';

const LANG_BY_EXT: Record<string, string> = {
	py: 'python',
	ts: 'typescript',
	tsx: 'typescript',
	js: 'javascript',
	json: 'json',
	md: 'markdown',
	toml: 'ini',
	yml: 'yaml',
	yaml: 'yaml',
	css: 'css',
	html: 'html',
	sql: 'sql',
};

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
		const ext = name.split('.').at(-1)?.toLowerCase() ?? '';
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
				language: LANG_BY_EXT[ext] ?? null,
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
	if (error) return <ErrorState title='Git failed' message={error.message} onRetry={refetch} />;
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
					label='Pull'
					icon={<ArrowDown size={13} />}
					disabled={actions.busy}
					onClick={actions.pull}
				/>
				<IconButton
					size='sm'
					label={status.tracking ? 'Push' : 'Publish Branch'}
					icon={<GitPullRequestArrow size={13} />}
					disabled={actions.busy}
					onClick={actions.push}
				/>
				<IconButton
					size='sm'
					label='Refresh'
					icon={<RefreshCw size={13} />}
					onClick={refetch}
				/>
			</div>
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
