import type { SkinChrome } from '../types';
import { BlockWindowControls } from './BlockWindowControls';
import { PaperBackdrop } from './PaperBackdrop';
import { PosterStatusBar } from './PosterStatusBar';
import { PosterTitleBar } from './PosterTitleBar';

const chrome: SkinChrome = {
	TitleBar: PosterTitleBar,
	WindowControls: BlockWindowControls,
	StatusBar: PosterStatusBar,
	Backdrop: PaperBackdrop,
};

export default chrome;
