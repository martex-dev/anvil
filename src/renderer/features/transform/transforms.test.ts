import { describe, expect, it } from 'vitest';

import { splitWords, TRANSFORMS } from './transforms';

function run(id: string, text: string): string {
	const transform = TRANSFORMS.find((t) => t.id === id);
	if (!transform) throw new Error(`No transform ${id}`);
	return transform.run(text);
}

describe('TRANSFORMS registry', () => {
	it('has unique kebab-case ids and a label/example for each', () => {
		const ids = TRANSFORMS.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const t of TRANSFORMS) {
			expect(t.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
			expect(t.label).not.toBe('');
			expect(t.example).not.toBe('');
		}
	});

	it('covers every group', () => {
		const groups = new Set(TRANSFORMS.map((t) => t.group));
		expect([...groups].sort()).toEqual(['Case', 'Clean', 'Code', 'Decode', 'Encode', 'Lines']);
	});

	it('keeps the trailing newline and CRLF style', () => {
		const safe = TRANSFORMS.filter((t) =>
			['Case', 'Lines', 'Clean', 'Encode'].includes(t.group),
		);
		for (const t of safe) {
			const lf = t.run('fooBar\n  baz qux\n');
			expect(lf.endsWith('\n'), t.id).toBe(true);
			const crlf = t.run('fooBar\r\n  baz qux\r\n');
			expect(crlf.endsWith('\r\n'), t.id).toBe(true);
			expect(/(?<!\r)\n/.test(crlf), t.id).toBe(false);
		}
	});
});

describe('splitWords', () => {
	it.each([
		['HTTPServer', ['http', 'server']],
		['getHTTPResponse', ['get', 'http', 'response']],
		['XMLHttpRequest', ['xml', 'http', 'request']],
		['parseURL', ['parse', 'url']],
		['my_var-name here', ['my', 'var', 'name', 'here']],
		['MAX_RETRY_COUNT', ['max', 'retry', 'count']],
		['utf8Decoder', ['utf8', 'decoder']],
		['sha256', ['sha256']],
		['caféBar', ['café', 'bar']],
		['  ', []],
	])('%s', (input, words) => {
		expect(splitWords(input)).toEqual(words);
	});
});

describe('case transforms', () => {
	it.each([
		['camel-case', 'myVariableName'],
		['pascal-case', 'MyVariableName'],
		['snake-case', 'my_variable_name'],
		['constant-case', 'MY_VARIABLE_NAME'],
		['kebab-case', 'my-variable-name'],
		['dot-case', 'my.variable.name'],
		['path-case', 'my/variable/name'],
		['title-case', 'My Variable Name'],
		['sentence-case', 'My variable name'],
	])('%s', (id, expected) => {
		expect(run(id, 'my_variable_name')).toBe(expected);
		expect(run(id, 'MyVariableName')).toBe(expected);
	});

	it('handles acronyms', () => {
		expect(run('snake-case', 'HTTPServerError')).toBe('http_server_error');
		expect(run('camel-case', 'XML_HTTP_REQUEST')).toBe('xmlHttpRequest');
	});

	it('applies per line, keeping indentation and CRLF', () => {
		expect(run('snake-case', 'fooBar\r\n  bazQux\r\n')).toBe('foo_bar\r\n  baz_qux\r\n');
		expect(run('camel-case', 'a_b\n\nc_d')).toBe('aB\n\ncD');
	});

	it('treats prose differently for Title and Sentence case', () => {
		expect(run('title-case', 'the QUICK brown fox.')).toBe('The Quick Brown Fox.');
		expect(run('sentence-case', 'HELLO world. how ARE you?')).toBe('Hello world. How are you?');
	});

	it('lower, upper, swap', () => {
		expect(run('lower-case', 'Hello É')).toBe('hello é');
		expect(run('upper-case', 'Hello é')).toBe('HELLO É');
		expect(run('swap-case', 'Hello World 1')).toBe('hELLO wORLD 1');
	});
});

describe('line transforms', () => {
	it('sorts naturally and keeps the trailing newline', () => {
		expect(run('sort-lines-asc', 'b\nfile10\nfile2\na\n')).toBe('a\nb\nfile2\nfile10\n');
		expect(run('sort-lines-desc', 'a\nc\nb')).toBe('c\nb\na');
	});

	it('sorts by the first number, numberless lines last', () => {
		expect(run('sort-lines-numeric', 'x 10\nnone\ny 2.5\nz -1')).toBe(
			'z -1\ny 2.5\nx 10\nnone',
		);
	});

	it('sorts by length (stable) and reverses', () => {
		expect(run('sort-lines-length', 'ccc\na\nbb\nd')).toBe('a\nd\nbb\nccc');
		expect(run('reverse-lines', '1\r\n2\r\n3')).toBe('3\r\n2\r\n1');
	});

	it('shuffles without losing lines', () => {
		const input = Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n');
		const out = run('shuffle-lines', input).split('\n');
		expect([...out].sort()).toEqual(input.split('\n').sort());
	});

	it('unique keeps the first occurrence; remove empty drops blank lines', () => {
		expect(run('unique-lines', 'a\nb\na\nc\nb')).toBe('a\nb\nc');
		expect(run('remove-empty-lines', 'a\n\n   \nb\n')).toBe('a\nb\n');
	});

	it('joins and splits', () => {
		expect(run('join-lines-space', '  a\n  b\n\n  c\n')).toBe('  a b c\n');
		expect(run('join-lines-comma', 'a\nb\nc')).toBe('a, b, c');
		expect(run('split-commas', '  a, b,c,')).toBe('  a\n  b\n  c');
	});

	it('numbers lines', () => {
		expect(run('number-lines', 'x\ny')).toBe('1. x\n2. y');
	});

	it('wraps lines in a Python list with escaped quotes', () => {
		expect(run('python-list', "  it's\n  b\\c\n\n  d")).toBe("  ['it\\'s', 'b\\\\c', 'd']");
	});
});

describe('clean transforms', () => {
	it('trims trailing whitespace and collapses interior spaces', () => {
		expect(run('trim-trailing-whitespace', 'a  \nb\t\n')).toBe('a\nb\n');
		expect(run('collapse-spaces', '    a   b \t c')).toBe('    a b c');
	});

	it('converts tabs and spaces', () => {
		expect(run('tabs-to-spaces', '\ta\tb')).toBe('    a   b');
		expect(run('spaces-to-tabs', '        x\n      y  z')).toBe('\t\tx\n\t  y  z');
	});

	it('dedents by the common indentation', () => {
		expect(run('dedent', '    a\n      b\n\n    c\n')).toBe('a\n  b\n\nc\n');
		expect(run('dedent', '\t\tx\r\n\t\t\ty')).toBe('x\r\n\ty');
	});
});

describe('encode / decode', () => {
	it('base64 is UTF-8 safe', () => {
		expect(run('base64-encode', 'é')).toBe('w6k=');
		expect(run('base64-encode', '日本')).toBe('5pel5pys');
		expect(run('base64-decode', '5pel5pys')).toBe('日本');
		expect(run('base64-decode', 'aGVs\nbG8=\n')).toBe('hello\n');
		expect(run('base64-decode', 'aGVsbG8')).toBe('hello');
	});

	it('base64 decode accepts base64url and rejects garbage', () => {
		expect(run('base64-decode', run('base64-encode', '??>>').replace(/\+/g, '-'))).toBe('??>>');
		expect(() => run('base64-decode', 'abc$')).toThrow(
			"Invalid base64 character '$' at position 4",
		);
		expect(() => run('base64-decode', 'ab=c')).toThrow('misplaced');
		expect(() => run('base64-decode', '/w==')).toThrow('not valid UTF-8');
	});

	it('URL encodes and decodes', () => {
		expect(run('url-encode', 'a b&c=d/é')).toBe('a%20b%26c%3Dd%2F%C3%A9');
		expect(run('url-decode', 'a%20b+c%C3%A9')).toBe('a b cé');
		expect(() => run('url-decode', 'ok%zz')).toThrow('Invalid URL encoding at position 3');
	});

	it('JSON escapes and unescapes', () => {
		expect(run('json-escape', 'say "hi"\tnow\nnext\n')).toBe('say \\"hi\\"\\tnow\\nnext\n');
		expect(run('json-unescape', 'say \\"hi\\"\\u00e9\\n')).toBe('say "hi"é\n');
		expect(run('json-unescape', '"quoted \\\\ string"')).toBe('quoted \\ string');
		expect(() => run('json-unescape', 'ab\\q')).toThrow("Invalid escape '\\q' at position 3");
		expect(() => run('json-unescape', 'ab\\u12')).toThrow('Invalid \\u escape at position 3');
	});

	it('HTML escapes and unescapes', () => {
		expect(run('html-escape', `<a href="x">&'</a>`)).toBe(
			'&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;',
		);
		expect(run('html-unescape', '&lt;&#39;&#x41;&copy;&bogus;&constructor;')).toBe(
			"<'A©&bogus;&constructor;",
		);
		expect(run('html-unescape', '&#X42;&#0;&#xD800;&#x110000;&#9731;')).toBe(
			'B&#0;&#xD800;&#x110000;☃',
		);
	});

	it('hex round-trips UTF-8 and accepts dump formats', () => {
		expect(run('hex-encode', 'hié')).toBe('6869c3a9');
		expect(run('hex-decode', '68 69 c3 a9')).toBe('hié');
		expect(run('hex-decode', '0x68,0x69')).toBe('hi');
		expect(() => run('hex-decode', '686')).toThrow('odd number');
		expect(() => run('hex-decode', '6g')).toThrow("Invalid hex character 'g'");
	});

	it('unicode escapes as UTF-16 units and unescapes several syntaxes', () => {
		expect(run('unicode-escape', 'café 😀')).toBe('caf\\u00e9 \\ud83d\\ude00');
		expect(run('unicode-unescape', 'caf\\u00e9 \\ud83d\\ude00')).toBe('café 😀');
		expect(run('unicode-unescape', '\\u{1F600}\\U0001F600\\x41')).toBe('😀😀A');
	});
});

describe('code transforms', () => {
	it('wraps in a Python f-string', () => {
		expect(run('python-f-string', '  Total: {total}')).toBe("  f'Total: {total}'");
		expect(run('python-f-string', '"hi {x}"')).toBe('f"hi {x}"');
		expect(run('python-f-string', "it's")).toBe("f'it\\'s'");
		expect(run('python-f-string', "f'done'")).toBe("f'done'");
	});

	it('prints variables with the = specifier', () => {
		expect(run('python-print-vars', '  x\n  df.shape\n')).toBe(
			"  print(f'{x=}')\n  print(f'{df.shape=}')\n",
		);
		expect(run('python-print-vars', 'a, b')).toBe("print(f'{a=}, {b=}')");
		expect(run('python-print-vars', 'total: float = 5')).toBe("print(f'{total=}')");
		expect(run('python-print-vars', "d['k']")).toBe(`print(f"{d['k']=}")`);
	});

	it('builds a Python dict from key: value lines', () => {
		expect(run('python-dict', 'name: btc\nsize: 1.5\nactive: true\nnote:\ntags = [1]')).toBe(
			"{'name': 'btc', 'size': 1.5, 'active': True, 'note': None, 'tags': [1]}",
		);
		const long = Array.from({ length: 8 }, (_, i) => `key_${i}: value_${i}`).join('\n');
		const out = run('python-dict', long).split('\n');
		expect(out[0]).toBe('{');
		expect(out[1]).toBe("    'key_0': 'value_0',");
		expect(out[out.length - 1]).toBe('}');
		expect(() => run('python-dict', 'a: 1\nbroken')).toThrow('Line 2');
	});

	it('sorts Python imports per block, plain imports first', () => {
		const input =
			'import pandas as pd\nfrom os import path\nimport numpy as np\n\nimport b\nimport a\n';
		expect(run('sort-imports', input)).toBe(
			'import numpy as np\nimport pandas as pd\nfrom os import path\n\nimport a\nimport b\n',
		);
	});

	it('keeps multi-line imports together', () => {
		const input = [
			"import { z } from 'zod';",
			'import {',
			'\ta,',
			'\tb,',
			"} from './x';",
			"import React from 'react';",
		].join('\r\n');
		expect(run('sort-imports', input)).toBe(
			[
				'import {',
				'\ta,',
				'\tb,',
				"} from './x';",
				"import React from 'react';",
				"import { z } from 'zod';",
			].join('\r\n'),
		);
		expect(run('sort-imports', 'from b import (\n    x,\n)\nfrom a import y')).toBe(
			'from a import y\nfrom b import (\n    x,\n)',
		);
	});
});
