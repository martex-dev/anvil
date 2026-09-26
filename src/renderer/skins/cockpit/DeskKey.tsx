import type { JSX } from 'react';

import { cn } from '../../lib/cn';
import { Tooltip } from '../../ui/Tooltip';
import { SkinIcon } from '../SkinIcon';
import type { ChromeIconName } from '../types';

interface DeskKeyProps {
	label: string;
	/** Short cap printed on the key ('SIDE', 'RUN'). */
	cap: string;
	icon: ChromeIconName;
	shortcut?: string | undefined;
	active?: boolean;
	tone?: 'go';
	onClick: () => void;
}

/** A labelled desk key: glyph plus a short cap, lit when its pane is showing. */
export function DeskKey({
	label,
	cap,
	icon,
	shortcut,
	active,
	tone,
	onClick,
}: DeskKeyProps): JSX.Element {
	return (
		<Tooltip content={label} shortcut={shortcut}>
			<button
				type='button'
				aria-label={label}
				aria-pressed={active}
				data-active={active}
				onClick={onClick}
				className={cn('ck-key no-drag', tone === 'go' && 'ck-key-go')}
			>
				<SkinIcon name={icon} size={11} />
				<span>{cap}</span>
			</button>
		</Tooltip>
	);
}
