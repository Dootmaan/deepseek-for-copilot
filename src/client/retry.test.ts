import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// retry.ts → ./errors → ../consts + ../i18n → 'vscode'.
// Stub the vscode surface so module resolution + logger calls succeed under vitest.
vi.mock('vscode', () => ({
	workspace: { getConfiguration: () => ({ get: () => undefined }) },
	env: { language: 'en' },
	window: {
		createOutputChannel: () => ({
			info: () => {},
			warn: () => {},
			error: () => {},
			debug: () => {},
			show: () => {},
			dispose: () => {},
		}),
	},
}));

import {
	fetchChatCompletionWithRetry,
	isRetryableStatus,
	parseRetryAfterMs,
	computeBackoffDelay,
} from './retry';
import {
	RETRY_BASE_DELAY_MS,
	RETRY_DEFAULT_MAX_RETRIES,
	RETRY_MAX_DELAY_MS,
} from '../consts';

const URL = 'https://api.deepseek.com/chat/completions';
const INIT: RequestInit = { method: 'POST', headers: {}, body: '{}' };
const BASE_URL = 'https://api.deepseek.com';

function response(status: number, body = '', headers: Record<string, string> = {}): Response {
	return new Response(body, { status, headers });
}

/** Mock fetch that returns `responses` in order, throwing if exhausted. */
function seqFetch(responses: Response[]): typeof fetch {
	let i = 0;
	return vi.fn(async () => {
		if (i >= responses.length) {
			throw new Error(`mock fetch exhausted (requested attempt ${i + 1})`);
		}
		return responses[i++];
	}) as unknown as typeof fetch;
}

function fakeCancellationToken(): {
	token: import('vscode').CancellationToken;
	cancel: () => void;
} {
	const listeners: Array<() => void> = [];
	let cancelled = false;
	const token = {
		get isCancellationRequested(): boolean {
			return cancelled;
		},
		onCancellationRequested(listener: () => void) {
			listeners.push(listener);
			return {
				dispose: () => {
					const idx = listeners.indexOf(listener);
					if (idx >= 0) {
						listeners.splice(idx, 1);
					}
				},
			};
		},
	};
	return {
		token: token as unknown as import('vscode').CancellationToken,
		cancel: () => {
			if (cancelled) {
				return;
			}
			cancelled = true;
			listeners.slice().forEach((listener) => listener());
		},
	};
}

describe('isRetryableStatus', () => {
	it('retries 429 and the 5xx range', () => {
		expect(isRetryableStatus(429)).toBe(true);
		expect(isRetryableStatus(500)).toBe(true);
		expect(isRetryableStatus(502)).toBe(true);
		expect(isRetryableStatus(503)).toBe(true);
		expect(isRetryableStatus(504)).toBe(true);
		expect(isRetryableStatus(529)).toBe(true);
	});

	it('does not retry 4xx client errors or 2xx', () => {
		expect(isRetryableStatus(200)).toBe(false);
		expect(isRetryableStatus(400)).toBe(false);
		expect(isRetryableStatus(401)).toBe(false);
		expect(isRetryableStatus(402)).toBe(false);
		expect(isRetryableStatus(404)).toBe(false);
		expect(isRetryableStatus(422)).toBe(false);
	});
});

describe('parseRetryAfterMs', () => {
	it('reads retry-after-ms (milliseconds) first', () => {
		expect(parseRetryAfterMs(new Headers({ 'retry-after-ms': '750' }))).toBe(750);
	});

	it('falls back to Retry-After delta-seconds', () => {
		expect(parseRetryAfterMs(new Headers({ 'retry-after': '2' }))).toBe(2000);
	});

	it('parses Retry-After as an HTTP date', () => {
		const date = new Date(Date.now() + 5000).toUTCString();
		const ms = parseRetryAfterMs(new Headers({ 'retry-after': date }));
		expect(ms).toBeGreaterThan(3000);
		expect(ms).toBeLessThanOrEqual(5000);
	});

	it('returns undefined when no header is present', () => {
		expect(parseRetryAfterMs(new Headers())).toBeUndefined();
	});

	it('ignores non-numeric Retry-After values', () => {
		expect(parseRetryAfterMs(new Headers({ 'retry-after': 'not-a-date' }))).toBeUndefined();
	});
});

describe('computeBackoffDelay', () => {
	it('uses the retry-after value when present', () => {
		expect(computeBackoffDelay(0, 250)).toBe(250);
		expect(computeBackoffDelay(3, 8000)).toBe(8000);
	});

	it('starts at RETRY_BASE_DELAY_MS and grows exponentially (until the cap)', () => {
		// Attempt 3 → base 8s, still under the 10s cap, so ±20% jitter window holds.
		for (let attempt = 0; attempt <= 3; attempt++) {
			const delay = computeBackoffDelay(attempt);
			const expectedBase = RETRY_BASE_DELAY_MS * 2 ** attempt;
			expect(delay).toBeGreaterThanOrEqual(Math.round(expectedBase * 0.8));
			expect(delay).toBeLessThanOrEqual(Math.round(expectedBase * 1.2));
			expect(delay).toBeLessThanOrEqual(RETRY_MAX_DELAY_MS);
		}
	});

	it('never exceeds RETRY_MAX_DELAY_MS', () => {
		// At attempt 20 the raw value would be 1s * 2^20 ≈ 12 days. Cap must clamp it.
		expect(computeBackoffDelay(20)).toBeLessThanOrEqual(RETRY_MAX_DELAY_MS);
		expect(computeBackoffDelay(20)).toBe(RETRY_MAX_DELAY_MS);
	});
});

describe('fetchChatCompletionWithRetry', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('returns the response on the first success', async () => {
		const ok = response(200, '{"id":"x"}');
		const fetchImpl = seqFetch([ok]);
		const result = await fetchChatCompletionWithRetry(URL, INIT, {
			baseUrl: BASE_URL,
			maxRetries: RETRY_DEFAULT_MAX_RETRIES,
			fetchImpl,
		});
		expect(result).toBe(ok);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it('retries on 429 then succeeds', async () => {
		const ok = response(200);
		const fetchImpl = seqFetch([response(429), response(429), ok]);
		const onRetryBackoff = vi.fn();
		const promise = fetchChatCompletionWithRetry(URL, INIT, {
			baseUrl: BASE_URL,
			maxRetries: 5,
			fetchImpl,
			onRetryBackoff,
		});
		promise.catch(() => {});
		await vi.runAllTimersAsync();
		const result = await promise;
		expect(result).toBe(ok);
		expect(fetchImpl).toHaveBeenCalledTimes(3);
		expect(onRetryBackoff).toHaveBeenCalledTimes(2);
		expect(onRetryBackoff).toHaveBeenLastCalledWith(
			expect.objectContaining({ status: 429, nextAttempt: 3, maxAttempts: 6 }),
		);
	});

	it('throws DeepSeekRequestError on a non-retryable status', async () => {
		const fetchImpl = seqFetch([response(401, '{"error":{"message":"bad key"}}')]);
		await expect(
			fetchChatCompletionWithRetry(URL, INIT, {
				baseUrl: BASE_URL,
				maxRetries: RETRY_DEFAULT_MAX_RETRIES,
				fetchImpl,
			}),
		).rejects.toMatchObject({
			name: 'DeepSeekRequestError',
			status: 401,
			kind: 'http',
		});
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it('throws DeepSeekRequestError after exhausting retries on persistent 5xx', async () => {
		const fetchImpl = seqFetch([
			response(503),
			response(503),
			response(503),
		]);
		const promise = fetchChatCompletionWithRetry(URL, INIT, {
			baseUrl: BASE_URL,
			maxRetries: 2,
			fetchImpl,
		});
		// Attach a handler before flushing timers so the rejection isn't reported as unhandled.
		promise.catch(() => {});
		await vi.runAllTimersAsync();
		await expect(promise).rejects.toMatchObject({
			name: 'DeepSeekRequestError',
			status: 503,
			kind: 'http',
		});
		expect(fetchImpl).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
	});

	it('honors cancellation during a backoff sleep', async () => {
		const fetchImpl = seqFetch([response(429), response(200)]);
		const { token, cancel } = fakeCancellationToken();
		const promise = fetchChatCompletionWithRetry(URL, INIT, {
			baseUrl: BASE_URL,
			maxRetries: 5,
			fetchImpl,
			cancellationToken: token,
		});
		// Cancel before timers advance; the sleeping retry should reject with AbortError.
		queueMicrotask(cancel);
		await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});
});
