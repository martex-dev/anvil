import type { SkinChrome } from '../types';
import { WbBackdrop } from './WbBackdrop';
import { WbTaskbar } from './WbTaskbar';
import { WbTitleBar } from './WbTitleBar';
import { WbToolbar } from './WbToolbar';
import { WbWindowControls } from './WbWindowControls';

/**
 * Workbench 95 replaces the caption (with its menu bar), the views switcher (a toolbar), the
 * backdrop (the program's frame) and adds a taskbar. The status bar is the shared one, drawn
 * as sunken fields by status.css.
 */
const chrome: SkinChrome = {
	TitleBar: WbTitleBar,
	WindowControls: WbWindowControls,
	ActivityBar: WbToolbar,
	Backdrop: WbBackdrop,
	Bottom: WbTaskbar,
};

export default chrome;
