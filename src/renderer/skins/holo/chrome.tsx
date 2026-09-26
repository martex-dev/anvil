import type { SkinChrome } from '../types';
import { HoloActivityBar } from './HoloActivityBar';
import { HoloBackdrop } from './HoloBackdrop';
import { HoloOverlay } from './HoloOverlay';
import { HoloStatusBar } from './HoloStatusBar';
import { HoloTitleBar } from './HoloTitleBar';
import { HoloWindowControls } from './HoloWindowControls';

/** Holo HUD's replacement chrome: bridge header, nav rail, HUD strip, space and scan layers. */
const chrome: SkinChrome = {
	TitleBar: HoloTitleBar,
	WindowControls: HoloWindowControls,
	ActivityBar: HoloActivityBar,
	StatusBar: HoloStatusBar,
	Backdrop: HoloBackdrop,
	Overlay: HoloOverlay,
};

export default chrome;
