import { BALANCE_PATH, USAGE_REQUEST_TIMEOUT_MS } from '../consts';
import type { BalanceInfo, UsageBalance, UsageSnapshot, UsageStatus } from '../types';
import { createHttpError, isAbortError, normalizeRequestError } from './errors';

/** DeepSeek `/user/balance` response shape. */
export interface DeepSeekBalanceResponse {
	/** Whether the user's balance is sufficient for API calls. */
	is_available?: boolean;
	/** Per-currency balance breakdown (usually a single entry). */
	balance_infos?: Array<{
		currency?: string;
		total_balance?: string;
		granted_balance?: string;
		topped_up_balance?: string;
	}>;
}

/** Contract for the balance client used by {@link UsageStatusBar}. */
export interface IUsageClient {
	/** Fetch account balance (cash + breakdown) as a {@link UsageSnapshot}. */
	fetchBalance(apiKey: string, signal?: AbortSignal): Promise<UsageSnapshot>;
}

/**
 * DeepSeek balance client. Calls `GET /user/balance` on the official endpoint (or a
 * custom base URL when configured). The host is resolved on EVERY call via `resolveHost`
 * (which reads the live `baseUrl` setting), so the bar follows setting changes without
 * recreating the client. A static string is accepted (normalized to a constant resolver)
 * for convenience in tests.
 */
export class UsageClient implements IUsageClient {
	private readonly resolveHost: () => string;

	constructor(
		hostOrResolver: string | (() => string),
		private readonly fetchImpl: typeof fetch = fetch,
	) {
		this.resolveHost = typeof hostOrResolver === 'string' ? () => hostOrResolver : hostOrResolver;
	}

	async fetchBalance(apiKey: string, signal?: AbortSignal): Promise<UsageSnapshot> {
		const host = this.resolveHost();
		const fetchedAt = Date.now();
		const url = `${host}${BALANCE_PATH}`;
		let response: Response;
		try {
			response = await this.fetchImpl(url, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					Accept: 'application/json',
				},
				signal,
			});
		} catch (error) {
			if (isAbortError(error)) {
				throw error;
			}
			const normalized = normalizeRequestError(error, { baseUrl: host });
			return this.toErrorSnapshot(normalized, fetchedAt);
		}
		if (!response.ok) {
			if (response.status === 401 || response.status === 403) {
				return { status: 'auth-error', balance: undefined, fetchedAt };
			}
			if (response.status >= 500 && response.status <= 599) {
				return { status: 'server-error', balance: undefined, fetchedAt };
			}
			const error = await createHttpError(response, { baseUrl: host });
			return this.toErrorSnapshot(error, fetchedAt);
		}
		let parsed: DeepSeekBalanceResponse;
		try {
			parsed = (await response.json()) as DeepSeekBalanceResponse;
		} catch (error) {
			if (isAbortError(error)) {
				throw error;
			}
			const normalized = normalizeRequestError(error, { baseUrl: host });
			return this.toErrorSnapshot(normalized, fetchedAt);
		}
		const balance = mapBalance(parsed);
		if (balance.balanceInfos.length === 0) {
			return { status: 'no-data', balance, fetchedAt };
		}
		return { status: 'ok', balance, fetchedAt };
	}

	private toErrorSnapshot(error: unknown, fetchedAt: number): UsageSnapshot {
		const status = errorStatus(error);
		return { status, balance: undefined, fetchedAt };
	}
}

/** Map the DeepSeek balance response to a {@link UsageBalance}. */
function mapBalance(parsed: DeepSeekBalanceResponse): UsageBalance {
	const infos: BalanceInfo[] = (parsed.balance_infos ?? [])
		.map((raw) => ({
			currency: raw.currency ?? 'CNY',
			totalBalance: finiteOr(raw.total_balance),
			grantedBalance: finiteOr(raw.granted_balance),
			toppedUpBalance: finiteOr(raw.topped_up_balance),
		}))
		.filter((info) => info.totalBalance !== undefined);
	return {
		isAvailable: parsed.is_available,
		balanceInfos: infos,
	};
}

function finiteOr(value: string | undefined): number | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}
	const n = Number(value);
	return Number.isFinite(n) ? n : undefined;
}

function errorStatus(error: unknown): UsageStatus {
	if (error instanceof Error) {
		if (isAbortError(error)) {
			throw error;
		}
		// DeepSeekRequestError exposes `kind`; network errors are network-error, otherwise server.
		const kind = (error as { kind?: string }).kind;
		if (kind === 'network') {
			return 'network-error';
		}
		const status = (error as { status?: number }).status;
		if (status === 401 || status === 403) {
			return 'auth-error';
		}
		if (status !== undefined && status >= 500 && status <= 599) {
			return 'server-error';
		}
	}
	return 'server-error';
}

/** Re-exported for callers that want to read the configured timeout. */
export const USAGE_TIMEOUT_MS = USAGE_REQUEST_TIMEOUT_MS;
