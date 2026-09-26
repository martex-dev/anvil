import type { SkinChrome } from '../types';
import { CommandLine } from './CommandLine';
import { DeskTitleBar } from './DeskTitleBar';
import { DeskWindowControls } from './DeskWindowControls';

/** Cockpit replaces the title bar and adds a <GO> command line under it. */
const chrome: SkinChrome = {
	TitleBar: DeskTitleBar,
	Top: CommandLine,
	WindowControls: DeskWindowControls,
};

export default chrome;
