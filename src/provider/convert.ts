import * as vscode from 'vscode';
import { LANGUAGE_MODEL_CHAT_SYSTEM_ROLE } from '../consts';
import { safeStringify } from '../json';
import { t } from '../i18n';
import type { DeepSeekContentPart, DeepSeekMessage, DeepSeekTool, DeepSeekToolCall } from '../types';

/**
 * A `LanguageModelThinkingPart`-shaped value. The thinking part is a proposed
 * VS Code API, so it is feature-detected and read through this narrow shape
 * instead of importing the type directly.
 */
interface ThinkingPartLike {
	value: string | string[];
}

interface PendingToolResult {
	callId: string;
	content: string;
}

const IMAGE_CONTENT_ESTIMATED_CHARS = 1020;

/** Convert VS Code chat messages to DeepSeek (OpenAI-compatible) wire messages. */
export function convertMessages(
	messages: readonly vscode.LanguageModelChatRequestMessage[],
	isThinkingModel: boolean,
	supportsImageInput: boolean,
): DeepSeekMessage[] {
	const result: DeepSeekMessage[] = [];
	for (const message of messages) {
		const role = mapRole(message.role);
		let content = '';
		const contentParts: DeepSeekContentPart[] = [];
		let hasImageInput = false;
		let thinkingContent = '';
		const toolCalls: DeepSeekToolCall[] = [];
		const toolResults: PendingToolResult[] = [];
		for (const part of message.content) {
			if (part instanceof vscode.LanguageModelTextPart) {
				content += part.value;
				if (hasImageInput) {
					contentParts.push({ type: 'text', text: part.value });
				}
			} else if (part instanceof vscode.LanguageModelDataPart && part.mimeType.startsWith('image/')) {
				if (role !== 'user') {
					throw new Error(t('request.imageRoleUnsupported'));
				}
				if (!supportsImageInput) {
					throw new Error(t('request.imageModelRequired'));
				}
				if (!hasImageInput && content) {
					contentParts.push({ type: 'text', text: content });
				}
				hasImageInput = true;
				contentParts.push({
					type: 'image_url',
					image_url: {
						url: toDataUrl(part.data, part.mimeType),
					},
				});
			} else if (isThinkingPart(part)) {
				thinkingContent += normalizeThinkingText(part.value);
			} else if (part instanceof vscode.LanguageModelToolCallPart) {
				toolCalls.push({
					id: part.callId,
					type: 'function',
					function: {
						name: part.name,
						arguments: safeStringify(part.input),
					},
				});
			} else if (part instanceof vscode.LanguageModelToolResultPart) {
				let toolContent = '';
				for (const item of part.content) {
					if (item instanceof vscode.LanguageModelTextPart) {
						toolContent += item.value;
					}
				}
				toolResults.push({
					callId: part.callId,
					content: toolContent || safeStringify(part.content),
				});
			}
		}
		if (role === 'assistant') {
			if (content || toolCalls.length > 0) {
				const msg: DeepSeekMessage = {
					role: 'assistant',
					content: content || '',
				};
				if (toolCalls.length > 0) {
					msg.tool_calls = toolCalls;
				}
				/**
				 * DeepSeek requires `reasoning_content` to be passed back across turns that
				 * performed a tool call (otherwise 400). When thinking is disabled, the model
				 * never emits reasoning, so we never preserve it either.
				 */
				if (isThinkingModel && thinkingContent) {
					msg.reasoning_content = thinkingContent;
				}
				result.push(msg);
			}
		} else if (hasImageInput) {
			if (contentParts.length > 0) {
				result.push({
					role,
					content: contentParts,
				});
			}
		} else if (content) {
			result.push({
				role,
				content,
			});
		}
		for (const toolResult of toolResults) {
			result.push({
				role: 'tool',
				content: toolResult.content,
				tool_call_id: toolResult.callId,
			});
		}
	}
	return result;
}

/** Map a VS Code message role to a DeepSeek role (OpenAI-compatible). */
export function mapRole(
	role: vscode.LanguageModelChatMessageRole,
): 'system' | 'user' | 'assistant' {
	const value = role as number;
	if (value === vscode.LanguageModelChatMessageRole.Assistant) {
		return 'assistant';
	}
	if (value === LANGUAGE_MODEL_CHAT_SYSTEM_ROLE) {
		return 'system';
	}
	return 'user';
}

/** Convert VS Code tool definitions to DeepSeek tool definitions. */
export function convertTools(tools: readonly vscode.LanguageModelChatTool[]): DeepSeekTool[] {
	return tools.map((tool) => ({
		type: 'function',
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.inputSchema,
		},
	}));
}

/** Sum content, reasoning, and tool-call chars to calibrate chars-per-token. */
export function countMessageChars(messages: DeepSeekMessage[]): number {
	let total = 0;
	for (const message of messages) {
		total += contentChars(message.content);
		total += message.reasoning_content?.length ?? 0;
		if (message.tool_calls) {
			for (const toolCall of message.tool_calls) {
				total += toolCall.function?.name?.length ?? 0;
				total += toolCall.function?.arguments?.length ?? 0;
			}
		}
	}
	return total;
}

function isThinkingPart(part: unknown): part is ThinkingPartLike {
	const ctor = (vscode as { LanguageModelThinkingPart?: unknown }).LanguageModelThinkingPart;
	return typeof ctor === 'function' && part instanceof (ctor as new (...args: never[]) => object);
}

function normalizeThinkingText(value: string | string[]): string {
	return Array.isArray(value) ? value.join('') : value;
}

function contentChars(content: DeepSeekMessage['content']): number {
	if (typeof content === 'string') {
		return content.length;
	}
	let total = 0;
	for (const part of content) {
		if (part.type === 'text') {
			total += part.text.length;
		} else {
			total += IMAGE_CONTENT_ESTIMATED_CHARS;
		}
	}
	return total;
}

function toDataUrl(data: Uint8Array, mimeType: string): string {
	return `data:${mimeType};base64,${Buffer.from(data).toString('base64')}`;
}
