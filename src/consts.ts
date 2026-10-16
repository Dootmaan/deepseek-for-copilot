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

/** DeepSeek reasoning effort for the current public chat API. */
const DEEPSEEK_EFFORT: ThinkingEffortSpec = {
	levels: ['none', 'low', 'high', 'max'],
	default: 'high',
};

/** Retired public ids that DeepSeek temporarily routes to the latest flash model. */
export const MODEL_ALIASES: Record<string, string> = {
	'deepseek-v4-flash': 'deepseek-flash',
	'deepseek-v4-flash-vision-exp': 'deepseek-flash',
} as const;

/**
 * Built-in DeepSeek models exposed through the language model provider.
 *
	 * DeepSeek V4.1 Flash is now the primary public flash model and natively supports image input.
	 * The current `deepseek-v4-pro` endpoint remains available and will later be routed to V4.1
	 * Flash by the DeepSeek backend until V4.1 Pro is released.
 */
export const MODELS: DeepSeekModel[] = [
	{
		id: 'deepseek-flash',
		name: 'DeepSeek V4.1 Flash',
		family: 'deepseek',
		version: 'v4.1-flash',
		detail: 'Latest native multimodal model, 1M context',
		maxInputTokens: 1_000_000,
		maxOutputTokens: 384_000,
		capabilities: {
			toolCalling: DEFAULT_TOOLS_LIMIT,
			imageInput: true,
			thinking: true,
			thinkingEffort: DEEPSEEK_EFFORT,
		},
	},
	{
		id: 'deepseek-v4-pro',
		name: 'DeepSeek V4-Pro',
		family: 'deepseek',
		version: 'v4-pro',
		detail: 'Current Pro endpoint, 1M context',
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
