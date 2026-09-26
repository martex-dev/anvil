import type { JSX } from 'react';

import { ColophonClock } from './ColophonClock';
import { DocumentPhrases } from './DocumentPhrases';
import { Fleuron } from './Fleuron';
import { GitPhrase } from './GitPhrase';
import { ServicePhrases } from './ServicePhrases';

/**
 * The colophon: one centered line of small caps at the foot of the page
 * ("strategy.py · python · ln 9 · 1,204 words · 12:04"), the branch in the left margin and the
 * machinery in the right. Faint until the pointer or focus comes down to it.
 */
export function StatusBar(): JSX.Element {
	return (
		<footer
			data-part='statusbar'
			className='relative z-10 grid h-8 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 px-5'
		>
			<div data-zen='margin' className='flex min-w-0 items-center justify-start'>
				<GitPhrase />
			</div>
			<div data-zen='colophon' className='flex min-w-0 items-center justify-center'>
				<span data-zen='ornament' aria-hidden>
					<Fleuron />
				</span>
				<DocumentPhrases />
				<ColophonClock />
				<span data-zen='ornament' aria-hidden>
					<Fleuron flip />
				</span>
			</div>
			<div data-zen='margin' className='flex min-w-0 items-center justify-end'>
				<ServicePhrases />
			</div>
		</footer>
	);
}
