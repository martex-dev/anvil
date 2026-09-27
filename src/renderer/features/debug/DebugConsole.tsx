import { ChevronRight, Eraser } from 'lucide-react';
import { type JSX, useEffect, useRef, useState } from 'react';

import { cn } from '../../lib/cn';
import { IconButton } from '../../ui/IconButton';
import type { ConsoleKind } from './debug-reducer';
import { dispatch, useDebugStore } from './debug-store';
import { DebugToolbar } from './DebugToolbar';
import { evaluateInConsole } from './evaluate';

const TONE: Record<ConsoleKind, string> = {
	input: 'text-fg-2',
	result: 'text-fg-0',
	error: 'text-down',
	output: 'text-fg-1',
	info: 'text-info',
};

/**
 * Evaluates Python in the paused frame (the Variables view's frame) and shows logpoint output.
 * The program's own prints go to its terminal, where input() also works.
 */
export function DebugConsole(): JSX.Element {
	const lines = useDebugStore((s) => s.console);
	const paused = useDebugStore((s) => s.status === 'paused');
	const idle = useDebugStore((s) => s.status === 'idle');
	const [draft, setDraft] = useState('');
	const [history, setHistory] = useState<string[]>([]);
	const [back, setBack] = useState(-1);
	const end = useRef<HTMLDivElement>(null);

	useEffect(() => {
		end.current?.scrollIntoView({ block: 'end' });
	}, [lines]);

	const submit = (): void => {
		const text = draft.trim();
		if (!text) return;
		setHistory([...history.filter((h) => h !== text), text]);
		setBack(-1);
		setDraft('');
		void evaluateInConsole(text);
	};
	const recall = (step: 1 | -1): void => {
		if (history.length === 0) return;
		const next = back === -1 ? (step === 1 ? history.length - 1 : -1) : back - step;
		if (next < 0 || next >= history.length) {
			setBack(-1);
			setDraft('');
			return;
		}
		setBack(next);
		setDraft(history[next] ?? '');
	};

	return (
		<div className='flex h-full min-h-0 flex-col'>
			<div className='flex h-7 shrink-0 items-center gap-2 border-b border-glass-edge px-2'>
				<span className='flex-1 text-10 text-fg-2'>
					{idle
						? 'No debug session'
						: paused
							? 'Evaluates in the selected frame'
							: 'Pause to evaluate'}
				</span>
				{!idle && <DebugToolbar />}
				<IconButton
					size='sm'
					label='Clear console'
					icon={<Eraser size={12} />}
					onClick={() => dispatch({ type: 'clearConsole' })}
				/>
			</div>
			<div
				role='log'
				aria-label='Debug Console output'
				className='min-h-0 flex-1 overflow-auto px-2 py-1 font-mono text-12'
			>
				{lines.length === 0 && (
					<p className='text-fg-2'>
						Start debugging (Shift+F9), stop at a breakpoint, then type an expression
						below.
					</p>
				)}
				{lines.map((l) => (
					<pre key={l.id} className={cn('break-all whitespace-pre-wrap', TONE[l.kind])}>
						{l.kind === 'input' ? `> ${l.text}` : l.text}
					</pre>
				))}
				<div ref={end} />
			</div>
			<div className='flex h-8 shrink-0 items-center gap-1 border-t border-glass-edge px-2'>
				<ChevronRight size={13} className='text-accent' aria-hidden />
				<input
					aria-label='Evaluate in the debugger'
					value={draft}
					disabled={!paused}
					placeholder={
						paused ? 'Python expression or statement' : 'Pause the program to evaluate'
					}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') submit();
						else if (e.key === 'ArrowUp') {
							e.preventDefault();
							recall(1);
						} else if (e.key === 'ArrowDown') {
							e.preventDefault();
							recall(-1);
						}
					}}
					className='h-full min-w-0 flex-1 bg-transparent font-mono text-12 text-fg-0 outline-none placeholder:text-fg-2 disabled:opacity-60'
				/>
			</div>
		</div>
	);
}
