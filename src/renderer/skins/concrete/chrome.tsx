import type { SkinChrome } from '../types';
import { BlockWindowControls } from './BlockWindowControls';
import { NumeralColumn } from './NumeralColumn';
import { PaperBackdrop } from './PaperBackdrop';
import { PosterStatusBar } from './PosterStatusBar';
import { PosterTitleBar } from './PosterTitleBar';

const chrome: SkinChrome = {
	TitleBar: PosterTitleBar,
	WindowControls: BlockWindowControls,
	ActivityBar: NumeralColumn,
	StatusBar: PosterStatusBar,
	Backdrop: PaperBackdrop,
};

export default chrome;
