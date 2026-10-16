import { describe, it, expect, vi } from 'vitest';

const vscodeState = vi.hoisted(() => ({ language: 'en' }));

vi.mock('vscode', () => ({
	workspace: { getConfiguration: () => ({ get: () => undefined }) },
	env: {
		get language() {
			return vscodeState.language;
		},
	},
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
import { usagePanelPricing, usagePanelStrings } from './usage-strings';
import type { UsageSnapshot } from '../types';

describe('buildUsageMessage', () => {
	it('returns null when snapshot is null (gate failed)', () => {
		expect(buildUsageMessage(null, false, usagePanelStrings(), usagePanelPricing(), 'dark')).toBeNull();
	});

	it('maps an ok snapshot with one currency into a single balance row', () => {
		vscodeState.language = 'en';
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
		const msg = buildUsageMessage(snapshot, false, usagePanelStrings(), usagePanelPricing(), 'dark');
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
		vscodeState.language = 'en';
		const snapshot: UsageSnapshot = {
			status: 'ok',
			fetchedAt: 1,
			balance: {
				isAvailable: true,
				balanceInfos: [{ currency: 'USD', totalBalance: 12.0, grantedBalance: 0.5 }],
			},
		};
		const msg = buildUsageMessage(snapshot, false, usagePanelStrings(), usagePanelPricing(), 'dark');
		expect(msg?.balance?.rows[0]).toMatchObject({ available: '12', granted: '0.5' });
	});

	it('carries the offline flag and theme through', () => {
		vscodeState.language = 'en';
		const snapshot: UsageSnapshot = {
			status: 'ok',
			fetchedAt: 1,
			balance: { isAvailable: true, balanceInfos: [{ currency: 'CNY', totalBalance: 1 }] },
		};
		const msg = buildUsageMessage(snapshot, true, usagePanelStrings(), usagePanelPricing(), 'light');
		expect(msg?.offline).toBe(true);
		expect(msg?.theme).toBe('light');
	});

	it('includes USD pricing for English locale', () => {
		vscodeState.language = 'en';
		const snapshot: UsageSnapshot = {
			status: 'ok',
			fetchedAt: 1,
			balance: { isAvailable: true, balanceInfos: [{ currency: 'USD', totalBalance: 1 }] },
		};
		const msg = buildUsageMessage(snapshot, false, usagePanelStrings(), usagePanelPricing(), 'dark');
		expect(msg?.pricing.unit).toBe('USD / 1M tokens');
		expect(msg?.pricing.models[0]).toMatchObject({
			id: 'deepseek-flash',
			offPeak: { inputCacheHit: '$0.007', inputCacheMiss: '$0.22', output: '$0.66' },
			peak: { inputCacheHit: '$0.014', inputCacheMiss: '$0.44', output: '$1.32' },
		});
	});

	it('includes CNY pricing for Chinese locale', () => {
		vscodeState.language = 'zh-cn';
		const snapshot: UsageSnapshot = {
			status: 'ok',
			fetchedAt: 1,
			balance: { isAvailable: true, balanceInfos: [{ currency: 'CNY', totalBalance: 1 }] },
		};
		const msg = buildUsageMessage(snapshot, false, usagePanelStrings(), usagePanelPricing(), 'dark');
		expect(msg?.pricing.unit).toBe('人民币 / 百万 tokens');
		expect(msg?.pricing.models[0]).toMatchObject({
			id: 'deepseek-flash',
			offPeak: { inputCacheHit: '0.02元', inputCacheMiss: '1元', output: '4元' },
			peak: { inputCacheHit: '0.04元', inputCacheMiss: '2元', output: '8元' },
		});
	});
});
