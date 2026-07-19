import type { DeepSeekModel, ThinkingEffortSpec } from './types';

/**
 * Compile-time constants shared across the extension. These do not depend on
 * the VS Code runtime. For run-time settings reads see `config.ts`.
 */

/** VS Code configuration section prefix for all extension settings. */
export const CONFIG_SECTION = 'deepseek-copilot';

/** Provider vendor id, must match `contributes.languageModelChatProviders`. */
export const VENDOR_ID = 'deepseek';

/** SecretStorage key for the DeepSeek API key. */
export const API_KEY_SECRET = 'deepseek-copilot.apiKey';

/** Memento key tracking whether the welcome walkthrough has been shown. */
export const WELCOME_SHOWN_KEY = 'deepseek-copilot.welcomeShown';

/** Walkthrough contribution id (without the publisher.extension prefix). */
export const WALKTHROUGH_ID = 'deepseekGettingStarted';

/** VS Code's internal LanguageModelChatMessageRole.System (not in @types/vscode). */
export const LANGUAGE_MODEL_CHAT_SYSTEM_ROLE = 3;

/** Default maximum number of tools accepted in one request. */
export const DEFAULT_TOOLS_LIMIT = 128;

/** Base URL for the official DeepSeek OpenAI-compatible API. */
export const DEFAULT_BASE_URL = 'https://api.deepseek.com';

/**
 * Host root for the balance API. Same host as the chat base URL — only the path differs
 * (`/user/balance` vs `/chat/completions`). Resolved at runtime via `resolveUsageHost`.
 */
export const USAGE_HOST = 'https://api.deepseek.com';

/** Path for the DeepSeek user balance endpoint. */
export const BALANCE_PATH = '/user/balance';

/** External URLs the extension links to. */
export const EXTERNAL_URLS = {
	apiKeys: 'https://platform.deepseek.com/api_keys',
	docs: 'https://api-docs.deepseek.com/',
	pricing: 'https://api-docs.deepseek.com/quick_start/pricing',
	topUp: 'https://platform.deepseek.com/usage',
} as const;

export const USAGE_MIN_REFRESH_MINUTES = 1;
export const USAGE_DEFAULT_REFRESH_MINUTES = 5;
export const USAGE_MAX_REFRESH_MINUTES = 1440;
export const USAGE_CACHE_STALE_MS = 60 * 60 * 1000;
export const USAGE_MANUAL_DEBOUNCE_MS = 30 * 1000;
export const USAGE_REQUEST_TIMEOUT_MS = 10_000;

/** Default automatic retries (after the initial attempt) for transient API failures (429 / 5xx). */
export const RETRY_DEFAULT_MAX_RETRIES = 3;
/** Highest value accepted from the `maxRetries` setting. */
export const RETRY_MAX_RETRIES_CEILING = 10;
/** Base delay (ms) for the first retry; doubles each attempt up to RETRY_MAX_DELAY_MS. */
export const RETRY_BASE_DELAY_MS = 1000;
/** Upper bound (ms) for a single backoff sleep, even when Retry-After is larger. */
export const RETRY_MAX_DELAY_MS = 10_000;

/** URI paths handled by this extension (onUri activation). */
export const URI_PATHS = {
	setApiKey: '/setApiKey',
	showLogs: '/showLogs',
} as const;

/** DeepSeek reports both thinking levels through `reasoning_effort: high|max`. */
const DEEPSEEK_EFFORT: ThinkingEffortSpec = { levels: ['none', 'high', 'max'], default: 'high' };

/**
 * Built-in DeepSeek models exposed through the language model provider.
 *
 * Both v4-pro and v4-flash support a 1M context window and dual (thinking/non-thinking)
 * modes. Thinking effort is selectable per-request via the picker (none/high/max).
 */
export const MODELS: DeepSeekModel[] = [
	{
		id: 'deepseek-v4-pro',
		name: 'DeepSeek V4-Pro',
		family: 'deepseek',
		version: 'v4-pro',
		detail: 'Flagship 1.6T MoE model, 1M context',
		maxInputTokens: 1_000_000,
		maxOutputTokens: 384_000,
		capabilities: {
			toolCalling: DEFAULT_TOOLS_LIMIT,
			imageInput: false,
			thinking: true,
			thinkingEffort: DEEPSEEK_EFFORT,
		},
	},
	{
		id: 'deepseek-v4-flash',
		name: 'DeepSeek V4-Flash',
		family: 'deepseek',
		version: 'v4-flash',
		detail: 'Fast, cost-effective 284B MoE model, 1M context',
		maxInputTokens: 1_000_000,
		maxOutputTokens: 384_000,
		capabilities: {
			toolCalling: DEFAULT_TOOLS_LIMIT,
			imageInput: false,
			thinking: true,
			thinkingEffort: DEEPSEEK_EFFORT,
		},
	},
];
