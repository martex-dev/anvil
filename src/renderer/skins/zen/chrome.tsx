import type { SkinChrome } from '../types';
import { PaperBackdrop } from './PaperBackdrop';
import { TitleBar } from './TitleBar';
import { WindowButtons } from './WindowButtons';

/** Zen Paper's own chrome: running head, contents rail, colophon and the paper itself. */
const chrome: SkinChrome = {
	TitleBar,
	Backdrop: PaperBackdrop,
	WindowControls: WindowButtons,
};

export default chrome;
