import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { paneValueText } from '../app/PaneSplitter';
import { Splitter } from './Splitter';

describe('Splitter', () => {
	it('reports the pane size and range to screen readers', () => {
		const html = renderToStaticMarkup(
			<Splitter
				axis='x'
				label='Resize side bar'
				onDrag={() => undefined}
				value={{ now: 272, min: 180, max: 640, text: paneValueText('sideWidth', 272) }}
			/>,
		);
		expect(html).toContain('aria-valuenow="272"');
		expect(html).toContain('aria-valuemin="180"');
		expect(html).toContain('aria-valuemax="640"');
		expect(html).toContain('aria-valuetext="272 pixels"');
	});

	it('speaks the editor split as a percentage', () => {
		expect(paneValueText('splitRatio', 0.456)).toBe('46%');
	});
});
