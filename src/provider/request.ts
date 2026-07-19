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
	 * `reasoning_effort` selector (`high` or `max`). When the picker offers an effort menu we
	 * honor it; otherwise we fall back to the user's global `thinking` setting-style toggle.
	 */
	const effortSpec = modelDef?.capabilities.thinkingEffort;
	let thinkingFields: Pick<DeepSeekChatRequest, 'thinking' | 'reasoning_effort'> = {};
	if (effortSpec) {
		const effort = resolveEffort(options as EffortOptions, effortSpec);
		thinkingFields =
			effort === 'none'
				? { thinking: { type: 'disabled' } }
				: { thinking: { type: 'enabled' }, reasoning_effort: effort };
	} else if (isThinkingModel) {
		thinkingFields = { thinking: { type: resolveThinking(options) } };
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
	readonly modelConfiguration?: { readonly reasoningEffort?: ThinkingEffort };
	readonly configuration?: { readonly reasoningEffort?: ThinkingEffort };
};

function resolveEffort(options: EffortOptions, spec: ThinkingEffortSpec): ThinkingEffort {
	const picked = options.modelConfiguration?.reasoningEffort ?? options.configuration?.reasoningEffort;
	return picked && spec.levels.includes(picked) ? picked : spec.default;
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
