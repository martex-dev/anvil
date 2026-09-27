import { Circle, CircleCheck, CircleDashed, CircleMinus, CircleX } from 'lucide-react';
import type { JSX } from 'react';

import { cn } from '../../lib/cn';
import { Spinner } from '../../ui/Spinner';
import type { NodeStatus } from './tree-utils';

export const STATUS_LABEL: Record<NodeStatus, string> = {
	running: 'Running',
	queued: 'Queued',
	failed: 'Failed',
	passed: 'Passed',
	skipped: 'Skipped',
	none: 'Not run',
};

/** Pass / fail / skip mark for a tree row; `data-status` is the hook skins and e2e tests use. */
export function TestStatusIcon({
	status,
	size = 13,
}: {
	status: NodeStatus;
	size?: number;
}): JSX.Element {
	if (status === 'running')
		return (
			<span data-part='test-status' data-status={status} className='flex shrink-0'>
				<Spinner size={12} label={STATUS_LABEL.running} />
			</span>
		);
	const Icon = {
		queued: CircleDashed,
		failed: CircleX,
		passed: CircleCheck,
		skipped: CircleMinus,
		none: Circle,
	}[status];
	return (
		<Icon
			size={size}
			role='img'
			aria-label={STATUS_LABEL[status]}
			data-part='test-status'
			data-status={status}
			className={cn(
				'shrink-0',
				status === 'passed' && 'text-up',
				status === 'failed' && 'text-down',
				status === 'skipped' && 'text-warn',
				(status === 'queued' || status === 'none') && 'text-fg-2',
			)}
		/>
	);
}
