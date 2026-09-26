import type { SkinChrome } from '../types';
import { WbTitleBar } from './WbTitleBar';
import { WbToolbar } from './WbToolbar';
import { WbWindowControls } from './WbWindowControls';

/**
 * Workbench 95 replaces the caption (with its menu bar), the caption buttons and the views
 * switcher, which becomes a toolbar.
 */
const chrome: SkinChrome = {
	TitleBar: WbTitleBar,
	WindowControls: WbWindowControls,
	ActivityBar: WbToolbar,
};

export default chrome;
