import { Check, Sparkles } from 'lucide-react';
import { type JSX, useState } from 'react';

import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Kbd } from '../../ui/Kbd';
import { generateCommitMessage } from '../ai/actions';

interface CommitBoxProps {
	branch: string | null;
	stagedCount: number;
	busy: boolean;
	onCommit: (message: string) => Promise<boolean>;
}

export function CommitBox({ branch, stagedCount, busy, onCommit }: CommitBoxProps): JSX.Element {
	const [message, setMessage] = useState('');
	const [writing, setWriting] = useState(false);
	const generate = (): void => {
		if (stagedCount === 0) {
			toast.info('Stage changes first', 'The message is written from what is staged.');
			return;
		}
		setWriting(true);
		void generateCommitMessage((partial) => setMessage(partial))
			.catch((error: unknown) =>
				toast.error(
					'Could not write a message',
					error instanceof Error ? error.message : undefined,
				),
			)
			.finally(() => setWriting(false));
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
					onClick={generate}
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
		</div>
	);
}
