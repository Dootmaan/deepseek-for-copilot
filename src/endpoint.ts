import { DEFAULT_BASE_URL, USAGE_HOST } from './consts';
import { getBaseUrlOverride } from './config';

/** Trim and strip trailing slashes from a URL. */
export function normalizeBaseUrl(url: string): string {
	return url.trim().replace(/\/+$/, '');
}

/**
 * Resolve the chat-completions base URL from settings.
 * Override wins; otherwise the official DeepSeek endpoint is used.
 */
export function resolveBaseUrl(): string {
	const override = getBaseUrlOverride();
	return override ? normalizeBaseUrl(override) : DEFAULT_BASE_URL;
}

/**
 * Resolve the host for the balance API. Same host as chat (DeepSeek serves `/user/balance`
 * on `api.deepseek.com`), unless a custom base URL is set — in which case the balance request
 * also goes through that host so self-hosted proxies can intercept it.
 */
export function resolveUsageHost(): string {
	const override = getBaseUrlOverride();
	return override ? normalizeBaseUrl(override) : USAGE_HOST;
}
