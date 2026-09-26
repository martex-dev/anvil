import { RefreshCw } from 'lucide-react';
import type { JSX } from 'react';

import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';

/** Section refresh action: spins and ignores clicks while its work is in flight. */
export function RefreshButton({
	label,
	busy,
	onClick,
}: {
	label: string;
	busy: boolean;
	onClick: () => void;
}): JSX.Element {
	return (
		<IconButton
			size='sm'
			label={label}
			icon={busy ? <Spinner size={12} label={label} /> : <RefreshCw size={12} />}
			// aria-disabled, not disabled: a disabled button would drop keyboard focus mid-refresh.
			aria-disabled={busy}
			aria-busy={busy}
			onClick={() => {
				if (!busy) onClick();
			}}
		/>
	);
}
