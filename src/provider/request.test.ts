import { beforeEach, describe, expect, it, vi } from 'vitest';

const vscodeState = vi.hoisted(() => ({
	config: {} as Record<string, unknown>,
	LanguageModelChatMessageRole: {
		User: 1,
		Assistant: 2,
	},
}));

vi.mock('vscode', () => ({
	workspace: {
		getConfiguration: () => ({
			get: (key: string, defaultValue?: unknown) => vscodeState.config[key] ?? defaultValue,
		}),
	},
	env: {
		language: 'en',
	},
	LanguageModelTextPart: class {
		constructor(public value: string) {}
	},
	LanguageModelDataPart: class {
		constructor(
			public data: Uint8Array,
			public mimeType: string,
		) {}
	},
	LanguageModelToolCallPart: class {
		constructor(
			public callId: string,
			public name: string,
			public input: object,
		) {}
	},
	LanguageModelToolResultPart: class {
		constructor(
			public callId: string,
			public content: unknown[],
		) {}
	},
	LanguageModelChatMessageRole: vscodeState.LanguageModelChatMessageRole,
}));

import * as vscode from 'vscode';
import { prepareChatRequest } from './request';

describe('prepareChatRequest', () => {
	beforeEach(() => {
		vscodeState.config = {};
	});

	it('uses the official deepseek-flash id and supports reasoning_effort none', async () => {
		const prepared = await prepareChatRequest({
			authManager: {
				getApiKey: async () => 'sk-test',
				hasApiKey: async () => true,
				promptForApiKey: async () => true,
				deleteApiKey: async () => {},
			},
			extensionVersion: '1.0.3',
			modelInfo: { id: 'deepseek-flash' } as never,
			messages: [
				{
					role: vscode.LanguageModelChatMessageRole.User,
					content: [new vscode.LanguageModelTextPart('Hello')],
				},
			] as never,
			options: {
				tools: [],
				modelConfiguration: { reasoningEffort: 'none' },
			} as never,
			token: { isCancellationRequested: false } as never,
		});

		expect(prepared.request.model).toBe('deepseek-flash');
		expect(prepared.request.reasoning_effort).toBe('none');
		expect(prepared.request.thinking).toEqual({ type: 'disabled' });
	});

	it('maps retired flash vision ids to deepseek-flash while preserving image input', async () => {
		const prepared = await prepareChatRequest({
			authManager: {
				getApiKey: async () => 'sk-test',
				hasApiKey: async () => true,
				promptForApiKey: async () => true,
				deleteApiKey: async () => {},
			},
			extensionVersion: '1.0.3',
			modelInfo: { id: 'deepseek-v4-flash-vision-exp' } as never,
			messages: [
				{
					role: vscode.LanguageModelChatMessageRole.User,
					content: [
						new vscode.LanguageModelTextPart('Describe this image'),
						new vscode.LanguageModelDataPart(new Uint8Array([1, 2, 3]), 'image/png'),
					],
				},
			] as never,
			options: {
				tools: [],
				modelConfiguration: { reasoningEffort: 'minimal' },
			} as never,
			token: { isCancellationRequested: false } as never,
		});

		expect(prepared.request.model).toBe('deepseek-flash');
		expect(prepared.request.reasoning_effort).toBe('low');
		expect(prepared.request.messages[0]).toEqual({
			role: 'user',
			content: [
				{ type: 'text', text: 'Describe this image' },
				{ type: 'image_url', image_url: { url: 'data:image/png;base64,AQID' } },
			],
		});
	});
});
