import type { SkinChrome } from '../types';
import { HoloBackdrop } from './HoloBackdrop';
import { HoloOverlay } from './HoloOverlay';
import { HoloTitleBar } from './HoloTitleBar';
import { HoloWindowControls } from './HoloWindowControls';

/** Holo HUD's replacement chrome: bridge header, nav rail, HUD strip, space and scan layers. */
const chrome: SkinChrome = {
	TitleBar: HoloTitleBar,
	WindowControls: HoloWindowControls,
	Backdrop: HoloBackdrop,
	Overlay: HoloOverlay,
};

export default chrome;
