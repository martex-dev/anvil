import { Command } from 'cmdk';
import { Hash } from 'lucide-react';
import type { JSX } from 'react';

import type { OutlineSymbol } from '../features/outline/outline';
import { cn } from '../lib/cn';

interface QuickOpenSymbolsProps {
	symbols: readonly OutlineSymbol[];
	itemClass: string;
	onPick: (line: number) => void;
}

const note = 'px-3 py-6 text-center text-13 text-fg-2';

/** Quick Open's `@` mode: the current file's outline, filtered by cmdk. */
export function QuickOpenSymbols({
	symbols,
	itemClass,
	onPick,
}: QuickOpenSymbolsProps): JSX.Element {
	if (symbols.length === 0) return <div className={note}>No symbols in the current file.</div>;
	return (
		<>
			<Command.Empty className={note}>No matching symbols.</Command.Empty>
			{symbols.map((s) => (
				<Command.Item
					key={`${s.line}:${s.name}`}
					value={`${s.line}:${s.name} ${s.kind}`}
					onSelect={() => onPick(s.line)}
					className={itemClass}
				>
					<Hash size={12} className='text-accent-2' />
					<span
						style={{ paddingLeft: s.depth * 12 }}
						className={cn('truncate', s.kind === 'cell' && 'text-accent')}
					>
						{s.name}
					</span>
					<span className='hud'>{s.kind}</span>
					<span className='num ml-auto text-11 text-fg-2'>{s.line}</span>
				</Command.Item>
			))}
		</>
	);
}
