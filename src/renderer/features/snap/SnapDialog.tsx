import type { JSX } from 'react';

import { useSnap } from './snap-store';
import { SnapSheet } from './SnapSheet';

/** Mount once near the app root; it renders nothing until `openSnap` is called. */
export function SnapDialog(): JSX.Element | null {
	const request = useSnap((s) => s.request);
	const nonce = useSnap((s) => s.nonce);
	if (!request) return null;
	// Keyed per open so each snap starts with fresh render state.
	return <SnapSheet key={nonce} request={request} />;
}
