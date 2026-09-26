import { beforeEach, describe, expect, it } from 'vitest';

import { useToolboxStore } from './toolbox-store';

describe('toolbox store', () => {
	beforeEach(() => {
		useToolboxStore.setState({ fields: {} });
	});

	it('keeps each field independently', () => {
		const { setField } = useToolboxStore.getState();
		setField('jwt.token', 'eyJ');
		setField('regex.flags', 'gi');
		setField('encode.direction', null);
		expect(useToolboxStore.getState().fields).toEqual({
			'jwt.token': 'eyJ',
			'regex.flags': 'gi',
			'encode.direction': null,
		});
	});

	it('records a field set to its falsy value as present', () => {
		useToolboxStore.getState().setField('regex.flags', '');
		expect('regex.flags' in useToolboxStore.getState().fields).toBe(true);
	});
});
