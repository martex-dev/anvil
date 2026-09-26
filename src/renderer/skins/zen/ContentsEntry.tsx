import type { JSX, MouseEvent } from 'react';

const DRAWER = "[data-part='drawer'][data-open='true'] [data-part='pane-body']";
// The view's own field or list first (search box, file tree), then anything focusable.
const DRAWER_FOCUSABLE = [
	`${DRAWER} :is(input, textarea, [role='tree'] [tabindex='0'], [role='tree'][tabindex='0'])`,
	`${DRAWER} :is(button, [tabindex='0'])`,
];

/**
 * The rail stays out while it holds focus or the pointer, so after a pick it steps aside:
 * focus moves into the drawer that just opened (or is let go), and a mouse pick tucks the rail
 * away until the pointer has left it, so the drawer underneath is usable at once.
 */
function handOff(e: MouseEvent<HTMLButtonElement>): void {
	const button = e.currentTarget;
	const rail = button.closest<HTMLElement>("[data-part='activity-rail']");
	if (rail && e.detail > 0) {
		rail.dataset['zenTucked'] = 'true';
		const release = (move: PointerEvent): void => {
			if (move.target instanceof Node && rail.contains(move.target)) return;
			delete rail.dataset['zenTucked'];
			document.removeEventListener('pointermove', release);
		};
		document.addEventListener('pointermove', release);
	}
	requestAnimationFrame(() => {
		const target = DRAWER_FOCUSABLE.map((q) => document.querySelector<HTMLElement>(q)).find(
			(el) => el !== null,
		);
		if (target) target.focus();
		else button.blur();
	});
}

interface ContentsEntryProps {
	view: string;
	label: string;
	short: string;
	numeral: string;
	index?: number;
	shortcut?: string | undefined;
	active: boolean;
	badge?: number;
	onClick: () => void;
}

/** "iv. Outline ········ ctrl+shift+o": one line of the contents rail. */
export function ContentsEntry({
	view,
	label,
	short,
	numeral,
	index,
	shortcut,
	active,
	badge,
	onClick,
}: ContentsEntryProps): JSX.Element {
	return (
		<button
			type='button'
			aria-label={label}
			aria-pressed={active}
			title={shortcut ? `${label} (${shortcut})` : label}
			data-part='activity-item'
			data-view={view}
			data-index={index}
			data-active={active}
			onClick={(e) => {
				onClick();
				handOff(e);
			}}
			className='flex h-8 w-full items-baseline gap-2 text-left outline-none'
		>
			<span data-zen='numeral' aria-hidden>
				{numeral}
			</span>
			<span data-part='activity-label'>{short}</span>
			{badge !== undefined && badge > 0 && (
				<span data-part='activity-badge'>{badge > 99 ? '99+' : badge}</span>
			)}
			<span data-zen='leader' aria-hidden className='min-w-3 flex-1' />
			{shortcut && (
				<span data-zen='folio' aria-hidden>
					{shortcut.toLowerCase()}
				</span>
			)}
		</button>
	);
}
