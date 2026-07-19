import type * as vscode from 'vscode';

/** Toggle for DeepSeek thinking mode (chain-of-thought before answering). */
export type ThinkingMode = 'enabled' | 'disabled';

/** DeepSeek reasoning effort levels (the OpenAI-compatible `reasoning_effort` field). */
export type ThinkingEffort = 'none' | 'high' | 'max';

/** Picker spec describing how thinking-effort selection is presented. */
export interface ThinkingEffortSpec {
	/** Levels shown in the picker, in order. */
	levels: ThinkingEffort[];
	/** Level used when the user has not chosen one. */
	default: ThinkingEffort;
}

export interface DeepSeekModelCapabilities {
	/** `true` enables tool calling with the default cap; a number sets a custom cap. */
	toolCalling: number | boolean;
	imageInput: boolean;
	thinking: boolean;
	/** Present ⇒ model supports thinking-effort selection. Absent ⇒ binary thinking only. */
	thinkingEffort?: ThinkingEffortSpec;
}

/** A DeepSeek model exposed in the Copilot Chat picker. */
export interface DeepSeekModel {
	id: string;
	name: string;
	family: string;
	version: string;
	detail: string;
	maxInputTokens: number;
	maxOutputTokens: number;
	capabilities: DeepSeekModelCapabilities;
}

/** A user-defined model from the `customModels` setting (string id or object). */
export interface CustomModelConfig {
	id: string;
	name?: string;
	maxInputTokens?: number;
	maxOutputTokens?: number;
	toolCalling?: boolean;
	vision?: boolean;
	thinking?: boolean;
}

// ---- Usage tracking (DeepSeek pay-as-you-go balance) ----

/** A single balance info entry from the DeepSeek `/user/balance` API. */
export interface BalanceInfo {
	/** Currency symbol (e.g. `CNY`, `USD`). */
	currency: string;
	/** Total balance (granted + topped-up). */
	totalBalance?: number;
	/** Granted / promotional balance. */
	grantedBalance?: number;
	/** Topped-up balance. */
	toppedUpBalance?: number;
}

/** Whether the user's balance is sufficient for API calls + the breakdown by wallet. */
export interface UsageBalance {
	/** Mirrors the `is_available` field from the API. */
	isAvailable?: boolean;
	balanceInfos: BalanceInfo[];
}

export type UsageStatus =
	| 'ok'
	| 'no-data'
	| 'auth-error'
	| 'network-error'
	| 'server-error'
	| 'loading';

export interface UsageSnapshot {
	status: UsageStatus;
	balance?: UsageBalance;
	/** Epoch-ms of the fetch that produced this snapshot. */
	fetchedAt: number;
}

// ---- OpenAI-compatible wire types ----

export interface DeepSeekToolFunction {
	name: string;
	description?: string;
	parameters?: unknown;
}

export interface DeepSeekTool {
	type: 'function';
	function: DeepSeekToolFunction;
}

export interface DeepSeekToolCall {
	id: string;
	type: 'function';
	function: { name: string; arguments: string };
}

export interface DeepSeekMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string;
	tool_calls?: DeepSeekToolCall[];
	tool_call_id?: string;
	reasoning_content?: string;
}

export interface DeepSeekChatRequest {
	model: string;
	messages: DeepSeekMessage[];
	stream: boolean;
	tools?: DeepSeekTool[];
	tool_choice?: 'auto' | 'none';
	max_tokens?: number;
	thinking?: { type: ThinkingMode };
	reasoning_effort?: Exclude<ThinkingEffort, 'none'>;
	stream_options?: { include_usage: boolean };
}

export interface DeepSeekUsage {
	prompt_tokens?: number;
	completion_tokens?: number;
	total_tokens?: number;
	/** DeepSeek flat `prompt_cache_hit_tokens` + `prompt_cache_miss_tokens`. */
	prompt_cache_hit_tokens?: number;
	prompt_cache_miss_tokens?: number;
	/** DeepSeek returns reasoning tokens separately (thinking output). */
	completion_tokens_details?: { reasoning_tokens?: number };
}

// ---- Streaming delta shapes ----

export interface DeepSeekDeltaToolCall {
	index: number;
	id?: string;
	type?: 'function';
	function?: { name?: string; arguments?: string };
}

export interface DeepSeekDelta {
	content?: string;
	reasoning_content?: string;
	tool_calls?: DeepSeekDeltaToolCall[];
}

export interface DeepSeekChoice {
	delta?: DeepSeekDelta;
	finish_reason?: string | null;
}

export interface DeepSeekStreamChunk {
	choices?: DeepSeekChoice[];
	usage?: DeepSeekUsage;
}

// ---- Callback + collaborator contracts ----

export interface RetryBackoffInfo {
	status: number;
	nextAttempt: number;
	maxAttempts: number;
	delayMs: number;
}

export interface StreamCallbacks {
	onContent: (content: string) => void;
	onThinking: (text: string) => void;
	onToolCall: (toolCall: DeepSeekToolCall) => void;
	onUsage?: (usage: DeepSeekUsage) => void;
	onRetryBackoff?: (info: RetryBackoffInfo) => void;
	onDone: () => void;
	onError: (error: Error) => void;
}

/** Auth manager contract used by the provider + usage bar. */
export interface IAuthManager {
	getApiKey(): Promise<string | undefined>;
	hasApiKey(): Promise<boolean>;
	promptForApiKey(): Promise<boolean>;
	deleteApiKey(): Promise<void>;
}

/** Client contract used by the provider. */
export interface IDeepSeekClient {
	streamChatCompletion(
		request: DeepSeekChatRequest,
		callbacks: StreamCallbacks,
		cancellationToken?: vscode.CancellationToken,
	): Promise<void>;
}
