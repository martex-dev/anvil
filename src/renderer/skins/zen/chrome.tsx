import type { SkinChrome } from '../types';
import { ActivityBar } from './ActivityBar';
import { PaperBackdrop } from './PaperBackdrop';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';
import { WindowButtons } from './WindowButtons';

/** Zen Paper's own chrome: running head, contents rail, colophon and the paper itself. */
const chrome: SkinChrome = {
	TitleBar,
	ActivityBar,
	StatusBar,
	Backdrop: PaperBackdrop,
	WindowControls: WindowButtons,
};

export default chrome;
