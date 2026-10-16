import { t } from '../i18n';
import * as vscode from 'vscode';
import type {
	UsagePanelStrings,
	UsagePricingModelView,
	UsagePricingView,
} from './usage-detail-html';

/**
 * The full set of localized strings the usage panel renders. Built in one place so the status bar
 * (live messages) and the detail panel (gate-failed fallback) share a single source of truth.
 */
export function usagePanelStrings(): UsagePanelStrings {
	return {
		title: t('usage.panel.title'),
		refresh: t('usage.panel.refresh'),
		setKey: t('usage.panel.setKey'),
		offline: t('usage.panel.offline'),
		unavailable: t('usage.panel.unavailable'),
		lastUpdated: t('usage.panel.lastUpdated'),
		balanceSection: t('usage.balance.section'),
		balanceAvailable: t('usage.balance.available'),
		balanceTotal: t('usage.balance.total'),
		balanceGranted: t('usage.balance.granted'),
		balanceToppedUp: t('usage.balance.toppedUp'),
		pricingSection: t('usage.pricing.section'),
		pricingModel: t('usage.pricing.model'),
		pricingOffPeak: t('usage.pricing.offPeak'),
		pricingPeak: t('usage.pricing.peak'),
		pricingInputCacheHit: t('usage.pricing.inputCacheHit'),
		pricingInputCacheMiss: t('usage.pricing.inputCacheMiss'),
		pricingOutput: t('usage.pricing.output'),
		pricingPeakHours: t('usage.pricing.peakHours'),
		pricingRouting: t('usage.pricing.routing'),
		pricingSource: t('usage.pricing.source'),
		status: {
			ok: '',
			loading: t('usage.status.loading'),
			'no-data': t('usage.status.no-data'),
			'auth-error': t('usage.status.auth-error'),
			'network-error': t('usage.status.network-error'),
			'server-error': t('usage.status.server-error'),
		},
	};
}

/** Localized official DeepSeek pricing info for the usage detail panel. */
export function usagePanelPricing(): UsagePricingView {
	return isChineseLocale() ? chinesePricing() : englishPricing();
}

function englishPricing(): UsagePricingView {
	return {
		unit: 'USD / 1M tokens',
		peakHours: 'Mon-Fri 01:00-04:00 and 06:00-10:00 UTC are peak hours.',
		routing:
			'The official English docs still publish Flash pricing under the retired deepseek-v4-flash entry. DeepSeek routes deepseek-v4-flash and deepseek-v4-flash-vision-exp to deepseek-flash for compatibility.',
		source: 'Prices change frequently. Check the official DeepSeek pricing page for the latest values.',
		models: [
			model('deepseek-flash', 'DeepSeek V4.1 Flash', ['$0.007', '$0.22', '$0.66'], ['$0.014', '$0.44', '$1.32']),
			model('deepseek-v4-pro', 'DeepSeek V4-Pro', ['$0.022', '$0.66', '$1.98'], ['$0.044', '$1.32', '$3.96']),
		],
	};
}

function chinesePricing(): UsagePricingView {
	return {
		unit: '人民币 / 百万 tokens',
		peakHours: '高峰时段为北京时间周一至周五 9:00-12:00、14:00-18:00。',
		routing:
			'旧模型名 deepseek-v4-flash 与 deepseek-v4-flash-vision-exp 已下线，当前由 deepseek-flash 提供服务；2026-09-14 12:00 起，deepseek-v4-pro 也将暂时路由到 deepseek-flash。',
		source: '价格变动频繁，请以 DeepSeek 官方价格页的最新公布信息为准。',
		models: [
			model('deepseek-flash', 'DeepSeek V4.1 Flash', ['0.02元', '1元', '4元'], ['0.04元', '2元', '8元']),
			model('deepseek-v4-pro', 'DeepSeek V4-Pro', ['0.15元', '4.5元', '13.5元'], ['0.30元', '9元', '27元']),
		],
	};
}

function model(
	id: string,
	name: string,
	offPeak: [string, string, string],
	peak: [string, string, string],
): UsagePricingModelView {
	return {
		id,
		name,
		offPeak: {
			inputCacheHit: offPeak[0],
			inputCacheMiss: offPeak[1],
			output: offPeak[2],
		},
		peak: {
			inputCacheHit: peak[0],
			inputCacheMiss: peak[1],
			output: peak[2],
		},
	};
}

function isChineseLocale(): boolean {
	return vscode.env.language.toLowerCase().startsWith('zh');
}
