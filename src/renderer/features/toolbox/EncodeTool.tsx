import { ArrowUpDown } from 'lucide-react';
import { type JSX, useMemo } from 'react';

import { IconButton } from '../../ui/IconButton';
import { Select } from '../../ui/Select';
import { ByteConverter } from './ByteConverter';
import { CodeBlock } from './CodeBlock';
import { Field } from './Field';
import { attempt } from './format';
import { Segmented } from './Segmented';
import { TextArea } from './TextArea';
import { useToolField } from './toolbox-store';
import { ToolError } from './ToolError';
import { decode, encode, type EncodingKind } from './tools';

type Direction = 'encode' | 'decode';

const KIND_OPTIONS: { value: EncodingKind; label: string }[] = [
	{ value: 'base64', label: 'Base64' },
	{ value: 'base64url', label: 'Base64url' },
	{ value: 'hex', label: 'Hex (UTF-8 bytes)' },
	{ value: 'base58', label: 'Base58' },
	{ value: 'url', label: 'URL (percent)' },
];

const DIRECTIONS = [
	{ value: 'encode', label: 'Encode' },
	{ value: 'decode', label: 'Decode' },
] as const;

function isKind(value: string): value is EncodingKind {
	return KIND_OPTIONS.some((k) => k.value === value);
}

export function EncodeTool(): JSX.Element {
	const [input, setInput] = useToolField('encode.input', '');
	const [kind, setKind] = useToolField<EncodingKind>('encode.kind', 'base64');
	// Output follows the input live once a direction is chosen, so edits need no extra click.
	const [direction, setDirection] = useToolField<Direction | null>('encode.direction', null);

	const result = useMemo(() => {
		if (!direction || input === '') return null;
		return attempt(() => (direction === 'encode' ? encode(kind, input) : decode(kind, input)));
	}, [direction, input, kind]);

	return (
		<div className='flex flex-col gap-3'>
			<Field label='Input'>
				<TextArea
					aria-label='Text to encode or decode'
					placeholder='Text, or encoded data to decode'
					value={input}
					onChange={(e) => setInput(e.target.value)}
				/>
			</Field>
			<div className='flex flex-wrap items-center gap-1'>
				<Select
					aria-label='Encoding'
					value={kind}
					onValueChange={(v) => isKind(v) && setKind(v)}
					options={KIND_OPTIONS}
					className='flex-1'
				/>
				<Segmented
					aria-label='Direction'
					options={DIRECTIONS}
					value={direction}
					onChange={setDirection}
					className='min-w-36 flex-1'
				/>
			</div>
			{!direction && input !== '' && (
				<p className='text-12 text-fg-2'>Choose Encode or Decode to see the output.</p>
			)}
			{result && !result.ok && <ToolError message={result.error} />}
			{result?.ok && (
				<div className='flex flex-col gap-1'>
					<div className='flex items-center justify-between'>
						<span className='hud'>
							{direction === 'encode' ? 'Encoded' : 'Decoded'}
						</span>
						<IconButton
							size='sm'
							label='Use output as input'
							icon={<ArrowUpDown size={12} />}
							onClick={() => {
								setInput(result.value);
								setDirection(direction === 'encode' ? 'decode' : 'encode');
							}}
						/>
					</div>
					<CodeBlock value={result.value} label='output' />
				</div>
			)}
			<div className='border-t border-border pt-3'>
				<ByteConverter />
			</div>
		</div>
	);
}
