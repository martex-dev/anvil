import { Check } from 'lucide-react';
import type { JSX } from 'react';

import { cn } from '../../lib/cn';
import type { ThemeMeta } from '../../styles/theme-list';

const syn = (token: string): { color: string } => ({ color: `var(--syn-${token})` });

/** A live mini-editor in the theme's own colors (data-theme re-scopes every token inside). */
export function ThemeCard({
	theme,
	selected,
	onSelect,
}: {
	theme: ThemeMeta;
	selected: boolean;
	onSelect: () => void;
}): JSX.Element {
	return (
		<button
			type='button'
			data-theme={theme.id}
			aria-pressed={selected}
			aria-label={`${theme.name} theme`}
			onClick={onSelect}
			className={cn(
				'group relative flex flex-col overflow-hidden rounded-lg border bg-bg-1 text-left outline-none',
				'transition-[box-shadow,border-color,translate] transition-fast hover:-translate-y-px',
				'focus-visible:shadow-glow',
				selected ? 'border-accent shadow-glow' : 'border-border hover:border-border-strong',
			)}
		>
			<span className='flex items-center gap-1 border-b border-border bg-bg-0 px-2 py-1'>
				<span className='size-1.5 rounded-full bg-down' />
				<span className='size-1.5 rounded-full bg-warn' />
				<span className='size-1.5 rounded-full bg-up' />
				<span className='accent-gradient ml-auto h-[2px] w-8 rounded-full' />
			</span>
			<span className='block px-2.5 py-2 font-mono text-[10px] leading-[1.55] whitespace-pre'>
				<span style={syn('decorator')}>@jit</span>
				{'\n'}
				<span style={syn('keyword')}>def </span>
				<span style={syn('function')}>edge</span>
				<span style={syn('operator')}>(</span>
				<span style={syn('parameter')}>r</span>
				<span style={syn('operator')}>, </span>
				<span style={syn('parameter')}>k</span>
				<span style={syn('operator')}>=</span>
				<span style={syn('number')}>2</span>
				<span style={syn('operator')}>):</span>
				{'\n  '}
				<span style={syn('control')}>return </span>
				<span style={syn('builtin')}>abs</span>
				<span style={syn('operator')}>(</span>
				<span style={syn('variable')}>r</span>
				<span style={syn('operator')}>) * </span>
				<span style={syn('parameter')}>k</span>
				{'\n  '}
				<span style={syn('comment')}># </span>
				<span style={syn('string')}>{"'alpha'"}</span>
			</span>
			<span className='mt-auto flex items-center gap-1.5 border-t border-border px-2.5 py-1.5'>
				<span className='size-2 rotate-45 bg-accent' />
				<span className='flex-1 truncate text-12 text-fg-0'>{theme.name}</span>
				{theme.kind === 'light' && <span className='hud text-fg-2'>light</span>}
				{selected && <Check size={12} className='text-accent' />}
			</span>
		</button>
	);
}
