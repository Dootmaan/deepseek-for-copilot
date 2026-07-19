import * as vscode from 'vscode';
import {
	CONFIG_SECTION,
	DEFAULT_BASE_URL,
	DEFAULT_TOOLS_LIMIT,
	MODELS,
	RETRY_DEFAULT_MAX_RETRIES,
	RETRY_MAX_RETRIES_CEILING,
	USAGE_DEFAULT_REFRESH_MINUTES,
	USAGE_MAX_REFRESH_MINUTES,
	USAGE_MIN_REFRESH_MINUTES,
} from './consts';
import type { CustomModelConfig, DeepSeekModel } from './types';

/** Read the `deepseek-copilot` configuration section. */
function cfg(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(CONFIG_SECTION);
}

/** User-supplied base URL override (empty = use the official DeepSeek endpoint). */
export function getBaseUrlOverride(): string {
	return (cfg().get<string>('baseUrl', '') ?? '').trim();
}

/** Output-token cap, or `undefined` when unset (use the API default). */
export function getMaxTokens(): number | undefined {
	const value = cfg().get<number>('maxTokens', 0);
	return value && value > 0 ? value : undefined;
}

/** Map of picker model id → API model id overrides (for proxy naming differences). */
export function getModelIdOverrides(): Record<string, string> {
	return cfg().get<Record<string, string>>('modelIdOverrides', {}) ?? {};
}

/** Resolve the API model id sent for a VS Code model id (override → id). */
export function getApiModelId(modelId: string): string {
	const override = getModelIdOverrides()[modelId];
	return override && override.trim() ? override.trim() : modelId;
}

/** Whether verbose debug logging is enabled (DeepSeek output channel). */
export function getDebugLogging(): boolean {
	return cfg().get<boolean>('debugLogging', false);
}

/** Settings-based fallback API key (less secure; for CI/automation). */
export function getSettingsApiKey(): string {
	return (cfg().get<string>('apiKey', '') ?? '').trim();
}

/** User-defined models from the `customModels` setting, normalized to DeepSeekModel. */
export function getCustomModels(): DeepSeekModel[] {
	const raw = cfg().get<Array<string | CustomModelConfig>>('customModels', []) ?? [];
	const models: DeepSeekModel[] = [];
	for (const entry of raw) {
		const config: CustomModelConfig = typeof entry === 'string' ? { id: entry } : entry;
		const id = (config.id ?? '').trim();
		if (!id) {
			continue;
		}
		models.push({
			id,
			name: config.name?.trim() || id,
			family: 'deepseek',
			version: 'custom',
			detail: 'Custom model',
			maxInputTokens: config.maxInputTokens ?? 1_000_000,
			maxOutputTokens: config.maxOutputTokens ?? 384_000,
			capabilities: {
				toolCalling: config.toolCalling === false ? false : DEFAULT_TOOLS_LIMIT,
				imageInput: config.vision === true,
				thinking: config.thinking !== false,
			},
		});
	}
	return models;
}

/**
 * Models to show in the picker: all built-ins plus custom models. Custom ids win over built-ins.
 *
 * DeepSeek has a single OpenAI-compatible base URL regardless of region, so we do not filter
 * built-ins by region/apiMode (unlike GLM). A custom `baseUrl` override simply routes all
 * requests to that proxy; it does not change which models are available.
 */
export function listProviderModels(): DeepSeekModel[] {
	const customModels = getCustomModels();
	const customIds = new Set(customModels.map((model) => model.id));
	const builtins = MODELS.filter((model) => !customIds.has(model.id));
	return [...builtins, ...customModels];
}

/** Find a model definition by id, searching custom models then built-ins. */
export function findModelDefinition(id: string): DeepSeekModel | undefined {
	return (
		getCustomModels().find((model) => model.id === id) ??
		MODELS.find((model) => model.id === id)
	);
}

/** Status-bar usage refresh interval in minutes (clamped to the allowed range). */
export function getUsageRefreshIntervalMinutes(): number {
	const value = cfg().get<number>('usageRefreshIntervalMinutes', USAGE_DEFAULT_REFRESH_MINUTES);
	return Math.min(USAGE_MAX_REFRESH_MINUTES, Math.max(USAGE_MIN_REFRESH_MINUTES, value));
}

/** Whether the usage status-bar item should be shown. */
export function getShowUsageStatusBar(): boolean {
	return cfg().get<boolean>('showUsageStatusBar', true);
}

/** Automatic retries for transient chat failures (0 disables), clamped to 0–RETRY_MAX_RETRIES_CEILING. */
export function getMaxRetries(): number {
	const value = cfg().get<number>('maxRetries', RETRY_DEFAULT_MAX_RETRIES);
	return Math.min(RETRY_MAX_RETRIES_CEILING, Math.max(0, Math.floor(value)));
}

/** Resolve the active base URL (override → official endpoint). Exposed for tests. */
export function resolveActiveBaseUrl(): string {
	const override = getBaseUrlOverride();
	return override ? override : DEFAULT_BASE_URL;
}
