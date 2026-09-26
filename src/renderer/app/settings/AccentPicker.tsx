import { Pipette } from 'lucide-react';
import { type JSX, useCallback, useEffect, useRef, useState } from 'react';

import { ACCENTS, type Settings } from '@shared/settings';

import { cn } from '../../lib/cn';
import { paintCustomAccent } from '../hooks/use-settings';

const ring = (on: boolean): string | false =>
	on && 'outline-2 outline-offset-2 outline-fg-0 outline-solid';
// `!`: the presets' inline halo would otherwise hide the focus glow.
const dot =
	'size-6 rounded-full outline-none transition-transform transition-fast hover:scale-110 focus-visible:shadow-glow!';

/** Theme's own accent, the five presets, or any color. */
export function AccentPicker({
	s,
	update,
}: {
	s: Settings;
	update: (p: Partial<Settings>) => void;
}): JSX.Element {
	// The color input fires on every drag step: repaint live, save once it settles.
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const pending = useRef<string | undefined>(undefined);
	const save = useRef(update);
	useEffect(() => {
		save.current = update;
	});
	const flush = useCallback((): void => {
		clearTimeout(timer.current);
		const hex = pending.current;
		pending.current = undefined;
		if (hex) save.current({ accent: 'custom', customAccent: hex });
	}, []);
	// Closing Settings mid-debounce must still save the color that is already painted.
	useEffect(() => flush, [flush]);
	// The input shows the dragged color until it is saved, then follows the settings again.
	const [draft, setDraft] = useState<string | undefined>(undefined);
	const pickCustom = (hex: string): void => {
		// Tokens only while dragging; the save repaints Monaco and xterm once.
		paintCustomAccent(hex);
		setDraft(hex);
		pending.current = hex;
		clearTimeout(timer.current);
		timer.current = setTimeout(() => {
			flush();
			setDraft(undefined);
		}, 300);
	};
	const custom = draft !== undefined || s.accent === 'custom';
	return (
		<div className='flex items-center gap-1.5'>
			<button
				type='button'
				aria-label='Use the theme accent'
				title='From theme'
				aria-pressed={s.accent === 'theme'}
				onClick={() => update({ accent: 'theme' })}
				className={cn(dot, ring(s.accent === 'theme'))}
				style={{
					background:
						'conic-gradient(from 90deg, var(--theme-accent), var(--theme-accent-2), var(--theme-accent))',
				}}
			/>
			<span className='mx-0.5 h-4 w-px bg-border-strong' />
			{ACCENTS.map((a) => (
				<button
					key={a}
					type='button'
					aria-label={a}
					title={a}
					aria-pressed={s.accent === a}
					onClick={() => update({ accent: a })}
					className={cn(dot, ring(s.accent === a))}
					style={{
						background: `var(--accent-${a})`,
						boxShadow: `0 0 12px -2px var(--accent-${a})`,
					}}
				/>
			))}
			<label
				title='Custom color'
				className={cn(
					dot,
					'relative flex cursor-pointer items-center justify-center overflow-hidden border border-border-strong has-[:focus-visible]:shadow-glow',
					ring(custom),
				)}
				style={custom ? { background: draft ?? s.customAccent } : undefined}
			>
				<Pipette size={12} className={custom ? 'text-on-accent' : 'text-fg-1'} />
				<input
					type='color'
					aria-label='Custom accent color'
					value={draft ?? s.customAccent}
					onChange={(e) => pickCustom(e.target.value)}
					className='absolute inset-0 cursor-pointer opacity-0'
				/>
			</label>
		</div>
	);
}
