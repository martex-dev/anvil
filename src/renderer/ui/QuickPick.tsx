import { Command } from 'cmdk';
import { CornerDownLeft } from 'lucide-react';
import type { JSX, ReactNode } from 'react';
import { create } from 'zustand';

import { cn } from '../lib/cn';
import { rlog } from '../lib/log';
import { useRegisterOverlay } from '../stores/overlay-store';
import { toast } from '../stores/toast-store';
import { ErrorState } from './ErrorState';
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
	/**
	 * Toast title when `items` rejects; the picker then closes. Without it, the picker shows the
	 * failure in place of its list.
	 */
	loadErrorTitle?: string;
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
	/** Why async items failed to load; shown instead of "Nothing matches". */
	error: string | null;
}

export const useQuickPickStore = create<QuickPickState>(() => ({
	request: null,
	items: null,
	query: '',
	active: '',
	error: null,
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
		const request: PickRequest = { ...options, resolve };
		useQuickPickStore.setState({
			request,
			items: Array.isArray(options.items) ? options.items : null,
			query: '',
			active: Array.isArray(options.items) ? initialActive(options.items) : '',
			error: null,
		});
		if (Array.isArray(options.items)) return;
		// A slow load must not fill a picker opened after it (picking would apply the wrong value).
		const current = (): boolean => useQuickPickStore.getState().request === request;
		options.items
			.then((items) => {
				if (current()) useQuickPickStore.setState({ items, active: initialActive(items) });
			})
			// Never an empty "Nothing matches." list (still offering "create …"): that would hide
			// the failure. Leave a picker that has replaced this one alone.
			.catch((error: unknown) => {
				rlog.error('quick-pick', `loading "${options.title}" items failed`, error);
				if (!current()) return;
				const message = error instanceof Error ? error.message : String(error);
				// A caller that names the failure (git's branch and log pickers) has nothing to
				// offer without its items: say why in a toast and close. Others show the reason in
				// the picker.
				if (options.loadErrorTitle !== undefined) {
					toast.error(options.loadErrorTitle, message);
					close(null);
					return;
				}
				useQuickPickStore.setState({ items: [], error: message });
			});
	});
}

function close(value: string | null): void {
	const req = useQuickPickStore.getState().request;
	useQuickPickStore.setState({ request: null, items: null, query: '', active: '', error: null });
	req?.resolve(value);
}

export function QuickPickHost(): JSX.Element {
	const { request, items, query, active, error } = useQuickPickStore();
	useRegisterOverlay(request !== null);
	// No "create …" next to a failed load: the list it would add to is unknown.
	const custom =
		error === null &&
		request?.allowCustom &&
		query.trim() &&
		!items?.some((i) => i.label === query.trim());
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
				) : error !== null ? (
					<ErrorState
						title={`Couldn't load ${request?.title.toLowerCase() ?? 'the list'}`}
						message={error}
						className='h-auto min-h-0 py-6'
					/>
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
							{/* Ellipsis needs a block-level text box: truncate on the flex row itself
							    only clips. Titles expose the full branch, model or path. */}
							<span className='flex min-w-0 items-center gap-2'>
								<span className='min-w-0 truncate' title={item.label}>
									{item.label}
								</span>
								{item.description && (
									<span
										className='min-w-0 truncate text-12 text-fg-2'
										title={item.description}
									>
										{item.description}
									</span>
								)}
								{item.current && (
									<span className='hud shrink-0 text-accent'>current</span>
								)}
							</span>
							{item.detail && (
								<span
									className='truncate font-mono text-11 text-fg-2'
									title={item.detail}
								>
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
