import { type JSX, useMemo } from 'react';

import { CodeBlock } from './CodeBlock';
import { Field } from './Field';
import { attempt } from './format';
import { Segmented } from './Segmented';
import { TextArea } from './TextArea';
import { useToolField } from './toolbox-store';
import { ToolError } from './ToolError';
import { formatJson, type JsonFormatMode } from './tools';

const MODES = [
	{ value: 'pretty', label: 'Pretty' },
	{ value: 'minify', label: 'Minify' },
	{ value: 'sort', label: 'Sort keys' },
] as const;

export function JsonTool(): JSX.Element {
	const [input, setInput] = useToolField('json.input', '');
	const [mode, setMode] = useToolField<JsonFormatMode>('json.mode', 'pretty');
	const filled = input.trim() !== '';
	const result = useMemo(
		() => (filled ? attempt(() => formatJson(input, mode)) : null),
		[filled, input, mode],
	);

	return (
		<div className='flex flex-col gap-3'>
			<Field label='JSON'>
				<TextArea
					aria-label='JSON input'
					placeholder='{"symbol": "BTCUSDT", "qty": 0.5}'
					rows={6}
					value={input}
					onChange={(e) => setInput(e.target.value)}
				/>
			</Field>
			<Segmented aria-label='Format' options={MODES} value={mode} onChange={setMode} />
			{result && !result.ok && <ToolError message={result.error} />}
			{result?.ok && (
				<div className='flex flex-col gap-1'>
					<span className='hud'>Output</span>
					<CodeBlock value={result.value} label='formatted JSON' />
				</div>
			)}
		</div>
	);
}
