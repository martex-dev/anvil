import { type JSX, useEffect, useId, useRef, useState } from 'react';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { cn } from '../../lib/cn';
import { toast } from '../../stores/toast-store';
import { EntryIcon } from './EntryIcon';
import { newNameProblem } from './tree-model';

interface InlineNameInputProps {
	/** 'create' starts empty; 'rename' starts with the current name. */
	mode: 'create' | 'rename';
	kind: FsEntry['kind'];
	initial: string;
	depth: number;
	/** Names already used in the target folder, checked before anything is sent. */
	siblings: readonly string[];
	/** Creates or renames; rejects with the reason, and the input stays open to fix the name. */
	onSubmit: (name: string) => Promise<void>;
	onCancel: () => void;
}

const errorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : 'Something went wrong';

/** Name editor used for both "new file/folder" and "rename" rows. */
export function InlineNameInput({
	mode,
	kind,
	initial,
	depth,
	siblings,
	onSubmit,
	onCancel,
}: InlineNameInputProps): JSX.Element {
	const [value, setValue] = useState(initial);
	const [failure, setFailure] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	// Read from event handlers: once submitting or closed, a stray blur (focus moving to the tree,
	// or the input being removed) must not submit or cancel a second time.
	const phase = useRef<'editing' | 'busy' | 'done'>('editing');
	const ref = useRef<HTMLInputElement>(null);
	const messageId = useId();

	useEffect(() => {
		const input = ref.current;
		if (!input) return;
		input.focus();
		// Select the name without its extension, like VS Code.
		const dot = initial.lastIndexOf('.');
		input.setSelectionRange(0, dot > 0 ? dot : initial.length);
	}, [initial]);

	const name = value.trim();
	const problem = name && name !== initial ? newNameProblem(name, siblings) : null;
	const message = failure ?? problem;

	const cancel = (): void => {
		phase.current = 'done';
		onCancel();
	};

	const done = (fromBlur: boolean): void => {
		if (phase.current !== 'editing') return;
		if (!name || name === initial) return cancel();
		if (problem) {
			// Leaving the input gives up on the name; say why nothing happened.
			if (fromBlur) {
				toast.warn(mode === 'create' ? 'Not created' : 'Not renamed', problem);
				cancel();
			}
			return;
		}
		phase.current = 'busy';
		setBusy(true);
		onSubmit(name).catch((error: unknown) => {
			if (phase.current === 'done') return; // Escaped while it was still running.
			if (fromBlur) {
				toast.error(
					mode === 'create' ? 'Could not create' : 'Could not rename',
					errorMessage(error),
				);
				cancel();
				return;
			}
			phase.current = 'editing';
			setBusy(false);
			setFailure(errorMessage(error));
			ref.current?.focus();
		});
	};

	return (
		<div className='pr-2' style={{ paddingLeft: 8 + depth * 12 }}>
			<div className='flex h-6 items-center gap-1.5'>
				{/* Lines up with the chevron and icon columns of tree rows. */}
				<span className='w-3 shrink-0' />
				<span className='flex w-7 shrink-0 justify-center'>
					<EntryIcon kind={kind} name={value} />
				</span>
				<input
					ref={ref}
					value={value}
					aria-label={
						mode === 'rename'
							? 'Rename'
							: kind === 'dir'
								? 'New folder name'
								: 'New file name'
					}
					aria-invalid={message ? true : undefined}
					aria-describedby={message ? messageId : undefined}
					aria-busy={busy || undefined}
					readOnly={busy}
					spellCheck={false}
					onChange={(e) => {
						setValue(e.target.value);
						setFailure(null);
					}}
					onBlur={() => done(true)}
					onKeyDown={(e) => {
						e.stopPropagation();
						if (e.key === 'Enter') done(false);
						if (e.key === 'Escape') cancel();
					}}
					className={cn(
						'h-5 min-w-0 flex-1 rounded-sm border bg-bg-2 px-1 text-12 text-fg-0 outline-none',
						message ? 'border-down' : 'border-accent',
						busy && 'opacity-60',
					)}
				/>
			</div>
			{message && (
				<p
					id={messageId}
					role='alert'
					className='mb-1 rounded-sm bg-down-soft px-1.5 py-0.5 text-11 text-down'
					style={{ marginLeft: 52 }}
				>
					{message}
				</p>
			)}
		</div>
	);
}
