import { onContent, perLine } from './text-lines';
import { type Transform } from './types';

/*
 * Alternatives, tried left to right at each position:
 * 1. an acronym directly followed by a capitalised word (HTTPServer → HTTP | Server),
 * 2. an optionally capitalised lowercase run (myVar → my | Var),
 * 3. a trailing acronym (parseURL → parse | URL),
 * 4. a bare number, 5. letters without case (CJK etc.).
 * Digits stick to the word before them so utf8 / sha256 / v2 stay one word.
 */
const WORD_RE =
	/\p{Lu}+\d*(?=\p{Lu}\p{Ll})|\p{Lu}?\p{Ll}+\d*|\p{Lu}+\d*|\d+|[\p{Lo}\p{Lt}\p{Lm}]+/gu;

/** Splits an identifier or phrase into lowercase words. */
export function splitWords(text: string): string[] {
	return (text.match(WORD_RE) ?? []).map((word) => word.toLowerCase());
}

function capitalize(word: string): string {
	// Spread by code point so an astral first character isn't split in half.
	const [first = '', ...rest] = word;
	return first.toUpperCase() + rest.join('');
}

function swapCase(text: string): string {
	let out = '';
	for (const ch of text) {
		const upper = ch.toUpperCase();
		out += ch === upper ? ch.toLowerCase() : upper;
	}
	return out;
}

/** Joins the words of each line with `join`; used by the identifier-style cases. */
function wordCase(join: (words: string[]) => string): (text: string) => string {
	return perLine(onContent((content) => join(splitWords(content))));
}

// Title/Sentence case must also work on prose, where splitWords would eat the punctuation.
function isProse(content: string): boolean {
	return /\s/.test(content);
}

function titleCase(content: string): string {
	if (!isProse(content)) return splitWords(content).map(capitalize).join(' ');
	return content.replace(/\S+/g, (word) => capitalize(word.toLowerCase()));
}

function sentenceCase(content: string): string {
	if (!isProse(content)) return capitalize(splitWords(content).join(' '));
	return capitalize(content.toLowerCase()).replace(
		/([.!?]\s+)(\p{Ll})/gu,
		(_m, gap: string, letter: string) => gap + letter.toUpperCase(),
	);
}

export const CASE_TRANSFORMS: readonly Transform[] = [
	{
		id: 'camel-case',
		label: 'camelCase',
		group: 'Case',
		example: 'myVariableName',
		run: wordCase((w) => w.map((word, i) => (i === 0 ? word : capitalize(word))).join('')),
	},
	{
		id: 'pascal-case',
		label: 'PascalCase',
		group: 'Case',
		example: 'MyVariableName',
		run: wordCase((w) => w.map(capitalize).join('')),
	},
	{
		id: 'snake-case',
		label: 'snake_case',
		group: 'Case',
		example: 'my_variable_name',
		run: wordCase((w) => w.join('_')),
	},
	{
		id: 'constant-case',
		label: 'CONSTANT_CASE',
		group: 'Case',
		example: 'MY_VARIABLE_NAME',
		run: wordCase((w) => w.join('_').toUpperCase()),
	},
	{
		id: 'kebab-case',
		label: 'kebab-case',
		group: 'Case',
		example: 'my-variable-name',
		run: wordCase((w) => w.join('-')),
	},
	{
		id: 'dot-case',
		label: 'dot.case',
		group: 'Case',
		example: 'my.variable.name',
		run: wordCase((w) => w.join('.')),
	},
	{
		id: 'path-case',
		label: 'path/case',
		group: 'Case',
		example: 'my/variable/name',
		run: wordCase((w) => w.join('/')),
	},
	{
		id: 'title-case',
		label: 'Title Case',
		group: 'Case',
		example: 'My Variable Name',
		run: perLine(onContent(titleCase)),
	},
	{
		id: 'sentence-case',
		label: 'Sentence case',
		group: 'Case',
		example: 'My variable name',
		run: perLine(onContent(sentenceCase)),
	},
	{
		id: 'lower-case',
		label: 'lower case',
		group: 'Case',
		example: 'my variable name',
		run: (text) => text.toLowerCase(),
	},
	{
		id: 'upper-case',
		label: 'UPPER CASE',
		group: 'Case',
		example: 'MY VARIABLE NAME',
		run: (text) => text.toUpperCase(),
	},
	{
		id: 'swap-case',
		label: 'sWAP cASE',
		group: 'Case',
		example: 'mY vARIABLE nAME',
		run: swapCase,
	},
];
