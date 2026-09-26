import type { JSX } from 'react';

import { CopyValue } from './CopyValue';

/** A copyable multi-line output (JSON, encoded text) that scrolls instead of growing forever. */
export function CodeBlock({ value, label }: { value: string; label: string }): JSX.Element {
	return (
		<div className='max-h-72 overflow-auto rounded-sm border border-border bg-bg-2 py-1'>
			<CopyValue value={value} label={label} multiline />
		</div>
	);
}
