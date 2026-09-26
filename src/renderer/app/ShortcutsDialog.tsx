import { type JSX, useMemo, useState } from 'react';

import { useUiStore } from '../stores/ui-store';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Kbd } from '../ui/Kbd';
import { getCommands } from './commands/run';

/** Every bound key in one searchable sheet. */
export function ShortcutsDialog(): JSX.Element {
	const open = useUiStore((s) => s.shortcutsOpen);
	const setOpen = useUiStore((s) => s.setShortcutsOpen);
	const [filter, setFilter] = useState('');
	const groups = useMemo(() => {
		const f = filter.toLowerCase();
		const bound = getCommands().filter(
			(c) => c.shortcut && `${c.title} ${c.category} ${c.shortcut}`.toLowerCase().includes(f),
		);
		const map = new Map<string, typeof bound>();
		for (const c of bound) map.set(c.category, [...(map.get(c.category) ?? []), c]);
		return [...map.entries()];
	}, [filter]);
	return (
		<Dialog open={open} onOpenChange={setOpen} title='Keyboard shortcuts' width='lg'>
			<Input
				autoFocus
				value={filter}
				onChange={(e) => setFilter(e.target.value)}
				placeholder='Filter by action or key'
				className='mb-3'
			/>
			<div className='columns-2 gap-6'>
				{groups.map(([category, commands]) => (
					<section key={category} className='mb-4 break-inside-avoid'>
						<h3 className='hud mb-1.5 text-accent'>{category}</h3>
						<ul>
							{commands.map((c) => (
								<li key={c.id} className='flex h-7 items-center gap-2 text-12'>
									<span className='flex-1 truncate text-fg-1'>{c.title}</span>
									{c.scope === 'editor' && (
										<span className='text-10 text-fg-2'>editor</span>
									)}
									<Kbd keys={c.shortcut ?? ''} />
								</li>
							))}
						</ul>
					</section>
				))}
			</div>
		</Dialog>
	);
}
