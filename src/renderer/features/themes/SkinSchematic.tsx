import type { JSX } from 'react';

import { cn } from '../../lib/cn';
import type { SkinManifest } from '../../skins/types';

const block = 'rounded-[2px] bg-bg-2';

/**
 * A drawn miniature of a skin's layout in its default palette: where the views switcher,
 * side bar, status bar and chat sit. Used when a skin has no screenshot thumbnail.
 */
export function SkinSchematic({ skin }: { skin: SkinManifest }): JSX.Element {
	const { layout } = skin;
	const status = <span className='h-1.5 shrink-0 bg-accent/60' />;
	const activity =
		layout.activity === 'top' ? null : (
			<span
				className={cn(
					'flex w-2 shrink-0 flex-col gap-1 py-1',
					layout.activity === 'rail' && 'opacity-30',
				)}
			>
				<span className='mx-auto size-1 rounded-full bg-accent' />
				<span className='mx-auto size-1 rounded-full bg-fg-2' />
				<span className='mx-auto size-1 rounded-full bg-fg-2' />
			</span>
		);
	const side =
		layout.sidebar === 'drawer' ? null : <span className={cn(block, 'w-8 shrink-0')} />;
	return (
		<span
			data-theme={skin.defaultPalette}
			aria-hidden
			className='flex aspect-[16/9] w-full flex-col overflow-hidden bg-bg-0 p-1'
			style={{ gap: Math.min(layout.gap, 4) }}
		>
			<span className='h-2 shrink-0 bg-bg-1' />
			{layout.statusBar === 'top' && status}
			{layout.activity === 'top' && <span className='h-1.5 shrink-0 bg-bg-2' />}
			<span className='flex min-h-0 flex-1' style={{ gap: Math.min(layout.gap, 4) }}>
				{layout.activity === 'left' || layout.activity === 'rail' ? activity : null}
				{layout.sidebar === 'left' && side}
				<span
					className={cn(block, 'flex flex-1 flex-col gap-1 p-1.5')}
					style={layout.editorColumn ? { paddingInline: '22%' } : undefined}
				>
					<span className='h-0.5 w-3/4' style={{ background: 'var(--syn-keyword)' }} />
					<span className='h-0.5 w-1/2' style={{ background: 'var(--syn-string)' }} />
					<span className='h-0.5 w-2/3' style={{ background: 'var(--syn-function)' }} />
					<span className='h-0.5 w-1/3' style={{ background: 'var(--syn-number)' }} />
				</span>
				<span className={cn(block, 'w-6 shrink-0 opacity-70')} />
				{layout.sidebar === 'right' && side}
				{layout.activity === 'right' ? activity : null}
			</span>
			{layout.statusBar === 'bottom' && status}
		</span>
	);
}
