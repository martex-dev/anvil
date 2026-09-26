import type { SkinChrome } from '../types';
import { MfBackdrop } from './MfBackdrop';

/** Mainframe's replacement chrome; the activity strip stays shared and is restyled in CSS. */
const chrome: SkinChrome = {
	Backdrop: MfBackdrop,
};

export default chrome;
