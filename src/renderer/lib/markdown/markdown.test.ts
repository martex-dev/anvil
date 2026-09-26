import { describe, expect, it } from 'vitest';

import { renderMarkdown, stripFrontmatter } from './markdown';

describe('renderMarkdown', () => {
	it('renders wikilinks with aliases and headings as in-app links', () => {
		const html = renderMarkdown(
			'See [[Anvil]], [[Projects/Anvil#Roadmap|the roadmap]] and [[Idea#Why]].',
		);
		expect(html).toContain('<a href="#" class="md-wikilink" data-wikilink="Anvil">Anvil</a>');
		expect(html).toContain('data-wikilink="Projects/Anvil">the roadmap</a>');
		expect(html).toContain('data-wikilink="Idea">Idea › Why</a>');
	});

	it('renders tags but not headings, numbers or mid-word hashes', () => {
		const html = renderMarkdown('# Title\n\nWorking on #ml and #trading/fx, not #2024 or a#b.');
		expect(html).toContain('<h1>Title</h1>');
		expect(html).toContain('data-tag="ml">#ml</a>');
		expect(html).toContain('data-tag="trading/fx">#trading/fx</a>');
		expect(html).not.toContain('data-tag="2024"');
		expect(html).not.toContain('data-tag="b"');
	});

	it('escapes raw HTML and drops dangerous links', () => {
		const html = renderMarkdown(
			'<img src=x onerror=alert(1)> [x](javascript:alert(1)) [ok](https://a.dev)',
		);
		expect(html).not.toContain('<img src=x');
		expect(html).toContain('&lt;img');
		expect(html).not.toContain('href="javascript:');
		expect(html).toContain('href="https://a.dev"');
	});

	it('shows embeds and local images as chips, keeps https images', () => {
		const html = renderMarkdown(
			'![[chart.png]] ![local](img/a.png) ![remote](https://x.dev/a.png)',
		);
		expect(html).toContain('class="md-embed" data-wikilink="chart.png"');
		expect(html).toContain('<span class="md-embed" title="img/a.png">local</span>');
		expect(html).toContain('<img src="https://x.dev/a.png" alt="remote">');
	});

	it('renders task list checkboxes', () => {
		const html = renderMarkdown('- [ ] todo\n- [x] done');
		expect(html).toContain('<span class="md-task" aria-hidden="true"></span>todo');
		expect(html).toContain('<span class="md-task md-task-done" aria-hidden="true"></span>done');
	});

	it('drops frontmatter', () => {
		expect(stripFrontmatter('---\ntags: [a]\n---\nBody')).toBe('Body');
		expect(renderMarkdown('---\ntags: [a]\n---\nBody')).toBe('<p>Body</p>\n');
	});
});
