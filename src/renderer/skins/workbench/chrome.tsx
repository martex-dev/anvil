import type { SkinChrome } from '../types';
import { WbTitleBar } from './WbTitleBar';
import { WbWindowControls } from './WbWindowControls';

/** Workbench 95 replaces the caption (with its menu bar) and the caption buttons. */
const chrome: SkinChrome = {
	TitleBar: WbTitleBar,
	WindowControls: WbWindowControls,
};

export default chrome;
