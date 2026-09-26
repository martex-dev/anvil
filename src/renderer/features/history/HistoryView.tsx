import { useQuery } from '@tanstack/react-query';
import { History, RotateCcw, Trash2 } from 'lucide-react';
import { type JSX, useState } from 'react';

import { useSettings } from '../../app/hooks/use-settings';
import { useWorkspace } from '../../app/hooks/use-workspace';
import { call } from '../../lib/ipc';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { useTabsStore } from '../../stores/tabs-store';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';
import { useEditorStore } from '../editor/editor-store';
import { getModel } from '../editor/file-ops';

function ago(ms: number): string {
	const s = (Date.now() - ms) / 1000;
	if (s < 60) return 'just now';
	if (s < 3600) return `${Math.floor(s / 60)} min ago`;
	if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
	return `${Math.floor(s / 86_400)} d ago`;
}

const bytes = (n: number): string => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

/** Snapshots taken on every save of the active file; compare or roll back without git. */
export function HistoryView(): JSX.Element {
	const path = useEditorStore((s) => s.active);
	const { settings, update } = useSettings();
	const { info } = useWorkspace();
	const q = useQuery({
		// Snapshots are stored per project: the same relative path in another folder is
		// another file's history.
		queryKey: ['history', info.root, path],
		queryFn: () => call('history:list', path ?? ''),
		enabled: Boolean(path),
	});
	useAnvilEvent('fs:changed', ({ files }) => {
		if (path && files.includes(path)) void q.refetch();
	});
	const [restore, setRestore] = useState<string | null>(null);

	const compare = async (id: string, time: number): Promise<void> => {
		if (!path) return;
		const { content } = await call('history:read', { path, id });
		const current = getModel(path)?.getValue() ?? '';
		const name = path.split('/').at(-1) ?? path;
		useTabsStore.getState().open({
			id: `diff:history:${path}:${id}`,
			kind: 'diff',
			path: null,
			title: `${name} @ ${new Date(time).toLocaleTimeString([], { hour12: false })}`,
			preview: true,
			diff: {
				title: `${path} · snapshot ${new Date(time).toLocaleString()} ↔ current`,
				original: content,
				modified: current,
				language: getModel(path)?.getLanguageId() ?? null,
				path,
			},
		});
	};

	const doRestore = async (id: string): Promise<void> => {
		if (!path) return;
		const model = getModel(path);
		if (!model) return;
		const { content } = await call('history:read', { path, id });
		// An edit, not a file write: undo gets you back, and saving is your call.
		model.pushEditOperations(
			[],
			[{ range: model.getFullModelRange(), text: content }],
			() => null,
		);
		toast.success('Snapshot restored', 'Save to keep it, or undo (Ctrl+Z).');
	};

	if (!settings.localHistory) {
		return (
			<EmptyState
				icon={<History size={20} />}
				title='Local history is off'
				description='Turn it on to keep a snapshot of every save.'
				action={
					<Button size='sm' onClick={() => update({ localHistory: true })}>
						Turn on
					</Button>
				}
			/>
		);
	}
	if (!path)
		return (
			<EmptyState
				icon={<History size={20} />}
				title='No file'
				description='Open a file to see its saved snapshots.'
			/>
		);
	const items = q.data ?? [];
	return (
		<div className='flex h-full flex-col'>
			<div className='flex items-center gap-2 px-3 py-2'>
				<span className='truncate font-mono text-11 text-fg-1'>{path}</span>
				<span className='flex-1' />
				{items.length > 0 && (
					<IconButton
						size='sm'
						label='Clear history for this file'
						icon={<Trash2 size={12} />}
						onClick={() => void call('history:clear', path).then(() => q.refetch())}
					/>
				)}
			</div>
			{q.isLoading ? (
				<div className='flex h-24 items-center justify-center'>
					<Spinner label='Reading snapshots' />
				</div>
			) : q.error && !q.data ? (
				<ErrorState
					title='Could not read local history'
					message={q.error.message}
					onRetry={() => void q.refetch()}
				/>
			) : items.length === 0 ? (
				<p className='px-3 text-12 text-fg-2'>
					No snapshots yet. One is kept every time you save (up to 50, 30 days).
				</p>
			) : (
				<ol className='relative min-h-0 flex-1 overflow-auto pb-3 pl-3'>
					<span className='absolute top-2 bottom-3 left-[17px] w-px bg-glass-edge' />
					{items.map((s, i) => (
						<li key={s.id} className='group relative flex items-center gap-3 py-1 pr-2'>
							<span
								className={
									i === 0
										? 'z-10 size-2.5 rounded-full bg-accent shadow-glow'
										: 'z-10 size-2.5 rounded-full border border-border-strong bg-bg-2'
								}
							/>
							<button
								type='button'
								onClick={() => void compare(s.id, s.time)}
								className='flex min-w-0 flex-1 flex-col text-left outline-none'
							>
								<span className='text-12 text-fg-0 group-hover:text-accent'>
									{ago(s.time)}
								</span>
								<span className='num text-10 text-fg-2'>
									{new Date(s.time).toLocaleString([], { hour12: false })} ·{' '}
									{bytes(s.size)}
								</span>
							</button>
							<IconButton
								size='sm'
								label='Restore this version'
								icon={<RotateCcw size={12} />}
								onClick={() => setRestore(s.id)}
								className='opacity-0 group-hover:opacity-100'
							/>
						</li>
					))}
				</ol>
			)}
			<Dialog
				open={restore !== null}
				onOpenChange={(open) => !open && setRestore(null)}
				title='Restore this snapshot?'
				description='It replaces the editor contents. You can undo, and nothing is saved until you save.'
				width='sm'
				footer={
					<>
						<Button variant='ghost' onClick={() => setRestore(null)}>
							Cancel
						</Button>
						<Button
							variant='primary'
							onClick={() => {
								if (restore) void doRestore(restore);
								setRestore(null);
							}}
						>
							Restore
						</Button>
					</>
				}
			/>
		</div>
	);
}
