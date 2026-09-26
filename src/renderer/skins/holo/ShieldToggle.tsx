import { ShieldCheck, ShieldOff } from 'lucide-react';
import type { JSX } from 'react';

import { useSettings } from '../../app/hooks/use-settings';
import { StatusCell } from './StatusCell';

/** The secret shield as deflector status: up or down. */
export function ShieldToggle(): JSX.Element {
	const { settings, update } = useSettings();
	const on = settings.secretShield;
	return (
		<StatusCell
			onClick={() => update({ secretShield: !on })}
			title={`Secret shield ${on ? 'on' : 'off'}: blurs .env values and flags keys and seed phrases in code`}
		>
			{on ? (
				<ShieldCheck size={12} className='text-up' />
			) : (
				<ShieldOff size={12} className='text-down' />
			)}
			<span
				className={
					on ? 'ho-cell-tag ho-cell-label text-up' : 'ho-cell-tag ho-cell-label text-down'
				}
			>
				{on ? 'SHIELD UP' : 'SHIELD DOWN'}
			</span>
		</StatusCell>
	);
}
