import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { IconButton } from './IconButton';
import { TooltipProvider } from './Tooltip';

const render = (props: { active?: boolean; toggle?: boolean }): string =>
	renderToStaticMarkup(
		<TooltipProvider>
			<IconButton label='Toggle side bar' icon={null} {...props} />
		</TooltipProvider>,
	);

describe('IconButton', () => {
	it('exposes toggles as pressed or not pressed', () => {
		expect(render({ toggle: true, active: false })).toContain('aria-pressed="false"');
		expect(render({ toggle: true, active: true })).toContain('aria-pressed="true"');
	});

	it('leaves aria-pressed off plain buttons', () => {
		expect(render({ active: true })).not.toContain('aria-pressed');
	});

	it('keeps the active look on hover', () => {
		const html = render({ active: true });
		expect(html).toContain('hover:bg-accent-soft');
		expect(html).not.toContain('hover:bg-bg-3');
	});
});
