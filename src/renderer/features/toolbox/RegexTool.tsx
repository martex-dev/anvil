import { type JSX, useState } from 'react';

import { Input } from '../../ui/Input';
import { CopyValue } from './CopyValue';
import { Field } from './Field';
import { TextArea } from './TextArea';
import { ToolError } from './ToolError';
import { MAX_REGEX_MATCHES } from './tools';
import { useRegexTest } from './use-regex-test';

// Rendering thousands of rows would stall typing; the count still reports the full total.
const MAX_SHOWN = 200;

export function RegexTool(): JSX.Element {
	const [pattern, setPattern] = useState('');
	const [flags, setFlags] = useState('g');
	const [text, setText] = useState('');
	const { outcome, pending } = useRegexTest(pattern, flags, text);
	const result = outcome?.kind === 'result' ? outcome.result : null;
	const count = result?.matches.length ?? 0;

	return (
		<div className='flex flex-col gap-3'>
			<div className='flex gap-2'>
				<Field label='Pattern' className='flex-1'>
					<Input
						aria-label='Pattern'
						placeholder='(\d+)\.(\d+)'
						leading='/'
						value={pattern}
						onChange={(e) => setPattern(e.target.value)}
						invalid={Boolean(result?.error)}
						className='num'
						spellCheck={false}
					/>
				</Field>
				<Field label='Flags' className='w-16'>
					<Input
						aria-label='Flags'
						placeholder='gimsuy'
						value={flags}
						onChange={(e) => setFlags(e.target.value)}
						className='num'
						spellCheck={false}
					/>
				</Field>
			</div>
			<Field label='Test text'>
				<TextArea
					aria-label='Test text'
					placeholder='Text to match against'
					rows={5}
					value={text}
					onChange={(e) => setText(e.target.value)}
				/>
			</Field>
			{outcome?.kind === 'timeout' && (
				<ToolError message='Pattern took too long (catastrophic backtracking?). Try removing nested quantifiers like (a+)+.' />
			)}
			{outcome?.kind === 'crashed' && <ToolError message={outcome.message} />}
			{result?.error && <ToolError message={result.error} />}
			{result && !result.error && (
				<div className='flex flex-col gap-1' aria-busy={pending}>
					<span className='hud'>
						{count === 0
							? 'No matches'
							: `${count}${count >= MAX_REGEX_MATCHES ? '+' : ''} match${count === 1 ? '' : 'es'}`}
					</span>
					<ol className='flex flex-col gap-1'>
						{result.matches.slice(0, MAX_SHOWN).map((m, i) => (
							<li
								key={`${m.index}-${i}`}
								className='rounded-sm border border-border bg-bg-2 py-0.5'
							>
								<div className='flex items-center gap-1 pl-1.5'>
									<span className='num w-12 shrink-0 text-11 text-fg-2'>
										@{m.index}
									</span>
									<CopyValue
										value={m.match}
										label={`match ${i + 1}`}
										display={
											m.match === '' ? (
												<span className='text-fg-2'>(empty)</span>
											) : undefined
										}
									/>
								</div>
								{m.groups.map((g, gi) => (
									<div key={gi} className='flex items-center gap-1 pl-1.5'>
										<span className='num w-12 shrink-0 text-11 text-accent-2'>
											${gi + 1}
										</span>
										<CopyValue value={g} label={`group ${gi + 1}`} />
									</div>
								))}
							</li>
						))}
					</ol>
					{count > MAX_SHOWN && (
						<p className='text-11 text-fg-2'>Showing the first {MAX_SHOWN} matches.</p>
					)}
				</div>
			)}
		</div>
	);
}
