import { ShieldAlert } from 'lucide-react';
import { type JSX, useMemo, useState } from 'react';

import { Badge } from '../../ui/Badge';
import { CodeBlock } from './CodeBlock';
import { Field } from './Field';
import { attempt } from './format';
import { ResultRow } from './ResultRow';
import { TextArea } from './TextArea';
import { formatRelative } from './time';
import { ToolError } from './ToolError';
import { type DecodedJwt, decodeJwt } from './tools';
import { useNow } from './use-now';

function ExpiryBadge({ jwt }: { jwt: DecodedJwt }): JSX.Element {
	if (jwt.expired === null) return <Badge>No exp claim</Badge>;
	return jwt.expired ? <Badge tone='down'>Expired</Badge> : <Badge tone='up'>Not expired</Badge>;
}

export function JwtTool(): JSX.Element {
	const [token, setToken] = useState('');
	const filled = token.trim() !== '';
	const result = useMemo(
		() => (filled ? attempt(() => decodeJwt(token)) : null),
		[filled, token],
	);
	const now = useNow(Boolean(result?.ok && result.value.expiresAt));

	return (
		<div className='flex flex-col gap-3'>
			<Field label='Token'>
				<TextArea
					aria-label='JWT'
					placeholder='eyJhbGciOi…'
					rows={5}
					value={token}
					onChange={(e) => setToken(e.target.value)}
					className='break-all'
				/>
			</Field>
			<p className='flex items-start gap-1.5 text-11 text-warn'>
				<ShieldAlert size={12} className='mt-px shrink-0' aria-hidden />
				Decoded only: the signature is not verified, so treat the claims as untrusted.
			</p>
			{result && !result.ok && <ToolError message={result.error} />}
			{result?.ok && (
				<>
					<div className='flex flex-col gap-0.5'>
						<div className='mb-1'>
							<ExpiryBadge jwt={result.value} />
						</div>
						{result.value.expiresAt && (
							<>
								<ResultRow label='Expires (UTC)' value={result.value.expiresAt} />
								<ResultRow
									label='Relative'
									mono={false}
									value={formatRelative(Date.parse(result.value.expiresAt), now)}
								/>
							</>
						)}
					</div>
					<div className='flex flex-col gap-1'>
						<span className='hud'>Header</span>
						<CodeBlock
							value={JSON.stringify(result.value.header, null, 2)}
							label='header'
						/>
					</div>
					<div className='flex flex-col gap-1'>
						<span className='hud'>Payload</span>
						<CodeBlock
							value={JSON.stringify(result.value.payload, null, 2)}
							label='payload'
						/>
					</div>
				</>
			)}
		</div>
	);
}
