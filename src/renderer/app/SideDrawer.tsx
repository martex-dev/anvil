import { type JSX, useEffect } from 'react';

import { cn } from '../lib/cn';
import { useLayoutStore } from '../stores/layout-store';
import { useRegisterOverlay } from '../stores/overlay-store';
import { SideBar } from './SideBar';

/**
 * The side bar as a drawer that slides over the editor (writer-style skins). Esc or a click
 * on the backdrop puts it away.
 */
export function SideDrawer({ side }: { side: 'left' | 'right' }): JSX.Element {
	const open = useLayoutStore((s) => s.sideOpen && !s.zen);
	const width = useLayoutStore((s) => s.sideWidth);
	useRegisterOverlay(open);
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent): void => {
			if (e.key === 'Escape') useLayoutStore.getState().toggleSide();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [open]);
	return (
		<div
			data-part='drawer'
			data-open={open}
			data-side={side}
			className={cn('absolute inset-0 z-30', !open && 'pointer-events-none')}
		>
			<div
				data-part='drawer-backdrop'
				aria-hidden
				onClick={() => useLayoutStore.getState().toggleSide()}
				className={cn(
					'absolute inset-0 bg-scrim transition-opacity transition-base',
					open ? 'opacity-100' : 'opacity-0',
				)}
			/>
			<div
				className={cn(
					'absolute inset-y-0 transition-transform transition-base',
					side === 'left' ? 'left-0' : 'right-0',
					!open && (side === 'left' ? '-translate-x-full' : 'translate-x-full'),
				)}
				style={{ width }}
			>
				<SideBar />
			</div>
		</div>
	);
}
