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

import { buildUsageMessage } from './usage-detail-html';
import { usagePanelStrings } from './usage-strings';
import type { UsageSnapshot } from '../types';

describe('buildUsageMessage', () => {
	it('returns null when snapshot is null (gate failed)', () => {
		expect(buildUsageMessage(null, false, usagePanelStrings(), 'dark')).toBeNull();
	});

	it('maps an ok snapshot with one currency into a single balance row', () => {
		const snapshot: UsageSnapshot = {
			status: 'ok',
			fetchedAt: 1_700_000_000_000,
			balance: {
				isAvailable: true,
				balanceInfos: [
					{
						currency: 'CNY',
						totalBalance: 10.5,
						grantedBalance: 5,
						toppedUpBalance: 5.5,
					},
				],
			},
		};
		const msg = buildUsageMessage(snapshot, false, usagePanelStrings(), 'dark');
		expect(msg?.status).toBe('ok');
		expect(msg?.balance?.isAvailable).toBe(true);
		expect(msg?.balance?.rows).toEqual([
			{
				currency: 'CNY',
				available: '10.5',
				total: '10.5',
				granted: '5',
				toppedUp: '5.5',
			},
		]);
	});

	it('formats amounts without trailing zeros', () => {
		const snapshot: UsageSnapshot = {
			status: 'ok',
			fetchedAt: 1,
			balance: {
				isAvailable: true,
				balanceInfos: [{ currency: 'USD', totalBalance: 12.0, grantedBalance: 0.5 }],
			},
		};
		const msg = buildUsageMessage(snapshot, false, usagePanelStrings(), 'dark');
		expect(msg?.balance?.rows[0]).toMatchObject({ available: '12', granted: '0.5' });
	});

	it('carries the offline flag and theme through', () => {
		const snapshot: UsageSnapshot = {
			status: 'ok',
			fetchedAt: 1,
			balance: { isAvailable: true, balanceInfos: [{ currency: 'CNY', totalBalance: 1 }] },
		};
		const msg = buildUsageMessage(snapshot, true, usagePanelStrings(), 'light');
		expect(msg?.offline).toBe(true);
		expect(msg?.theme).toBe('light');
	});
});
