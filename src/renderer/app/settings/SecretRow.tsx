import { useMutation } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { type FormEvent, type JSX, useCallback, useRef, useState } from 'react';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Input } from '../../ui/Input';

interface SecretRowProps {
	spec: { key: string; label: string; help?: string | undefined };
	isSaved: boolean;
	onChanged: () => void;
}

export function SecretRow({ spec, isSaved, onChanged }: SecretRowProps): JSX.Element {
	// The draft lives only in this component and is cleared as soon as it's sent to main.
	const [draft, setDraft] = useState('');
	// Keys copied from a provider dashboard often carry a trailing newline or space.
	const value = draft.trim();
	// Deleting is permanent, so the trash button asks once before it acts.
	const [confirming, setConfirming] = useState(false);
	const input = useRef<HTMLInputElement>(null);
	const focusOnMount = useCallback((el: HTMLButtonElement | null) => el?.focus(), []);
	const save = useMutation({
		mutationFn: (value: string) => call('secrets:set', { key: spec.key, value }),
		onSuccess: () => {
			setDraft('');
			onChanged();
			toast.success('Secret saved', spec.label);
		},
		onError: (error) => toast.error('Could not save secret', error.message),
	});
	const remove = useMutation({
		mutationFn: () => call('secrets:delete', spec.key),
		onSuccess: () => {
			onChanged();
			toast.info('Secret deleted', spec.label);
		},
		onError: (error) => toast.error('Could not delete secret', error.message),
		onSettled: () => {
			// The delete buttons go away; keep keyboard focus in the row instead of on <body>.
			setConfirming(false);
			input.current?.focus();
		},
	});

	const onSubmit = (event: FormEvent): void => {
		event.preventDefault();
		if (value.length > 0) save.mutate(value);
	};

	return (
		<li className='flex flex-col gap-2 px-3 py-2.5'>
			<div className='flex items-center gap-2'>
				<span className='text-13 font-medium text-fg-0'>{spec.label}</span>
				{isSaved ? <Badge tone='up'>Saved</Badge> : <Badge tone='warn'>Missing</Badge>}
				<code className='ml-auto text-11 text-fg-2'>{spec.key}</code>
			</div>
			{spec.help && <p className='text-12 text-fg-2'>{spec.help}</p>}
			<form onSubmit={onSubmit} className='flex items-center gap-2'>
				<Input
					ref={input}
					type='password'
					autoComplete='off'
					spellCheck={false}
					aria-label={`${spec.label} value`}
					placeholder={
						isSaved ? '•••••••• (enter a new value to replace)' : 'Paste value'
					}
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					className='flex-1'
				/>
				<Button
					type='submit'
					variant='primary'
					loading={save.isPending}
					disabled={value.length === 0}
				>
					Save
				</Button>
				{confirming ? (
					<>
						<Button
							ref={focusOnMount}
							variant='ghost'
							disabled={remove.isPending}
							onClick={() => {
								setConfirming(false);
								input.current?.focus();
							}}
						>
							Keep
						</Button>
						<Button
							variant='danger'
							loading={remove.isPending}
							onClick={() => remove.mutate()}
						>
							Delete
						</Button>
					</>
				) : (
					<IconButton
						label='Delete secret'
						icon={<Trash2 size={14} />}
						disabled={!isSaved}
						onClick={() => setConfirming(true)}
					/>
				)}
			</form>
		</li>
	);
}
