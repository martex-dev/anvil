import { describe, expect, it } from 'vitest';

import { CHROME_ICONS } from '../types';
import * as glyphs from './art-glyphs';
import * as tools from './art-tools';
import * as views from './art-views';
import { CHROME_ART } from './icons';
import { ART_SIZE, isPixelChar, runsOf } from './pixel';

const ALL = { ...glyphs, ...tools, ...views };

describe('workbench pixel art', () => {
	it.each(Object.entries(ALL))('%s is a 16x16 map of known inks', (_, art) => {
		expect(art).toHaveLength(ART_SIZE);
		for (const row of art) {
			expect(row).toHaveLength(ART_SIZE);
			expect([...row].filter((ch) => !isPixelChar(ch))).toEqual([]);
		}
	});

	it('draws every chrome icon', () => {
		expect(Object.keys(CHROME_ART).sort()).toEqual([...CHROME_ICONS].sort());
	});

	it('merges a row into runs of one color', () => {
		const runs = runsOf(glyphs.MINIMIZE);
		expect(runs).toEqual([
			{ x: 4, y: 10, width: 6, fill: 'currentColor' },
			{ x: 4, y: 11, width: 6, fill: 'currentColor' },
		]);
	});
});
