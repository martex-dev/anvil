import { Check } from 'lucide-react';
import type { JSX } from 'react';

import { cn } from '../../lib/cn';
import { previewFor } from '../../skins/previews';
import { SKINS } from '../../skins/registry';
import { SkinSchematic } from './SkinSchematic';

/** Every skin as a card: a real screenshot when the skin ships one, a schematic otherwise. */
export function SkinGallery({
	value,
	onChange,
}: {
	value: string;
	onChange: (id: string) => void;
}): JSX.Element {
	return (
		<div role='group' aria-label='Skin' className='grid grid-cols-2 gap-3 py-3'>
			{SKINS.map((skin) => {
				const selected = skin.id === value;
				const image = previewFor(skin.id);
				return (
					<button
						key={skin.id}
						type='button'
						aria-pressed={selected}
						aria-label={`${skin.name} skin`}
						onClick={() => onChange(skin.id)}
						className={cn(
							'group flex flex-col overflow-hidden rounded-lg border bg-bg-1 text-left outline-none',
							'transition-[box-shadow,border-color,translate] transition-fast hover:-translate-y-px',
							// Selected already glows, so focus gets its own mark, as on the palette cards.
							'focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-fg-0 focus-visible:outline-solid',
							selected
								? 'border-accent shadow-glow'
								: 'border-border hover:border-border-strong',
						)}
					>
						{image ? (
							<img
								src={image}
								alt=''
								className='aspect-[16/9] w-full object-cover object-top'
							/>
						) : (
							<SkinSchematic skin={skin} />
						)}
						<span className='flex flex-col gap-0.5 border-t border-border px-3 py-2'>
							<span className='flex items-center gap-2'>
								<span className='flex-1 text-13 font-semibold text-fg-0'>
									{skin.name}
								</span>
								<span className='hud text-fg-2'>
									{skin.palettes.length} variants
								</span>
								{selected && <Check size={13} className='text-accent' />}
							</span>
							<span className='line-clamp-2 text-11 text-fg-2'>{skin.tagline}</span>
						</span>
					</button>
				);
			})}
		</div>
	);
}
