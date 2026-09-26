import { Check, Copy } from 'lucide-react';
import { type JSX, useEffect, useState } from 'react';

import { toast } from '../../stores/toast-store';
import { IconButton } from '../../ui/IconButton';

/** Hover-revealed copy action; stays reachable by Tab because focus also reveals it. */
export function CopySourceButton({ text }: { text: string }): JSX.Element {
	const [copied, setCopied] = useState(false);
	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), 1200);
		return () => clearTimeout(timer);
	}, [copied]);
	return (
		<IconButton
			size='sm'
			label={copied ? 'Copied' : 'Copy cell source'}
			icon={copied ? <Check size={13} className='text-up' /> : <Copy size={13} />}
			className='bg-bg-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100'
			onClick={() => {
				navigator.clipboard.writeText(text).then(
					() => setCopied(true),
					(error: unknown) =>
						toast.error(
							'Could not copy',
							error instanceof Error ? error.message : String(error),
						),
				);
			}}
		/>
	);
}
