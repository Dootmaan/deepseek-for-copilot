import { t } from '../i18n';
import type { UsagePanelStrings } from './usage-detail-html';

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
