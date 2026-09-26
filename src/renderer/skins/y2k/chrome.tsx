import type { SkinChrome } from '../types';
import { YkBackdrop } from './YkBackdrop';
import { YkWindowControls } from './YkWindowControls';

/** Y2K Chrome replaces the window buttons and the sky behind the panes. */
const chrome: SkinChrome = {
	WindowControls: YkWindowControls,
	Backdrop: YkBackdrop,
};

export default chrome;
