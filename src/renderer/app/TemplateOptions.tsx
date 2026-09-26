import type { JSX, KeyboardEvent } from 'react';

import type { Template } from '@shared/ipc/channels/tools';

import { cn } from '../lib/cn';

interface TemplateOptionsProps {
	templates: Template[];
	selectedId: string | undefined;
	onSelect: (id: string) => void;
}

const STEP: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

/**
 * The template picker as a radio group: one Tab stop (the selected card), arrow keys move the
 * selection, and screen readers announce which template is checked.
 */
export function TemplateOptions({
	templates,
	selectedId,
	onSelect,
}: TemplateOptionsProps): JSX.Element {
	const current = Math.max(
		0,
		templates.findIndex((t) => t.id === selectedId),
	);

	const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
		const step = STEP[e.key];
		let next: number;
		if (step !== undefined) next = (current + step + templates.length) % templates.length;
		else if (e.key === 'Home') next = 0;
		else if (e.key === 'End') next = templates.length - 1;
		else return;
		const target = templates[next];
		if (!target) return;
		e.preventDefault();
		onSelect(target.id);
		e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
	};

	return (
		<div
			role='radiogroup'
			aria-label='Template'
			className='flex flex-col gap-1.5'
			onKeyDown={onKeyDown}
		>
			{templates.map((t, i) => {
				const checked = i === current;
				return (
					<button
						key={t.id}
						type='button'
						role='radio'
						aria-checked={checked}
						tabIndex={checked ? 0 : -1}
						onClick={() => onSelect(t.id)}
						className={cn(
							'w-full rounded-lg border p-3 text-left outline-none transition-colors transition-fast focus-visible:shadow-glow',
							checked
								? 'border-accent/50 bg-accent-faint'
								: 'border-glass-edge hover:border-border-strong',
						)}
					>
						<div className='text-13 font-medium text-fg-0'>{t.name}</div>
						<div className='mt-0.5 text-12 text-fg-2'>{t.description}</div>
						<div className='mt-1.5 flex flex-wrap gap-1'>
							{t.tags.map((tag) => (
								<span
									key={tag}
									className='rounded-sm bg-bg-3/70 px-1.5 font-mono text-10 text-fg-1'
								>
									{tag}
								</span>
							))}
						</div>
					</button>
				);
			})}
		</div>
	);
}
