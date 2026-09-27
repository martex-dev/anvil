import { describe, expect, it } from 'vitest';

import { parseDotEnv } from './dotenv';

describe('parseDotEnv', () => {
	it('reads plain, exported, quoted and commented lines', () => {
		const env = parseDotEnv(
			[
				'# exchange keys',
				'API_KEY=abc123',
				'export REGION = eu-west-1',
				"LITERAL='keep ${API_KEY} as is'",
				'DOUBLE="line1\\nline2"',
				'WITH_COMMENT=value # trailing note',
				'HASH_IN_VALUE=a#b',
				'EMPTY=',
				'not a line',
				'=nokey',
			].join('\n'),
		);
		expect(env).toEqual({
			API_KEY: 'abc123',
			REGION: 'eu-west-1',
			LITERAL: 'keep ${API_KEY} as is',
			DOUBLE: 'line1\nline2',
			WITH_COMMENT: 'value',
			HASH_IN_VALUE: 'a#b',
			EMPTY: '',
		});
	});

	it('expands ${VAR} from earlier keys, then from the base environment', () => {
		const env = parseDotEnv('ROOT=/data\nPRICES=${ROOT}/prices\nHOME_DIR=${HOME}', {
			HOME: 'C:\\Users\\me',
		});
		expect(env['PRICES']).toBe('/data/prices');
		expect(env['HOME_DIR']).toBe('C:\\Users\\me');
	});

	it('handles CRLF, a BOM and a double-quoted value spanning lines', () => {
		const env = parseDotEnv('\uFEFFA=1\r\nPEM="-----BEGIN-----\nabc\n-----END-----"\r\nB=2');
		expect(env).toEqual({ A: '1', PEM: '-----BEGIN-----\nabc\n-----END-----', B: '2' });
	});
});
