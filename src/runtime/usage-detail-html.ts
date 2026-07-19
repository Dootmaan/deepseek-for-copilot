import type { BalanceInfo, UsageBalance, UsageSnapshot, UsageStatus } from '../types';
import { formatAmount } from './format';

/** Render-ready balance info row (one per currency returned by the API). */
export interface BalanceInfoView {
	currency: string;
	available?: string;
	total?: string;
	granted?: string;
	toppedUp?: string;
}

/** Render-ready account balance section (one row per currency, all amounts pre-formatted). */
export interface UsageBalanceView {
	isAvailable?: boolean;
	rows: BalanceInfoView[];
}

export interface UsagePanelMessage {
	status: UsageStatus;
	balance?: UsageBalanceView;
	lastUpdated?: number;
	offline: boolean;
	theme: 'dark' | 'light';
	strings: UsagePanelStrings;
}

export interface UsagePanelStrings {
	title: string;
	refresh: string;
	setKey: string;
	offline: string;
	unavailable: string;
	lastUpdated: string;
	balanceSection: string;
	balanceAvailable: string;
	balanceTotal: string;
	balanceGranted: string;
	balanceToppedUp: string;
	status: Record<UsageStatus, string>;
}

/**
 * Convert a UsageSnapshot (the bar's effective state) into the render-ready view model that the
 * detail panel bakes into its HTML server-side. Returns null when there is no snapshot to show
 * (gate failed while pane is open). Pure: no VS Code dependency.
 */
export function buildUsageMessage(
	snapshot: UsageSnapshot | null,
	offline: boolean,
	strings: UsagePanelStrings,
	theme: 'dark' | 'light',
): UsagePanelMessage | null {
	if (snapshot === null) {
		return null;
	}
	return {
		status: snapshot.status,
		balance: snapshot.balance ? toBalanceView(snapshot.balance) : undefined,
		lastUpdated: snapshot.status === 'ok' ? snapshot.fetchedAt : undefined,
		offline,
		theme,
		strings,
	};
}

/** Map a {@link UsageBalance} to a {@link UsageBalanceView} with formatted amounts. */
function toBalanceView(balance: UsageBalance): UsageBalanceView {
	return {
		isAvailable: balance.isAvailable,
		rows: balance.balanceInfos.map(toInfoView),
	};
}

function toInfoView(info: BalanceInfo): BalanceInfoView {
	/** DeepSeek's "total_balance" already nets out spent + frozen, so it is the usable amount. */
	const available = info.totalBalance;
	return {
		currency: info.currency,
		available: available !== undefined ? formatAmount(available) : undefined,
		total: info.totalBalance !== undefined ? formatAmount(info.totalBalance) : undefined,
		granted: info.grantedBalance !== undefined ? formatAmount(info.grantedBalance) : undefined,
		toppedUp: info.toppedUpBalance !== undefined ? formatAmount(info.toppedUpBalance) : undefined,
	};
}
