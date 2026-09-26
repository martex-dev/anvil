import type { SkinChrome } from '../types';
import { DeskTitleBar } from './DeskTitleBar';
import { DeskWindowControls } from './DeskWindowControls';

/** Cockpit replaces the title bar with a slim desk header and square window keys. */
const chrome: SkinChrome = {
	TitleBar: DeskTitleBar,
	WindowControls: DeskWindowControls,
};

export default chrome;
