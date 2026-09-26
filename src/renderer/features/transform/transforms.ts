import { CASE_TRANSFORMS } from './case-transforms';
import { CODE_TRANSFORMS } from './code-transforms';
import { ENCODE_TRANSFORMS } from './encode-transforms';
import { LINE_TRANSFORMS } from './line-transforms';
import { type Transform } from './types';

export { splitWords } from './case-transforms';
export type { Transform, TransformGroup } from './types';

/** Every "Transform Selection…" entry, in picker order (grouped). */
export const TRANSFORMS: readonly Transform[] = [
	...CASE_TRANSFORMS,
	...LINE_TRANSFORMS.filter((t) => t.group === 'Lines'),
	...LINE_TRANSFORMS.filter((t) => t.group === 'Clean'),
	...ENCODE_TRANSFORMS.filter((t) => t.group === 'Encode'),
	...ENCODE_TRANSFORMS.filter((t) => t.group === 'Decode'),
	...CODE_TRANSFORMS,
];
