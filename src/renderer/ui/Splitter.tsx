import { type JSX, useRef, useState } from 'react';

import { cn } from '../lib/cn';

interface SplitterProps {
	/** 'x' drags horizontally (a vertical bar between columns), 'y' vertically. */
	axis: 'x' | 'y';
	/** Called with the pointer delta since drag start, in px. */
	onDrag: (delta: number) => void;
	onStart?: () => void;
	onEnd?: () => void;
	onReset?: () => void;
	label: string;
	className?: string;
}

/**
 * The gap between two glass panes doubles as the resize handle: invisible until hovered, then a
 * thin accent line. Keyboard: arrows resize, Home resets (double-click too).
 */
export function Splitter({
	axis,
	onDrag,
	onStart,
	onEnd,
	onReset,
	label,
	className,
}: SplitterProps): JSX.Element {
	const origin = useRef<number | null>(null);
	const [active, setActive] = useState(false);
	return (
		<div
			role='separator'
			aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
			aria-label={label}
			tabIndex={0}
			onPointerDown={(e) => {
				e.currentTarget.setPointerCapture(e.pointerId);
				origin.current = axis === 'x' ? e.clientX : e.clientY;
				setActive(true);
				onStart?.();
			}}
			onPointerMove={(e) => {
				if (origin.current === null) return;
				onDrag((axis === 'x' ? e.clientX : e.clientY) - origin.current);
			}}
			onPointerUp={(e) => {
				e.currentTarget.releasePointerCapture(e.pointerId);
				origin.current = null;
				setActive(false);
				onEnd?.();
			}}
			onDoubleClick={onReset}
			onKeyDown={(e) => {
				const step = e.shiftKey ? 48 : 12;
				const back = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
				const fwd = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
				if (e.key === back || e.key === fwd) {
					e.preventDefault();
					onStart?.();
					onDrag(e.key === back ? -step : step);
					onEnd?.();
				} else if (e.key === 'Home') onReset?.();
			}}
			className={cn(
				'group relative z-10 shrink-0 outline-none',
				axis === 'x' ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize',
				className,
			)}
		>
			<span
				className={cn(
					'pointer-events-none absolute rounded-full opacity-0 transition-opacity transition-fast group-hover:opacity-100 group-focus-visible:opacity-100',
					axis === 'x' ? 'inset-y-3 left-[2px] w-[2px]' : 'inset-x-3 top-[2px] h-[2px]',
					'accent-gradient',
					active && 'opacity-100',
				)}
			/>
		</div>
	);
}
