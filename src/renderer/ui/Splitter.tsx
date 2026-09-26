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
	/** Current size and its range, announced by screen readers; `text` is the spoken form. */
	value?: { now: number; min: number; max: number; text: string } | undefined;
	className?: string;
}

/**
 * The gap between two glass panes doubles as the resize handle: invisible until hovered, then a
 * thin accent line. Primary button only. Keyboard: arrows resize, Home resets (double-click too).
 */
export function Splitter({
	axis,
	onDrag,
	onStart,
	onEnd,
	onReset,
	label,
	value,
	className,
}: SplitterProps): JSX.Element {
	const origin = useRef<number | null>(null);
	const [active, setActive] = useState(false);
	// Pointer up, cancel (Alt+Tab, pen lift) and lost capture all end the drag; only the first
	// one counts, so onEnd runs once and the splitter never stays stuck in drag mode.
	const endDrag = (): void => {
		if (origin.current === null) return;
		origin.current = null;
		setActive(false);
		onEnd?.();
	};
	return (
		<div
			role='separator'
			aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
			aria-label={label}
			aria-valuenow={value?.now}
			aria-valuemin={value?.min}
			aria-valuemax={value?.max}
			aria-valuetext={value?.text}
			tabIndex={0}
			onPointerDown={(e) => {
				if (e.button !== 0) return;
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
				if (e.currentTarget.hasPointerCapture(e.pointerId))
					e.currentTarget.releasePointerCapture(e.pointerId);
				endDrag();
			}}
			onPointerCancel={endDrag}
			onLostPointerCapture={endDrag}
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
			data-part='splitter'
			data-axis={axis}
			// The gutter is the skin's pane gap (at least 3px so it stays grabbable).
			className={cn(
				'group relative z-10 shrink-0 outline-none',
				axis === 'x'
					? 'w-[max(var(--pane-gap,6px),3px)] cursor-col-resize'
					: 'h-[max(var(--pane-gap,6px),3px)] cursor-row-resize',
				className,
			)}
		>
			<span
				data-part='splitter-handle'
				className={cn(
					'pointer-events-none absolute rounded-full opacity-0 transition-opacity transition-fast group-hover:opacity-100 group-focus-visible:opacity-100',
					axis === 'x'
						? 'inset-y-3 left-1/2 w-[2px] -translate-x-1/2'
						: 'inset-x-3 top-1/2 h-[2px] -translate-y-1/2',
					'accent-gradient',
					active && 'opacity-100',
				)}
			/>
		</div>
	);
}
