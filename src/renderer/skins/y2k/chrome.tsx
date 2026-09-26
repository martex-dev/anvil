import type { SkinChrome } from '../types';
import { YkBackdrop } from './YkBackdrop';
import { YkTitleBar } from './YkTitleBar';
import { YkWindowControls } from './YkWindowControls';

/** Y2K Chrome replaces the title bar, the window buttons and the sky behind the panes. */
const chrome: SkinChrome = {
	TitleBar: YkTitleBar,
	WindowControls: YkWindowControls,
	Backdrop: YkBackdrop,
};

export default chrome;
