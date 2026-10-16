import { describe, it, expect, vi } from 'vitest';

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

import { UsageClient } from './usage';
import type { DeepSeekBalanceResponse } from './usage';

const HOST = 'https://api.deepseek.com';
const API_KEY = 'sk-test';

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

function okResponse(overrides: Partial<DeepSeekBalanceResponse> = {}): DeepSeekBalanceResponse {
	return {
		is_available: true,
		balance_infos: [
			{
				currency: 'CNY',
				total_balance: '10.50',
				granted_balance: '5.00',
				topped_up_balance: '5.50',
			},
		],
		...overrides,
	};
}

describe('UsageClient.fetchBalance', () => {
	it('parses a successful balance response into an ok snapshot', async () => {
		const fetchImpl = vi.fn(async () => jsonResponse(okResponse())) as unknown as typeof fetch;
		const client = new UsageClient(HOST, fetchImpl);
		const snapshot = await client.fetchBalance(API_KEY);
		expect(snapshot.status).toBe('ok');
		expect(snapshot.balance?.isAvailable).toBe(true);
		expect(snapshot.balance?.balanceInfos).toEqual([
			{
				currency: 'CNY',
				totalBalance: 10.5,
				grantedBalance: 5,
				toppedUpBalance: 5.5,
			},
		]);
		expect(fetchImpl).toHaveBeenCalledWith(
			`${HOST}/user/balance`,
			expect.objectContaining({
				method: 'GET',
				headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' },
			}),
		);
	});

	it('reports no-data when balance_infos is empty', async () => {
		const fetchImpl = vi.fn(async () =>
			jsonResponse({ is_available: true, balance_infos: [] }),
		) as unknown as typeof fetch;
		const client = new UsageClient(HOST, fetchImpl);
		const snapshot = await client.fetchBalance(API_KEY);
		expect(snapshot.status).toBe('no-data');
		expect(snapshot.balance?.balanceInfos).toEqual([]);
	});

	it('returns auth-error on 401', async () => {
		const fetchImpl = vi.fn(async () =>
			jsonResponse({ error: { message: 'Authentication Fails' } }, 401),
		) as unknown as typeof fetch;
		const client = new UsageClient(HOST, fetchImpl);
		const snapshot = await client.fetchBalance(API_KEY);
		expect(snapshot.status).toBe('auth-error');
	});

	it('returns server-error on 500', async () => {
		const fetchImpl = vi.fn(async () => jsonResponse({ error: 'boom' }, 500)) as unknown as typeof fetch;
		const client = new UsageClient(HOST, fetchImpl);
		const snapshot = await client.fetchBalance(API_KEY);
		expect(snapshot.status).toBe('server-error');
	});

	it('returns network-error on transport failure', async () => {
		const fetchImpl = vi.fn(async () => {
			throw new Error('ENOTFOUND api.deepseek.com');
		}) as unknown as typeof fetch;
		const client = new UsageClient(HOST, fetchImpl);
		const snapshot = await client.fetchBalance(API_KEY);
		expect(snapshot.status).toBe('network-error');
	});

	it('handles multiple currencies', async () => {
		const fetchImpl = vi.fn(async () =>
			jsonResponse({
				is_available: true,
				balance_infos: [
					{ currency: 'CNY', total_balance: '10.00' },
					{ currency: 'USD', total_balance: '1.50' },
				],
			}),
		) as unknown as typeof fetch;
		const client = new UsageClient(HOST, fetchImpl);
		const snapshot = await client.fetchBalance(API_KEY);
		expect(snapshot.status).toBe('ok');
		expect(snapshot.balance?.balanceInfos).toHaveLength(2);
		expect(snapshot.balance?.balanceInfos[1]).toMatchObject({ currency: 'USD', totalBalance: 1.5 });
	});

	it('respects a resolver passed at construction (reads live setting each call)', async () => {
		const fetchImpl = vi.fn(async () => jsonResponse(okResponse())) as unknown as typeof fetch;
		let currentHost = HOST;
		const client = new UsageClient(() => currentHost, fetchImpl);
		await client.fetchBalance(API_KEY);
		expect(fetchImpl).toHaveBeenCalledWith(
			`${HOST}/user/balance`,
			expect.anything(),
		);
		// Re-target the client at a new host without reconstructing it.
		currentHost = 'https://proxy.example.com';
		await client.fetchBalance(API_KEY);
		expect(fetchImpl).toHaveBeenLastCalledWith(
			'https://proxy.example.com/user/balance',
			expect.anything(),
		);
	});
});
