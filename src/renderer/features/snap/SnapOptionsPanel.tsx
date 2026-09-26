import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { JSX } from 'react';

import { cn } from '../../lib/cn';
import { IconButton } from '../../ui/IconButton';
import { Switch } from '../../ui/Switch';
import { Tooltip } from '../../ui/Tooltip';
import { Segmented } from '../toolbox/Segmented';
import { BACKGROUNDS } from './backgrounds';
import type { ChromeId, PaddingId } from './snap-layout';
import { FONT_SIZE_MAX, FONT_SIZE_MIN, type SnapOptions } from './snap-options';

interface SnapOptionsPanelProps {
	options: SnapOptions;
	/** Effective size: the saved override or the editor's. */
	fontSize: number;
	startLine: number;
	onChange: (patch: Partial<SnapOptions>) => void;
}

const PADDINGS = [
	{ value: 's', label: 'S' },
	{ value: 'm', label: 'M' },
	{ value: 'l', label: 'L' },
] as const satisfies readonly { value: PaddingId; label: string }[];

const CHROMES = [
	{ value: 'mac', label: 'macOS' },
	{ value: 'title', label: 'Title' },
	{ value: 'none', label: 'None' },
] as const satisfies readonly { value: ChromeId; label: string }[];

type ToggleKey = 'lineNumbers' | 'shadow' | 'glow' | 'watermark';

export function SnapOptionsPanel({
	options,
	fontSize,
	startLine,
	onChange,
}: SnapOptionsPanelProps): JSX.Element {
	const toggles: { key: ToggleKey; label: string; hint?: string }[] = [
		{ key: 'lineNumbers', label: 'Line numbers', hint: `from ${startLine}` },
		{ key: 'shadow', label: 'Drop shadow' },
		{ key: 'glow', label: 'Accent glow' },
		{ key: 'watermark', label: 'Watermark' },
	];

	return (
		<aside
			aria-label='Snap options'
			className='flex w-64 shrink-0 flex-col gap-5 overflow-y-auto border-l border-glass-edge bg-bg-1/40 p-4'
		>
			<section>
				<h3 className='hud mb-2'>Background</h3>
				<div role='radiogroup' aria-label='Background' className='grid grid-cols-4 gap-2'>
					{BACKGROUNDS.map((bg) => {
						const active = bg.id === options.background;
						return (
							<Tooltip key={bg.id} content={bg.label}>
								<button
									type='button'
									role='radio'
									aria-checked={active}
									aria-label={bg.label}
									onClick={() => onChange({ background: bg.id })}
									style={{ background: bg.css }}
									className={cn(
										'h-9 rounded-md border transition-[border-color,box-shadow] transition-fast',
										'focus-visible:shadow-glow focus-visible:outline-none',
										active
											? 'border-accent shadow-glow'
											: 'border-glass-edge hover:border-border-strong',
									)}
								/>
							</Tooltip>
						);
					})}
				</div>
			</section>

			<section>
				<h3 className='hud mb-2'>Padding</h3>
				<Segmented
					aria-label='Padding'
					options={PADDINGS}
					value={options.padding}
					onChange={(padding) => onChange({ padding })}
				/>
			</section>

			<section>
				<h3 className='hud mb-2'>Window</h3>
				<Segmented
					aria-label='Window chrome'
					options={CHROMES}
					value={options.chrome}
					onChange={(chrome) => onChange({ chrome })}
				/>
			</section>

			<section>
				<h3 className='hud mb-2'>Font size</h3>
				<div className='flex items-center gap-1'>
					<IconButton
						size='sm'
						label='Smaller text'
						icon={<Minus size={13} />}
						disabled={fontSize <= FONT_SIZE_MIN}
						onClick={() =>
							onChange({ fontSize: Math.max(FONT_SIZE_MIN, fontSize - 1) })
						}
					/>
					<span className='num w-12 text-center text-13 text-fg-0'>
						{fontSize}
						<span className='text-fg-2'>px</span>
					</span>
					<IconButton
						size='sm'
						label='Larger text'
						icon={<Plus size={13} />}
						disabled={fontSize >= FONT_SIZE_MAX}
						onClick={() =>
							onChange({ fontSize: Math.min(FONT_SIZE_MAX, fontSize + 1) })
						}
					/>
					{options.fontSize !== null && (
						<IconButton
							size='sm'
							label='Match the editor'
							icon={<RotateCcw size={12} />}
							onClick={() => onChange({ fontSize: null })}
							className='ml-auto'
						/>
					)}
				</div>
			</section>

			<section className='flex flex-col gap-1'>
				<h3 className='hud mb-1'>Details</h3>
				{toggles.map(({ key, label, hint }) => (
					<label
						key={key}
						className='flex h-7 cursor-pointer items-center justify-between gap-2 text-12 text-fg-1 hover:text-fg-0'
					>
						<span>
							{label}
							{hint && options[key] && (
								<span className='num ml-1.5 text-11 text-fg-2'>{hint}</span>
							)}
						</span>
						<Switch
							aria-label={label}
							checked={options[key]}
							onCheckedChange={(checked) => onChange({ [key]: checked })}
						/>
					</label>
				))}
			</section>
		</aside>
	);
}
