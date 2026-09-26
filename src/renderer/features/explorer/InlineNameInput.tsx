import { type JSX, useEffect, useRef, useState } from 'react';

interface InlineNameInputProps {
	initial: string;
	depth: number;
	onSubmit: (name: string) => void;
	onCancel: () => void;
}

/** Name editor used for both "new file/folder" and "rename" rows. */
export function InlineNameInput({
	initial,
	depth,
	onSubmit,
	onCancel,
}: InlineNameInputProps): JSX.Element {
	const [value, setValue] = useState(initial);
	const ref = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const input = ref.current;
		if (!input) return;
		input.focus();
		// Select the name without its extension, like VS Code.
		const dot = initial.lastIndexOf('.');
		input.setSelectionRange(0, dot > 0 ? dot : initial.length);
	}, [initial]);

	const done = (): void => {
		const name = value.trim();
		if (name && name !== initial) onSubmit(name);
		else onCancel();
	};

	return (
		<div className='flex h-6 items-center pr-2' style={{ paddingLeft: 8 + depth * 12 + 16 }}>
			<input
				ref={ref}
				value={value}
				aria-label='Name'
				spellCheck={false}
				onChange={(e) => setValue(e.target.value)}
				onBlur={done}
				onKeyDown={(e) => {
					e.stopPropagation();
					if (e.key === 'Enter') done();
					if (e.key === 'Escape') onCancel();
				}}
				className='h-5 w-full rounded-sm border border-accent bg-bg-2 px-1 text-12 text-fg-0 outline-none'
			/>
		</div>
	);
}
