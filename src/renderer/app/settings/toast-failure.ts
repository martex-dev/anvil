import { describeError } from '../../lib/global-errors';
import { toast } from '../../stores/toast-store';

/** A `.catch` handler that shows a failed settings action as an error toast. */
export function toastFailure(title: string): (error: unknown) => void {
	return (error) => {
		toast.error(title, describeError(error));
	};
}
