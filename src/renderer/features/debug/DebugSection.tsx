import { ChevronRight } from 'lucide-react';
import { type JSX, type ReactNode, useId, useState } from 'react';

import { cn } from '../../lib/cn';

/** One collapsible block of the Debug view (Variables, Watch, Call Stack, Breakpoints). */
export function DebugSection({
	title,
	actions,
	children,
	defaultOpen = true,
}: {
	title: string;
	actions?: ReactNode;
	children: ReactNode;
	defaultOpen?: boolean;
}): JSX.Element {
	const [open, setOpen] = useState(defaultOpen);
	const body = useId();
	return (
		<section data-part='debug-section' className='border-b border-glass-edge'>
			<div className='flex h-7 items-center gap-1 pr-1.5 pl-1'>
				<button
					type='button'
					aria-expanded={open}
					aria-controls={body}
					onClick={() => setOpen(!open)}
					className='flex h-6 flex-1 items-center gap-1 rounded-md px-1 text-left outline-none focus-visible:shadow-glow'
				>
					<ChevronRight
						size={12}
						className={cn(
							'text-fg-2 transition-transform transition-fast',
							open && 'rotate-90',
						)}
					/>
					<h3 className='hud flex-1'>{title}</h3>
				</button>
				{open && actions}
			</div>
			{open && (
				<div id={body} className='pb-1.5'>
					{children}
				</div>
			)}
		</section>
	);
}

/** A one-line note inside a section: "Not paused", "No breakpoints". */
export function SectionNote({ children }: { children: ReactNode }): JSX.Element {
	return <p className='px-3 py-1 text-12 text-fg-2'>{children}</p>;
}
