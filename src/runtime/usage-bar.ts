import * as vscode from 'vscode';
import { getBaseUrlOverride, getShowUsageStatusBar, getUsageRefreshIntervalMinutes } from '../config';
import { API_KEY_SECRET, USAGE_CACHE_STALE_MS, USAGE_MANUAL_DEBOUNCE_MS } from '../consts';
import { t } from '../i18n';
import { logger } from '../logger';
import type { IAuthManager, UsageSnapshot } from '../types';
import { isAbortError } from '../client/errors';
import type { IUsageClient } from '../client/usage';
import { buildUsageMessage, type UsagePanelMessage } from './usage-detail-html';
import { UsageDetailPanel } from './usage-detail-panel';
import { formatAmount } from './format';
import { usagePanelStrings } from './usage-strings';

/**
 * Status-bar item showing the DeepSeek account balance. Fetches `GET /user/balance` on the
 * official endpoint (or a custom base URL) and renders the total in the user's currency.
 *
 * Gate: the item shows AND fetches only when no `baseUrl` override is set to a non-DeepSeek host,
 * a key is present, and the user has not opted out via `showUsageStatusBar`. (We still fetch
 * through a custom baseUrl because the `/user/balance` path is the same on DeepSeek-compatible
 * proxies, but hide when no host is configured.)
 */
export class UsageStatusBar implements vscode.Disposable {
	private readonly item: vscode.StatusBarItem;
	private readonly client: IUsageClient;
	private readonly auth: IAuthManager;

	private refreshPromise: Promise<void> | null = null;
	private lastFetchAt = 0;
	private lastOk: UsageSnapshot | null = null;
	private intervalHandle: ReturnType<typeof setInterval> | null = null;
	private controller: AbortController | null = null;
	private readonly _onDidChange = new vscode.EventEmitter<UsagePanelMessage | null>();
	readonly onDidChangeSnapshot = this._onDidChange.event;
	private lastRendered: UsagePanelMessage | null = null;

	constructor(
		context: vscode.ExtensionContext,
		auth: IAuthManager,
		client: IUsageClient,
	) {
		this.auth = auth;
		this.client = client;
		this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
		this.item.command = 'deepseek-copilot.openUsageDetail';
		this.item.name = 'DeepSeek Usage';

		context.subscriptions.push(
			this.item,
			vscode.commands.registerCommand('deepseek-copilot.refreshUsage', () => {
				void this.refresh();
			}),
			vscode.commands.registerCommand('deepseek-copilot.openUsageDetail', () => {
				UsageDetailPanel.createOrShow(context, this);
			}),
			vscode.workspace.onDidChangeConfiguration((event) => {
				if (event.affectsConfiguration('deepseek-copilot')) {
					void this.onConfigOrKeyChange().catch((error) =>
						logger.warn('Usage gate check failed', error),
					);
				}
			}),
			context.secrets.onDidChange((event) => {
				if (event.key === API_KEY_SECRET) {
					void this.onConfigOrKeyChange().catch((error) =>
						logger.warn('Usage gate check failed', error),
					);
				}
			}),
		);

		void this.onConfigOrKeyChange().catch((error) => logger.warn('Usage gate check failed', error));
	}

	/** Manual + interval entry point. Serialized + debounced. */
	refresh(): Promise<void> {
		if (this.refreshPromise) {
			return this.refreshPromise;
		}
		const now = Date.now();
		if (now - this.lastFetchAt < USAGE_MANUAL_DEBOUNCE_MS) {
			return Promise.resolve();
		}
		const refresh = this.runRefresh()
			.catch((error) => logger.warn('Usage refresh failed', error))
			.finally(() => {
				if (this.refreshPromise !== refresh) {
					return;
				}
				this.refreshPromise = null;
			});
		this.refreshPromise = refresh;
		return this.refreshPromise;
	}

	/**
	 * Evaluate the gate, fetch balance, and render the result. Aborts any in-flight fetch.
	 * On gate failure: hide the bar + stop the interval. On fetch error: render a network-error
	 * snapshot (unless the error is an abort, which is expected during cancellation).
	 */
	private async runRefresh(): Promise<void> {
		const gate = await this.evaluateGate();
		if (!gate.passed) {
			this.item.hide();
			this.stopInterval();
			this.lastRendered = null;
			this._onDidChange.fire(null);
			return;
		}
		this.lastFetchAt = Date.now();
		this.render({ status: 'loading', fetchedAt: Date.now() });
		this.controller?.abort();
		const controller = new AbortController();
		this.controller = controller;
		try {
			const snapshot = await this.client.fetchBalance(gate.apiKey, controller.signal);
			if (snapshot.status === 'ok') {
				this.lastOk = snapshot;
			}
			this.render(snapshot);
		} catch (error) {
			if (isAbortError(error)) {
				logger.warn('Usage fetch aborted');
				return;
			}
			logger.warn('Usage fetch threw', error);
			this.render({ status: 'network-error', fetchedAt: Date.now() });
		}
	}

	/**
	 * Decide whether the status bar should be visible. Passes when the user has opted in
	 * (`showUsageStatusBar`) and an API key is present. A custom `baseUrl` override does NOT
	 * hide the bar — the `/user/balance` path is the same on DeepSeek-compatible proxies.
	 */
	private async evaluateGate(): Promise<{ passed: true; apiKey: string } | { passed: false }> {
		void getBaseUrlOverride(); // referenced for change-detection relevance
		if (!getShowUsageStatusBar()) {
			return { passed: false };
		}
		const apiKey = await this.auth.getApiKey();
		if (!apiKey) {
			return { passed: false };
		}
		return { passed: true, apiKey };
	}

	/**
	 * Render a snapshot to the status bar (text + tooltip + background) and fire the panel message.
	 * On network/server error with a fresh cache (< 1h), falls back to the last `ok` snapshot
	 * marked `offline`.
	 */
	private render(snapshot: UsageSnapshot): void {
		const now = Date.now();
		const cacheUsable = this.lastOk && now - this.lastOk.fetchedAt < USAGE_CACHE_STALE_MS;
		let offline = false;

		this.item.backgroundColor = undefined;

		let effective: UsageSnapshot = snapshot;
		if (
			(snapshot.status === 'network-error' || snapshot.status === 'server-error') &&
			cacheUsable
		) {
			effective = { ...this.lastOk! };
			offline = true;
		}

		switch (effective.status) {
			case 'loading':
				this.item.text = '$(pulse) DeepSeek';
				this.item.tooltip = t('usage.status.loading');
				this.item.show();
				this.fireEffective(effective, offline);
				break;
			case 'ok':
				this.renderOkBar(effective, offline);
				break;
			case 'no-data':
				this.item.text = '$(dash) DeepSeek';
				this.item.tooltip = t('usage.status.no-data');
				this.item.show();
				this.fireEffective(effective, offline);
				break;
			case 'auth-error':
				this.item.text = '$(warning) DeepSeek';
				this.item.tooltip = t('usage.status.auth-error');
				this.item.show();
				this.fireEffective(effective, offline);
				break;
			case 'network-error':
			case 'server-error':
				this.item.text = snapshot.status === 'network-error' ? '$(plug) DeepSeek' : '$(warning) DeepSeek';
				this.item.tooltip =
					snapshot.status === 'network-error'
						? t('usage.status.network-error')
						: t('usage.status.server-error');
				this.item.show();
				this.fireEffective(effective, offline);
				break;
		}
	}

	/** Status-bar rendering for the `ok` balance state. */
	private renderOkBar(snapshot: UsageSnapshot, offline: boolean): void {
		const bal = snapshot.balance;
		const primary = bal?.balanceInfos[0];
		const isAvailable = bal?.isAvailable;
		const currency = primary?.currency ?? '';
		const total = primary?.totalBalance;

		if (total !== undefined) {
			this.item.text = t('usage.status.ok.short', currency, formatAmount(total));
		} else {
			this.item.text = '$(wallet) DeepSeek';
		}

		const lines: string[] = [];
		if (bal && primary) {
			if (total !== undefined) {
				lines.push(`${t('usage.balance.available')}: ${currency} ${formatAmount(total)}`);
			}
			if (primary.grantedBalance !== undefined && primary.grantedBalance > 0) {
				lines.push(
					`${t('usage.balance.granted')}: ${currency} ${formatAmount(primary.grantedBalance)}`,
				);
			}
			if (primary.toppedUpBalance !== undefined && primary.toppedUpBalance > 0) {
				lines.push(
					`${t('usage.balance.toppedUp')}: ${currency} ${formatAmount(primary.toppedUpBalance)}`,
				);
			}
			/** Extra rows when the API returns multiple currencies. */
			for (let i = 1; i < bal.balanceInfos.length; i++) {
				const info = bal.balanceInfos[i];
				if (info.totalBalance !== undefined) {
					lines.push(
						`${t('usage.balance.available')} (${info.currency}): ${info.currency} ${formatAmount(info.totalBalance)}`,
					);
				}
			}
			if (isAvailable === false) {
				lines.push(t('usage.tooltip.insufficient'));
			}
		}
		lines.push(t('usage.tooltip.lastUpdated', new Date(snapshot.fetchedAt).toLocaleTimeString()));
		if (offline) {
			lines.push(t('usage.tooltip.offline'));
		}
		this.item.tooltip = lines.join('\n');

		/** Critical: `is_available === false` → error background (cannot make API calls). */
		this.item.backgroundColor =
			isAvailable === false
				? new vscode.ThemeColor('statusBarItem.errorBackground')
				: undefined;
		this.item.show();
		this.fireEffective(snapshot, offline);
	}

	/**
	 * Re-evaluate the gate after settings or the stored key change. Aborts any in-flight fetch,
	 * drops the cached snapshot from the previous key, and bypasses the manual debounce.
	 */
	private async onConfigOrKeyChange(): Promise<void> {
		this.controller?.abort();
		this.refreshPromise = null;
		this.lastOk = null;
		const gate = await this.evaluateGate();
		if (!gate.passed) {
			this.item.hide();
			this.stopInterval();
			this.lastRendered = null;
			this._onDidChange.fire(null);
			return;
		}
		this.stopInterval();
		this.startInterval();
		this.lastFetchAt = 0;
		void this.refresh();
	}

	/** Arm the auto-refresh interval from `getUsageRefreshIntervalMinutes`; replaces any existing handle. */
	private startInterval(): void {
		const minutes = getUsageRefreshIntervalMinutes();
		this.intervalHandle = setInterval(() => {
			void this.refresh();
		}, minutes * 60_000);
	}

	/** Clear the auto-refresh interval if armed. */
	private stopInterval(): void {
		if (this.intervalHandle !== null) {
			clearInterval(this.intervalHandle);
			this.intervalHandle = null;
		}
	}

	/** Dispose the status bar item, abort any in-flight fetch, and stop auto-refresh. */
	dispose(): void {
		this.stopInterval();
		this.controller?.abort();
		this.item.dispose();
		this._onDidChange.dispose();
	}

	/** Latest effective snapshot message (post-cache-fallback), or null before first render / after gate fail. */
	getSnapshot(): UsagePanelMessage | null {
		return this.lastRendered;
	}

	/** Build a UsagePanelMessage from the effective state and fire the emitter + cache it. */
	private fireEffective(snapshot: UsageSnapshot, offline: boolean): void {
		const message = buildUsageMessage(
			snapshot,
			offline,
			usagePanelStrings(),
			currentThemeKind(),
		);
		this.lastRendered = message;
		this._onDidChange.fire(message);
	}
}

/** Map the active VS Code color theme to a light/dark token for the detail panel. */
function currentThemeKind(): 'dark' | 'light' {
	return vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light';
}
