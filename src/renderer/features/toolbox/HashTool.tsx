import { type JSX, useEffect, useState } from 'react';

import { Spinner } from '../../ui/Spinner';
import { CopyValue } from './CopyValue';
import { utf8Encode } from './encoding';
import { Field } from './Field';
import type { Outcome } from './format';
import { TextArea } from './TextArea';
import { ToolError } from './ToolError';
import { sha256Hex } from './tools';

export function HashTool(): JSX.Element {
	const [input, setInput] = useState('');
	const [result, setResult] = useState<Outcome<string> | null>(null);

	useEffect(() => {
		// Digests resolve asynchronously; a stale one must not overwrite the latest input's hash.
		let cancelled = false;
		sha256Hex(input).then(
			(value) => !cancelled && setResult({ ok: true, value }),
			(err: unknown) =>
				!cancelled &&
				setResult({ ok: false, error: err instanceof Error ? err.message : String(err) }),
		);
		return () => {
			cancelled = true;
		};
	}, [input]);

	const bytes = utf8Encode(input).length;

	return (
		<div className='flex flex-col gap-3'>
			<Field label='Text' aside={<span className='num'>{bytes} B UTF-8</span>}>
				<TextArea
					aria-label='Text to hash'
					placeholder='Text to hash'
					value={input}
					onChange={(e) => setInput(e.target.value)}
				/>
			</Field>
			<div className='flex flex-col gap-1'>
				<span className='hud'>SHA-256 (hex)</span>
				{result === null && <Spinner size={12} />}
				{result && !result.ok && <ToolError message={result.error} />}
				{result?.ok && (
					<div className='rounded-sm border border-border bg-bg-2 py-1'>
						<CopyValue value={result.value} label='SHA-256 hash' multiline />
					</div>
				)}
			</div>
		</div>
	);
}
