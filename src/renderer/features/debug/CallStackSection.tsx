import type { JSX } from 'react';

import { cn } from '../../lib/cn';
import { useDebugStore } from './debug-store';
import { DebugSection, SectionNote } from './DebugSection';
import { revealFrame, workspacePathOf } from './session';

const fileName = (path: string): string => path.split(/[\\/]/).at(-1) ?? path;

/** The paused thread's frames; picking one shows its line and its variables. */
export function CallStackSection(): JSX.Element {
	const frames = useDebugStore((s) => s.frames);
	const frameId = useDebugStore((s) => s.frameId);
	const paused = useDebugStore((s) => s.status === 'paused');
	return (
		<DebugSection title='Call Stack'>
			{!paused && (
				<SectionNote>The call stack shows while the program is paused.</SectionNote>
			)}
			{paused && frames.length === 0 && <SectionNote>Reading the stack…</SectionNote>}
			<ul aria-label='Call stack'>
				{frames.map((f) => {
					const abs = f.source?.path;
					const rel = abs ? workspacePathOf(abs) : null;
					const where = rel ?? (abs ? fileName(abs) : (f.source?.name ?? 'unknown'));
					const selected = f.id === frameId;
					return (
						<li key={f.id}>
							<button
								type='button'
								aria-current={selected || undefined}
								title={abs ?? where}
								onClick={() => revealFrame(f.id)}
								className={cn(
									'flex h-6 w-full items-center gap-2 px-3 text-left text-12 outline-none hover:bg-bg-3/60 focus-visible:bg-accent-faint',
									selected && 'bg-accent-faint text-fg-0',
									// Library frames (outside the folder) can't be opened here.
									!rel && 'text-fg-2',
								)}
							>
								<span className='min-w-0 flex-1 truncate font-mono'>{f.name}</span>
								<span className='min-w-0 shrink truncate text-10 text-fg-2'>
									{where}:{f.line}
								</span>
							</button>
						</li>
					);
				})}
			</ul>
		</DebugSection>
	);
}
