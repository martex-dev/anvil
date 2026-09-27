import { ArrowDown, ArrowUp, CaseSensitive, Search, X } from 'lucide-react';
import { type JSX, useState } from 'react';

import { IconButton } from '../../ui/IconButton';
import { Input } from '../../ui/Input';
import { closeTerminalFind, terminalApi } from './terminal-registry';

/** Ctrl+F in a terminal: searches its scrollback and selects each match in turn. */
export function TerminalFind({ sessionId }: { sessionId: string }): JSX.Element {
	const [query, setQuery] = useState('');
	const [caseSensitive, setCaseSensitive] = useState(false);
	const [missed, setMissed] = useState(false);

	const find = (
		direction: 'next' | 'previous',
		text = query,
		matchCase = caseSensitive,
	): void => {
		const api = terminalApi(sessionId);
		if (!api || !text) {
			setMissed(false);
			api?.clearFind();
			return;
		}
		setMissed(!api.find(text, direction, matchCase));
	};

	// Solid, not glass: a backdrop-filter over xterm makes every repaint expensive.
	return (
		<div
			role='search'
			aria-label='Find in terminal'
			data-part='terminal-find'
			className='absolute top-2 right-4 z-10 flex items-center gap-1 rounded-md border border-glass-edge bg-bg-2 p-1 shadow-panel'
		>
			<Input
				autoFocus
				value={query}
				invalid={missed}
				aria-label='Find in terminal'
				placeholder='Find'
				leading={<Search size={12} />}
				className='h-6 w-52 text-12'
				onChange={(e) => {
					setQuery(e.target.value);
					find('next', e.target.value);
				}}
				onKeyDown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						find(e.shiftKey ? 'previous' : 'next');
					} else if (e.key === 'Escape') {
						e.preventDefault();
						closeTerminalFind();
					}
				}}
			/>
			{missed && (
				<span role='status' className='px-1 text-11 text-down'>
					No results
				</span>
			)}
			<IconButton
				size='sm'
				label='Match case'
				toggle
				active={caseSensitive}
				icon={<CaseSensitive size={14} />}
				onClick={() => {
					setCaseSensitive(!caseSensitive);
					find('next', query, !caseSensitive);
				}}
			/>
			<IconButton
				size='sm'
				label='Previous match'
				shortcut='Shift+Enter'
				icon={<ArrowUp size={13} />}
				onClick={() => find('previous')}
			/>
			<IconButton
				size='sm'
				label='Next match'
				shortcut='Enter'
				icon={<ArrowDown size={13} />}
				onClick={() => find('next')}
			/>
			<IconButton
				size='sm'
				label='Close find'
				shortcut='Escape'
				icon={<X size={13} />}
				onClick={closeTerminalFind}
			/>
		</div>
	);
}
