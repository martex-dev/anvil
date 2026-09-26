import type { SkinChrome } from '../types';
import { BlockWindowControls } from './BlockWindowControls';
import { PaperBackdrop } from './PaperBackdrop';
import { PosterTitleBar } from './PosterTitleBar';

const chrome: SkinChrome = {
	TitleBar: PosterTitleBar,
	WindowControls: BlockWindowControls,
	Backdrop: PaperBackdrop,
};

export default chrome;
