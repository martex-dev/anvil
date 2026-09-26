import { Check, CornerDownLeft, Sparkles, X } from 'lucide-react';
import { type JSX, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../../lib/cn';
import { Kbd } from '../../ui/Kbd';
import {
	acceptInlineEdit,
	cancelInlineEdit,
	rejectInlineEdit,
	submitInlineEdit,
	useInlineEdit,
} from './inline-edit';

const SUGGESTIONS = [
	'Add type hints',
	'Vectorize with NumPy',
	'Handle NaNs',
	'Add a docstring',
	'Make it async',
];

function Box(): JSX.Element {
	const { phase, preset, partial, error, stats } = useInlineEdit();
	const [text, setText] = useState(preset);
	const inputRef = useRef<HTMLInputElement>(null);
	const boxRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (phase === 'prompt') inputRef.current?.focus();
		if (phase === 'review') boxRef.current?.focus();
	}, [phase]);
	const lines = partial.split('\n').length;

	return (
		<div
			ref={boxRef}
			tabIndex={-1}
			onKeyDown={(e) => {
				if (e.key === 'Escape') {
					e.preventDefault();
					e.stopPropagation();
					cancelInlineEdit();
				} else if (
					phase === 'review' &&
					((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || e.key === 'Tab')
				) {
					e.preventDefault();
					acceptInlineEdit();
				}
			}}
			className={cn(
				'glass-strong animate-in mx-1 mt-1 flex h-12 items-center gap-2 rounded-lg px-2 outline-none',
				phase === 'generating' && 'shimmer',
			)}
		>
			<Sparkles
				size={14}
				className={cn('shrink-0 text-accent-2', phase === 'generating' && 'pulse-dot')}
			/>
			{phase === 'review' ? (
				<>
					<span className='text-12 text-fg-0'>Change applied</span>
					{stats && (
						<span className='num text-11'>
							<span className='text-up'>+{stats.added}</span>{' '}
							<span className='text-down'>−{stats.removed}</span>
						</span>
					)}
					<span className='flex-1' />
					<button
						type='button'
						onClick={rejectInlineEdit}
						className='flex h-7 items-center gap-1.5 rounded-md px-2 text-12 text-fg-1 hover:bg-down-soft hover:text-down'
					>
						<X size={12} /> Reject <Kbd keys='Esc' />
					</button>
					<button
						type='button'
						onClick={acceptInlineEdit}
						className='accent-gradient flex h-7 items-center gap-1.5 rounded-md px-2 text-12 font-semibold text-on-accent shadow-glow-soft'
					>
						<Check size={12} /> Accept <Kbd keys='Tab' />
					</button>
				</>
			) : (
				<>
					<input
						ref={inputRef}
						value={text}
						disabled={phase === 'generating'}
						onChange={(e) => setText(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								void submitInlineEdit(text);
							}
						}}
						placeholder={
							phase === 'generating'
								? ''
								: 'Edit with AI: describe the change (Enter)…'
						}
						className='min-w-0 flex-1 bg-transparent text-13 text-fg-0 outline-none placeholder:text-fg-2'
						spellCheck={false}
					/>
					{phase === 'generating' ? (
						<span className='num shrink-0 text-11 text-fg-2'>
							writing… {partial ? `${lines} lines` : ''}
						</span>
					) : error ? (
						<span
							className='max-w-72 shrink-0 truncate text-11 text-down'
							title={error}
						>
							{error}
						</span>
					) : (
						!text && (
							<span className='hidden shrink-0 gap-1 xl:flex'>
								{SUGGESTIONS.slice(0, 3).map((s) => (
									<button
										key={s}
										type='button'
										onClick={() => setText(s)}
										className='rounded-md border border-glass-edge px-1.5 py-0.5 text-10 text-fg-2 hover:border-accent/40 hover:text-fg-1'
									>
										{s}
									</button>
								))}
							</span>
						)
					)}
					<Kbd keys='Esc' className='opacity-60' />
					{phase !== 'generating' && (
						<CornerDownLeft size={12} className='shrink-0 text-fg-2' />
					)}
				</>
			)}
		</div>
	);
}

/** Portals the Ctrl+I box into the Monaco overlay node the inline-edit session created. */
export function InlineEditHost(): JSX.Element | null {
	const host = useInlineEdit((s) => s.host);
	const phase = useInlineEdit((s) => s.phase);
	if (!host || !phase) return null;
	return createPortal(<Box key={host.dataset['key'] ?? 'box'} />, host);
}
