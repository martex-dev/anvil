import { Check, Sparkles } from 'lucide-react';
import { type JSX, useState } from 'react';

import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { IconButton } from '../../ui/IconButton';
import { Kbd } from '../../ui/Kbd';
import { generateCommitMessage } from '../ai/actions';
import { useCommitDrafts } from './commit-draft-store';

interface CommitBoxProps {
	/** Workspace root; the unsent message is kept per folder. */
	root: string;
	branch: string | null;
	stagedCount: number;
	busy: boolean;
	onCommit: (message: string) => Promise<boolean>;
}

export function CommitBox({
	root,
	branch,
	stagedCount,
	busy,
	onCommit,
}: CommitBoxProps): JSX.Element {
	const message = useCommitDrafts((s) => s.drafts[root] ?? '');
	const setDraft = useCommitDrafts((s) => s.setDraft);
	const setMessage = (text: string): void => setDraft(root, text);
	const writing = useCommitDrafts((s) => s.writingRoot === root);
	const setWritingRoot = useCommitDrafts((s) => s.setWritingRoot);
	const [confirmReplace, setConfirmReplace] = useState(false);

	const generate = (): void => {
		setWritingRoot(root);
		void generateCommitMessage((partial) => setDraft(root, partial))
			.catch((error: unknown) =>
				toast.error(
					'Could not write a message',
					error instanceof Error ? error.message : undefined,
				),
			)
			.finally(() => setWritingRoot(null));
	};
	const requestGenerate = (): void => {
		if (stagedCount === 0) {
			toast.info('Stage changes first', 'The message is written from what is staged.');
			return;
		}
		// Never silently throw away a message the user wrote.
		if (message.trim()) setConfirmReplace(true);
		else generate();
	};
	const canCommit = message.trim().length > 0 && stagedCount > 0 && !busy;

	const submit = (): void => {
		if (!canCommit) return;
		void onCommit(message.trim()).then((ok) => {
			if (ok) setMessage('');
		});
	};

	return (
		<div className='flex flex-col gap-1.5 p-2'>
			<div className='relative'>
				<textarea
					value={message}
					// The stream replaces the text on every chunk; typing now would be erased.
					readOnly={writing}
					aria-busy={writing || undefined}
					onChange={(e) => setMessage(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
							e.preventDefault();
							submit();
						}
					}}
					rows={3}
					spellCheck
					aria-label='Commit message'
					placeholder={
						branch ? `Message (Ctrl+Enter to commit on ${branch})` : 'Commit message'
					}
					className={`selectable w-full resize-y rounded-md border border-border-strong bg-bg-2/60 py-1.5 pr-8 pl-2 text-12 text-fg-0 outline-none placeholder:text-fg-2 focus:border-accent focus:shadow-glow ${writing ? 'shimmer' : ''}`}
				/>
				<IconButton
					size='sm'
					label='Write the message with AI (from staged changes)'
					icon={<Sparkles size={12} className='text-accent-2' />}
					disabled={writing}
					onClick={requestGenerate}
					className='absolute top-1 right-1'
				/>
			</div>
			<Button
				variant='primary'
				size='sm'
				icon={<Check size={12} />}
				disabled={!canCommit}
				loading={busy}
				onClick={submit}
				title={stagedCount === 0 ? 'Stage changes first' : undefined}
			>
				Commit{stagedCount > 0 ? ` ${stagedCount} file${stagedCount === 1 ? '' : 's'}` : ''}
				<Kbd keys='Ctrl+Enter' className='ml-1 opacity-70' />
			</Button>
			<Dialog
				open={confirmReplace}
				onOpenChange={setConfirmReplace}
				title='Replace your commit message?'
				description='The AI writes a new message from the staged changes; the one you typed is replaced.'
				width='sm'
				footer={
					<>
						<Button variant='ghost' onClick={() => setConfirmReplace(false)}>
							Keep mine
						</Button>
						<Button
							variant='primary'
							autoFocus
							onClick={() => {
								setConfirmReplace(false);
								generate();
							}}
						>
							Replace
						</Button>
					</>
				}
			/>
		</div>
	);
}
