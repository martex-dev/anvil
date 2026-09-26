import { Command } from 'cmdk';
import { CornerDownLeft } from 'lucide-react';
import type { JSX, ReactNode } from 'react';
import { create } from 'zustand';

import { cn } from '../lib/cn';
import { rlog } from '../lib/log';
import { useRegisterOverlay } from '../stores/overlay-store';
import { toast } from '../stores/toast-store';
import { Kbd } from './Kbd';
import { Spinner } from './Spinner';

export interface PickItem {
	id: string;
	label: string;
	description?: string | undefined;
	detail?: string | undefined;
	icon?: ReactNode;
	/** Extra words the filter matches on. */
	keywords?: string[];
	current?: boolean;
}

interface PickRequest {
	title: string;
	placeholder: string;
	items: PickItem[] | Promise<PickItem[]>;
	/** Offer "create <typed text>" (e.g. a new branch) when nothing matches exactly. */
	allowCustom?: { label: (text: string) => string };
	/** Called as the highlighted item changes (live previews); `null` when nothing is. */
	onActive?: (id: string | null) => void;
	resolve: (value: string | null) => void;
}

interface QuickPickState {
	request: PickRequest | null;
	items: PickItem[] | null;
	query: string;
	/** cmdk value of the highlighted item (controlled, so highlight changes are observable). */
	active: string;
}

const useQuickPickStore = create<QuickPickState>(() => ({
	request: null,
	items: null,
	query: '',
	active: '',
}));

const itemValue = (item: PickItem): string =>
	`${item.label} ${item.description ?? ''} ${item.id}`.trim();

/** Start on the current item (the theme you're on, the active env) rather than the first. */
function initialActive(items: PickItem[]): string {
	const current = items.find((i) => i.current);
	return current ? itemValue(current) : '';
}

/** Shows a searchable list and resolves with the picked id (or typed text), null if dismissed. */
export function quickPick(options: Omit<PickRequest, 'resolve'>): Promise<string | null> {
	useQuickPickStore.getState().request?.resolve(null);
	return new Promise((resolve) => {
		useQuickPickStore.setState({
			request: { ...options, resolve },
			items: Array.isArray(options.items) ? options.items : null,
			query: '',
			active: Array.isArray(options.items) ? initialActive(options.items) : '',
		});
		if (!Array.isArray(options.items)) {
			options.items
				.then((items) =>
					useQuickPickStore.setState({ items, active: initialActive(items) }),
				)
				.catch((error: unknown) => {
					rlog.error('quick-pick', `loading "${options.title}" items failed`, error);
					toast.error(
						'Could not load the list',
						error instanceof Error ? error.message : undefined,
					);
					useQuickPickStore.setState({ items: [] });
				});
		}
	});
}

function close(value: string | null): void {
	const req = useQuickPickStore.getState().request;
	useQuickPickStore.setState({ request: null, items: null, query: '', active: '' });
	req?.resolve(value);
}

export function QuickPickHost(): JSX.Element {
	const { request, items, query, active } = useQuickPickStore();
	useRegisterOverlay(request !== null);
	const custom =
		request?.allowCustom && query.trim() && !items?.some((i) => i.label === query.trim());
	return (
		<Command.Dialog
			open={request !== null}
			onOpenChange={(open) => !open && close(null)}
			label={request?.title ?? 'Pick'}
			loop
			value={active}
			onValueChange={(v) => {
				useQuickPickStore.setState({ active: v });
				request?.onActive?.(items?.find((i) => itemValue(i) === v)?.id ?? null);
			}}
			// Live previews need to be seen: no dimming backdrop for those pickers.
			overlayClassName={cn(
				'fixed inset-0 z-40',
				request?.onActive ? 'bg-transparent' : 'bg-scrim',
			)}
			contentClassName='glass-strong animate-in fixed top-[10vh] left-1/2 z-50 w-[min(620px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl'
		>
			<div className='flex items-center gap-2 border-b border-glass-edge px-3'>
				<span className='hud shrink-0 text-accent'>{request?.title}</span>
				<Command.Input
					autoFocus
					value={query}
					onValueChange={(q) => useQuickPickStore.setState({ query: q })}
					placeholder={request?.placeholder}
					className='h-11 flex-1 bg-transparent text-14 text-fg-0 outline-none placeholder:text-fg-2 focus-visible:outline-none'
				/>
				<Kbd keys='Esc' />
			</div>
			<Command.List className='max-h-[min(440px,60vh)] overflow-auto p-1'>
				{items === null ? (
					<Command.Loading>
						<div className='flex h-16 items-center justify-center'>
							<Spinner />
						</div>
					</Command.Loading>
				) : (
					<Command.Empty className='px-3 py-6 text-center text-13 text-fg-2'>
						Nothing matches.
					</Command.Empty>
				)}
				{items?.map((item) => (
					<Command.Item
						key={item.id}
						value={itemValue(item)}
						keywords={item.keywords ?? []}
						onSelect={() => close(item.id)}
						className='group flex min-h-9 cursor-default items-center gap-2.5 rounded-md px-2 py-1 text-13 text-fg-1 data-[selected=true]:bg-accent-faint data-[selected=true]:text-fg-0'
					>
						{item.icon && (
							<span className='text-fg-2 group-data-[selected=true]:text-accent'>
								{item.icon}
							</span>
						)}
						<span className='flex min-w-0 flex-1 flex-col'>
							<span className='flex items-center gap-2 truncate'>
								{item.label}
								{item.description && (
									<span className='truncate text-12 text-fg-2'>
										{item.description}
									</span>
								)}
								{item.current && <span className='hud text-accent'>current</span>}
							</span>
							{item.detail && (
								<span className='truncate font-mono text-11 text-fg-2'>
									{item.detail}
								</span>
							)}
						</span>
						<CornerDownLeft
							size={12}
							className='hidden text-fg-2 group-data-[selected=true]:block'
						/>
					</Command.Item>
				))}
				{custom && request?.allowCustom && (
					<Command.Item
						value={`__custom__ ${query}`}
						onSelect={() => close(`custom:${query.trim()}`)}
						className='flex h-9 cursor-default items-center gap-2 rounded-md px-2 text-13 text-accent data-[selected=true]:bg-accent-faint'
					>
						{request.allowCustom.label(query.trim())}
					</Command.Item>
				)}
			</Command.List>
		</Command.Dialog>
	);
}
