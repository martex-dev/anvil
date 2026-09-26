import { type JSX, useMemo, useState } from 'react';

import { Input } from '../../ui/Input';
import { CodeBlock } from './CodeBlock';
import { Field } from './Field';
import { attempt } from './format';
import { Segmented } from './Segmented';
import { ToolError } from './ToolError';
import { convertBytes } from './tools';

type Target = 'hex' | 'base58';

const TARGETS = [
	{ value: 'hex', label: 'Base58 → hex' },
	{ value: 'base58', label: 'Hex → base58' },
] as const;

/** Raw byte re-encoding, e.g. a Solana address (base58) to its 32 key bytes (hex) and back. */
export function ByteConverter(): JSX.Element {
	const [input, setInput] = useState('');
	const [target, setTarget] = useState<Target>('hex');

	const result = useMemo(() => {
		if (input.trim() === '') return null;
		return attempt(() => convertBytes(input, target));
	}, [input, target]);
	const bytes = result?.ok ? result.value.bytes : 0;

	return (
		<div className='flex flex-col gap-2'>
			<span className='hud'>Base58 ⇄ hex bytes</span>
			<Segmented
				aria-label='Conversion'
				options={TARGETS}
				value={target}
				onChange={setTarget}
			/>
			<Field label={target === 'hex' ? 'Base58' : 'Hex'}>
				<Input
					aria-label={target === 'hex' ? 'Base58 input' : 'Hex input'}
					placeholder={target === 'hex' ? 'Solana address, tx signature…' : '0x…'}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					className='num'
					spellCheck={false}
				/>
			</Field>
			{result && !result.ok && <ToolError message={result.error} />}
			{result?.ok && (
				<div className='flex flex-col gap-1'>
					<span className='flex items-center justify-between'>
						<span className='hud'>{target === 'hex' ? 'Hex' : 'Base58'}</span>
						<span className='num text-11 text-fg-2'>
							{bytes} byte{bytes === 1 ? '' : 's'}
						</span>
					</span>
					<CodeBlock value={result.value.text} label='converted bytes' />
				</div>
			)}
		</div>
	);
}
