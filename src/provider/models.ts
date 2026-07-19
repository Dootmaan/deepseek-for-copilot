import * as vscode from 'vscode';
import { t } from '../i18n';
import type { DeepSeekModel, ThinkingEffortSpec } from '../types';

/** Build the `configurationSchema` block the Copilot host reads for the per-model picker. */
function buildEffortSchema(spec: ThinkingEffortSpec) {
	return {
		properties: {
			reasoningEffort: {
				type: 'string',
				title: t('effort.title'),
				enum: spec.levels,
				enumItemLabels: spec.levels.map((level) => t(`effort.${level}.label`)),
				enumDescriptions: spec.levels.map((level) => t(`effort.${level}.desc`)),
				default: spec.default,
				group: 'navigation',
			},
		},
	} as const;
}

/** Non-public `configurationSchema` field the Copilot host reads at runtime (intersection type). */
type EffortChatInformation = vscode.LanguageModelChatInformation & {
	readonly configurationSchema?: ReturnType<typeof buildEffortSchema>;
};

/** Build the Copilot Chat model picker entry for a DeepSeek model. */
export function toChatInfo(model: DeepSeekModel, hasApiKey: boolean): EffortChatInformation {
	const detail = resolveModelText(model, 'detail') ?? model.detail;
	const tooltip = resolveModelText(model, 'tooltip');
	const spec = model.capabilities.thinkingEffort;
	return {
		id: model.id,
		name: model.name,
		family: model.family,
		version: model.version,
		detail: hasApiKey ? detail : t('auth.apiKeyRequiredDetail'),
		tooltip: hasApiKey ? tooltip : t('auth.apiKeyRequiredDetail'),
		maxInputTokens: model.maxInputTokens,
		maxOutputTokens: model.maxOutputTokens,
		capabilities: {
			toolCalling: model.capabilities.toolCalling,
			imageInput: model.capabilities.imageInput,
		},
		...(spec ? { configurationSchema: buildEffortSchema(spec) } : {}),
	};
}

function resolveModelText(model: DeepSeekModel, field: string): string | undefined {
	const key = `model.${model.id}.${field}`;
	const translated = t(key);
	return translated !== key ? translated : undefined;
}
