import type { JSX } from 'react';

import { Input } from '../../ui/Input';

/** Include / exclude globs; applied on blur or Enter, not per keystroke (each runs a search). */
export function GlobInputs({
	include,
	exclude,
	onChange,
}: {
	include: string;
	exclude: string;
	onChange: (patch: { include?: string; exclude?: string }) => void;
}): JSX.Element {
	return (
		<>
			<Input
				aria-label='Files to include'
				placeholder='Include, e.g. src/**, *.py'
				defaultValue={include}
				onBlur={(e) => onChange({ include: e.target.value.trim() })}
				onKeyDown={(e) =>
					e.key === 'Enter' && onChange({ include: e.currentTarget.value.trim() })
				}
				className='h-6 text-12'
			/>
			<Input
				aria-label='Files to exclude'
				placeholder='Exclude, e.g. *.test.ts, dist/**'
				defaultValue={exclude}
				onBlur={(e) => onChange({ exclude: e.target.value.trim() })}
				onKeyDown={(e) =>
					e.key === 'Enter' && onChange({ exclude: e.currentTarget.value.trim() })
				}
				className='h-6 text-12'
			/>
		</>
	);
}
