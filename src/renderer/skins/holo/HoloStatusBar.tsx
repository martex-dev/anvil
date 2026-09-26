import type { JSX } from 'react';

import { UpdateIndicator } from '../../app/UpdateIndicator';
import { LspStatusItem } from '../../features/lsp/LspStatusItem';
import { PythonEnvChip } from '../../features/python/PythonEnvChip';
import { AiToggle } from './AiToggle';
import { CursorReadout } from './CursorReadout';
import { GitReadout } from './GitReadout';
import { MissionClock } from './MissionClock';
import { PowerMeters } from './PowerMeters';
import { ShieldToggle } from './ShieldToggle';
import { ThreatMeter } from './ThreatMeter';

/**
 * The HUD strip under the workbench: navigation and threat on the left, position telemetry,
 * subsystems, reactor power bars and the mission clock on the right.
 */
export function HoloStatusBar(): JSX.Element {
	return (
		<footer data-part='statusbar' className='ho-status'>
			<div className='ho-status-group'>
				<GitReadout />
				<ThreatMeter />
				<PythonEnvChip />
				<LspStatusItem />
			</div>
			<span className='ho-status-fill' aria-hidden />
			<div className='ho-status-group'>
				<CursorReadout />
				<AiToggle />
				<ShieldToggle />
				<PowerMeters />
				<UpdateIndicator />
				<MissionClock />
			</div>
		</footer>
	);
}
