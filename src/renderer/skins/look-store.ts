import { create } from 'zustand';

import { DEFAULT_SETTINGS } from '@shared/settings';

import { type Look, resolveLook } from './look';

/**
 * The look on screen right now. It follows settings, but also previews (arrowing through the
 * skin picker), so layout-aware components read this rather than settings.
 */
export const useLookStore = create<{ look: Look }>(() => ({ look: resolveLook(DEFAULT_SETTINGS) }));

export function useLook(): Look {
	return useLookStore((s) => s.look);
}
