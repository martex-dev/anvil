import { useEffect } from 'react';

import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { toast } from '../../stores/toast-store';

// Module-level so StrictMode's double effect (and remounts) toast each failure only once.
let reported = false;

/** One toast per main-process module that failed to start, naming it and the reason. */
export function useFeatureErrors(): void {
	useEffect(() => {
		if (reported) return;
		reported = true;
		call('app:featureErrors')
			.then((failures) => {
				for (const { id, message } of failures) {
					toast.error(`The ${id} module failed to start`, message);
				}
			})
			.catch((error: unknown) => {
				rlog.error('app', 'could not read module start-up errors', error);
			});
	}, []);
}
