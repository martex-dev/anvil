import type { SkinChrome } from '../types';
import { HoloBackdrop } from './HoloBackdrop';
import { HoloOverlay } from './HoloOverlay';

/** Holo HUD's replacement chrome. */
const chrome: SkinChrome = {
	Backdrop: HoloBackdrop,
	Overlay: HoloOverlay,
};

export default chrome;
