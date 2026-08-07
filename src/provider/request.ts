import * as vscode from 'vscode';
import { DeepSeekClient } from '../client';
import { findModelDefinition, getApiModelId, getMaxRetries, getMaxTokens } from '../config';
import { DEFAULT_TOOLS_LIMIT } from '../consts';
import { resolveBaseUrl } from '../endpoint';
import { t } from '../i18n';
import type {
	DeepSeekChatRequest,
	DeepSeekTool,
	IAuthManager,
	IDeepSeekClient,
	ThinkingEffort,
	ThinkingEffortSpec,
	ThinkingMode,
} from '../types';
import { convertMessages, convertTools, countMessageChars } from './convert';

interface PrepareChatRequestArgs {
	authManager: IAuthManager;
	extensionVersion: string;
	modelInfo: vscode.LanguageModelChatInformation;
	messages: readonly vscode.LanguageModelChatRequestMessage[];
	options: vscode.ProvideLanguageModelChatResponseOptions;
	token: vscode.CancellationToken;
}

export interface PreparedChatRequest {
	client: IDeepSeekClient;
	request: DeepSeekChatRequest;
	totalRequestChars: number;
	isThinkingModel: boolean;
}

/** Build the DeepSeek client and request body for one Copilot Chat turn. */
export async function prepareChatRequest({
	authManager,
	extensionVersion,
	modelInfo,
	messages,
	options,
}: PrepareChatRequestArgs): Promise<PreparedChatRequest> {
	const apiKey = await authManager.getApiKey();
	if (!apiKey) {
		throw new Error(t('auth.notConfigured'));
	}
	const baseUrl = resolveBaseUrl();
	const client = new DeepSeekClient(baseUrl, apiKey, extensionVersion, getMaxRetries());
	const modelDef = findModelDefinition(modelInfo.id);
	const isThinkingModel = modelDef?.capabilities.thinking ?? true;
	const toolCalling = modelDef?.capabilities.toolCalling ?? false;
	const toolLimit = typeof toolCalling === 'number' ? toolCalling : DEFAULT_TOOLS_LIMIT;
	const deepseekMessages = convertMessages(messages, isThinkingModel);
	const tools: DeepSeekTool[] | undefined = toolCalling ? convertTools(options.tools ?? []) : undefined;
	if (tools && tools.length > toolLimit) {
		throw new Error(t('request.toolsLimitExceeded', String(toolLimit), String(tools.length)));
	}
	const hasTools = !!(tools && tools.length > 0);

	/**
	 * DeepSeek accepts both a `thinking.type` toggle (enabled/disabled, default enabled) and a
	 * `reasoning_effort` selector (`low`/`high`/`max`).
	 *
	 * Compatibility note: older extension builds used `none` in the picker to mean
	 * `thinking: disabled`. We still accept that legacy value and map it safely.
	 */
	const effortSpec = modelDef?.capabilities.thinkingEffort;
	let thinkingFields: Pick<DeepSeekChatRequest, 'thinking' | 'reasoning_effort'> = {};
	const thinkingMode = resolveThinking(options);
	if (effortSpec) {
		if (thinkingMode === 'disabled' || isLegacyDisabledEffort(options as EffortOptions)) {
			thinkingFields = { thinking: { type: 'disabled' } };
		} else {
			const effort = resolveEffort(options as EffortOptions, effortSpec);
			thinkingFields = { thinking: { type: 'enabled' }, reasoning_effort: effort };
		}
	} else if (isThinkingModel) {
		thinkingFields = { thinking: { type: thinkingMode } };
	}

	const request: DeepSeekChatRequest = {
		model: getApiModelId(modelInfo.id),
		messages: deepseekMessages,
		stream: true,
		tools: hasTools ? tools : undefined,
		tool_choice: hasTools ? 'auto' : undefined,
		max_tokens: getMaxTokens(),
		...thinkingFields,
	};
	const totalRequestChars = countMessageChars(deepseekMessages);
	return { client, request, totalRequestChars, isThinkingModel };
}

type EffortOptions = vscode.ProvideLanguageModelChatResponseOptions & {
	readonly modelConfiguration?: { readonly reasoningEffort?: string };
	readonly configuration?: { readonly reasoningEffort?: string };
};

function resolveEffort(options: EffortOptions, spec: ThinkingEffortSpec): ThinkingEffort {
	const picked = options.modelConfiguration?.reasoningEffort ?? options.configuration?.reasoningEffort;
	const normalized = normalizeEffort(picked);
	return normalized && spec.levels.includes(normalized) ? normalized : spec.default;
}

function normalizeEffort(value: string | undefined): ThinkingEffort | undefined {
	if (value === 'medium') {
		return 'high';
	}
	if (value === 'xhigh') {
		return 'max';
	}
	if (value === 'low' || value === 'high' || value === 'max') {
		return value;
	}
	return undefined;
}

function isLegacyDisabledEffort(options: EffortOptions): boolean {
	const picked = options.modelConfiguration?.reasoningEffort ?? options.configuration?.reasoningEffort;
	return picked === 'none';
}

/** Thinking mode from a per-request override (modelOptions), else the default (enabled). */
function resolveThinking(options: vscode.ProvideLanguageModelChatResponseOptions): ThinkingMode {
	const modelOptions = options.modelOptions as Record<string, unknown> | undefined;
	const override = modelOptions?.['thinking'];
	if (override === 'disabled') {
		return 'disabled';
	}
	return 'enabled';
}
