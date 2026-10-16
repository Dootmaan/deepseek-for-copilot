import { describe, expect, it, vi } from 'vitest';

const vscodeMock = vi.hoisted(() => ({
	LanguageModelChatMessageRole: {
		User: 1,
		Assistant: 2,
	},
}));

vi.mock('vscode', () => ({
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
	LanguageModelChatMessageRole: vscodeMock.LanguageModelChatMessageRole,
	env: {
		language: 'en',
	},
}));

import * as vscode from 'vscode';
import { convertMessages } from './convert';

describe('convertMessages vision support', () => {
	it('serializes image input as DeepSeek image_url content blocks', () => {
		const image = new vscode.LanguageModelDataPart(new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg');
		const message = {
			role: vscode.LanguageModelChatMessageRole.User,
			content: [
				new vscode.LanguageModelTextPart('Describe '),
				image,
				new vscode.LanguageModelTextPart('please.'),
			],
		};

		const result = convertMessages([message] as never, true, true);
		expect(result).toEqual([
			{
				role: 'user',
				content: [
					{ type: 'text', text: 'Describe ' },
					{ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,/9j/' } },
					{ type: 'text', text: 'please.' },
				],
			},
		]);
	});

	it('rejects image input for non-vision models before sending the request', () => {
		const image = new vscode.LanguageModelDataPart(new Uint8Array([1, 2, 3]), 'image/png');
		const message = {
			role: vscode.LanguageModelChatMessageRole.User,
			content: [image],
		};

		expect(() => convertMessages([message] as never, true, false)).toThrow(
			'This request includes image input, but the selected DeepSeek model does not support images. Switch to DeepSeek V4.1 Flash.',
		);
	});
});
