import type { SkinChrome } from '../types';
import { MfBackdrop } from './MfBackdrop';
import { MfStatusBar } from './MfStatusBar';
import { MfTitleBar } from './MfTitleBar';
import { MfWindowControls } from './MfWindowControls';

/** Mainframe's replacement chrome; the activity strip stays shared and is restyled in CSS. */
const chrome: SkinChrome = {
	TitleBar: MfTitleBar,
	WindowControls: MfWindowControls,
	StatusBar: MfStatusBar,
	Backdrop: MfBackdrop,
};

export default chrome;
