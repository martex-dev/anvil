import type { SkinChrome } from '../types';
import { PaperBackdrop } from './PaperBackdrop';

/** Zen Paper's own chrome: running head, contents rail, colophon and the paper itself. */
const chrome: SkinChrome = {
	Backdrop: PaperBackdrop,
};

export default chrome;
