import { ContextMenu } from 'radix-ui';
import type { JSX, ReactNode } from 'react';
import { useState } from 'react';

import { useRegisterOverlay } from '../stores/overlay-store';
import { Kbd } from './Kbd';

export interface MenuItem {
	label: string;
	shortcut?: string;
	danger?: boolean;
	disabled?: boolean;
	onSelect: () => void;
}

interface ContextMenuProps {
	items: Array<MenuItem | 'separator'>;
	children: ReactNode;
}

const itemClass =
	'flex h-7 cursor-default items-center gap-4 rounded-md px-2 text-12 outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-accent-faint';

/**
 * Radix returns focus to the trigger shortly after the menu closes. If the chosen item already
 * moved focus somewhere on purpose (an inline rename/new-file input), keep it there: stealing
 * it back blurs that input, which cancels it.
 */
function keepFocusMovedByItem(event: Event): void {
	const active = document.activeElement;
	if (active && active !== document.body) event.preventDefault();
}

/** Right-click menu, drawn as floating glass. */
export function AppContextMenu({ items, children }: ContextMenuProps): JSX.Element {
	const [open, setOpen] = useState(false);
	useRegisterOverlay(open);
	return (
		<ContextMenu.Root onOpenChange={setOpen}>
			<ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
			<ContextMenu.Portal>
				<ContextMenu.Content
					className='glass-strong animate-in z-50 min-w-52 p-1'
					onCloseAutoFocus={keepFocusMovedByItem}
				>
					{items.map((item, i) =>
						item === 'separator' ? (
							<ContextMenu.Separator
								key={`sep-${i}`}
								className='my-1 h-px bg-border'
							/>
						) : (
							<ContextMenu.Item
								key={item.label}
								disabled={item.disabled ?? false}
								onSelect={item.onSelect}
								className={`${itemClass} ${item.danger ? 'text-down' : 'text-fg-1 data-[highlighted]:text-fg-0'}`}
							>
								<span className='flex-1'>{item.label}</span>
								{item.shortcut && <Kbd keys={item.shortcut} />}
							</ContextMenu.Item>
						),
					)}
				</ContextMenu.Content>
			</ContextMenu.Portal>
		</ContextMenu.Root>
	);
}
