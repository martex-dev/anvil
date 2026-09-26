import type { SkinChrome } from '../types';
import { CommandLine } from './CommandLine';
import { DeskTape } from './DeskTape';
import { DeskTitleBar } from './DeskTitleBar';
import { DeskWindowControls } from './DeskWindowControls';

/** Cockpit replaces the title bar, adds the command line and turns the status bar into a tape. */
const chrome: SkinChrome = {
	TitleBar: DeskTitleBar,
	Top: CommandLine,
	StatusBar: DeskTape,
	WindowControls: DeskWindowControls,
};

export default chrome;
