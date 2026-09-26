import type { PixelArt } from './pixel';

/* Single-color glyphs (caption buttons, plus, menu) and tiny window diagrams for layout. */

const BLANK = '................';

export const CLOSE: PixelArt = [
	BLANK,
	BLANK,
	BLANK,
	BLANK,
	'....cc....cc....',
	'.....cc..cc.....',
	'......cccc......',
	'.......cc.......',
	'......cccc......',
	'.....cc..cc.....',
	'....cc....cc....',
	BLANK,
	BLANK,
	BLANK,
	BLANK,
	BLANK,
];

export const PLUS: PixelArt = [
	BLANK,
	BLANK,
	BLANK,
	BLANK,
	'.......cc.......',
	'.......cc.......',
	'.......cc.......',
	'....cccccccc....',
	'....cccccccc....',
	'.......cc.......',
	'.......cc.......',
	'.......cc.......',
	BLANK,
	BLANK,
	BLANK,
	BLANK,
];

export const MINIMIZE: PixelArt = [
	BLANK,
	BLANK,
	BLANK,
	BLANK,
	BLANK,
	BLANK,
	BLANK,
	BLANK,
	BLANK,
	BLANK,
	'....cccccc......',
	'....cccccc......',
	BLANK,
	BLANK,
	BLANK,
	BLANK,
];

export const MAXIMIZE: PixelArt = [
	BLANK,
	BLANK,
	BLANK,
	'...ccccccccc....',
	'...ccccccccc....',
	'...c.......c....',
	'...c.......c....',
	'...c.......c....',
	'...c.......c....',
	'...c.......c....',
	'...c.......c....',
	'...ccccccccc....',
	BLANK,
	BLANK,
	BLANK,
	BLANK,
];

export const RESTORE: PixelArt = [
	BLANK,
	BLANK,
	'.....cccccccc...',
	'.....cccccccc...',
	'.....c......c...',
	'...cccccccc.c...',
	'...cccccccc.c...',
	'...c......c.c...',
	'...c......ccc...',
	'...c......c.....',
	'...c......c.....',
	'...cccccccc.....',
	BLANK,
	BLANK,
	BLANK,
	BLANK,
];

export const MENU: PixelArt = [
	BLANK,
	BLANK,
	BLANK,
	BLANK,
	'...cccccccccc...',
	'...cccccccccc...',
	BLANK,
	'...cccccccccc...',
	'...cccccccccc...',
	BLANK,
	'...cccccccccc...',
	'...cccccccccc...',
	BLANK,
	BLANK,
	BLANK,
	BLANK,
];

const TOP = '.kkkkkkkkkkkkkk.';
const TITLE = '.knnnnnnnnnnnnk.';

export const SPLIT: PixelArt = [
	BLANK,
	BLANK,
	TOP,
	TITLE,
	TOP,
	'.kwwwwwkwwwwwwk.',
	'.kwwwwwkwwwwwwk.',
	'.kwwwwwkwwwwwwk.',
	'.kwwwwwkwwwwwwk.',
	'.kwwwwwkwwwwwwk.',
	'.kwwwwwkwwwwwwk.',
	'.kwwwwwkwwwwwwk.',
	'.kwwwwwkwwwwwwk.',
	TOP,
	BLANK,
	BLANK,
];

export const SIDEBAR: PixelArt = [
	BLANK,
	BLANK,
	TOP,
	TITLE,
	TOP,
	'.ksssskwwwwwwwk.',
	'.ksssskwwwwwwwk.',
	'.ksssskwwwwwwwk.',
	'.ksssskwwwwwwwk.',
	'.ksssskwwwwwwwk.',
	'.ksssskwwwwwwwk.',
	'.ksssskwwwwwwwk.',
	'.ksssskwwwwwwwk.',
	TOP,
	BLANK,
	BLANK,
];

export const PANEL: PixelArt = [
	BLANK,
	BLANK,
	TOP,
	TITLE,
	TOP,
	'.kwwwwwwwwwwwwk.',
	'.kwwwwwwwwwwwwk.',
	'.kwwwwwwwwwwwwk.',
	'.kwwwwwwwwwwwwk.',
	TOP,
	'.kssssssssssssk.',
	'.kssssssssssssk.',
	'.kssssssssssssk.',
	TOP,
	BLANK,
	BLANK,
];
