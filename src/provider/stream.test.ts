import { describe, it, expect, vi } from 'vitest';
import type { IDeepSeekClient, StreamCallbacks } from '../types';

const vscodeMock = vi.hoisted(() => {
	const state: {
		textParts: string[];
		thinkingParts: string[];
		dataParts: Array<{ data: Uint8Array; mimeType: string }>;
		LanguageModelThinkingPart?: new (value: string) => unknown;
	} = {
		textParts: [],
		thinkingParts: [],
		dataParts: [],
		LanguageModelThinkingPart: undefined,
	};
	state.LanguageModelThinkingPart = class {
		constructor(public value: string) {
			state.thinkingParts.push(value);
		}
	};
	return state;
});

const { textParts, thinkingParts, dataParts } = vscodeMock;

vi.mock('vscode', () => ({
	LanguageModelTextPart: class {
		constructor(public value: string) {
			vscodeMock.textParts.push(value);
		}
	},
	get LanguageModelThinkingPart() {
		return vscodeMock.LanguageModelThinkingPart;
	},
	LanguageModelDataPart: class {
		constructor(public data: Uint8Array, public mimeType: string) {
			vscodeMock.dataParts.push({ data, mimeType });
		}
	},
	LanguageModelToolCallPart: class {
		constructor(
			public id: string,
			public name: string,
			public args: object,
		) {}
	},
}));

vi.mock('../i18n', () => ({
	t: (key: string, ...args: string[]) => {
		const strings: Record<string, string> = {
			'request.retry.rateLimited': `DeepSeek is rate limited. Retrying in ${args[0]}s (${args[1]}/${args[2]}).`,
			'request.retry.busy': `DeepSeek is busy. Retrying in ${args[0]}s (${args[1]}/${args[2]}).`,
		};
		return strings[key] ?? key;
	},
}));

vi.mock('../client', () => ({
	createUserFacingError: (error: unknown) => error,
}));

vi.mock('../logger', () => ({
	logger: { warn: vi.fn() },
}));

import { streamChatCompletion } from './stream';

const token = { isCancellationRequested: false, onCancellationRequested: vi.fn() };

function clientWith(callback: (callbacks: StreamCallbacks) => void): IDeepSeekClient {
	return {
		streamChatCompletion: vi.fn(async (_request, callbacks) => {
			callback(callbacks);
		}),
	};
}

function args(client: IDeepSeekClient): Parameters<typeof streamChatCompletion>[0] {
	return {
		prepared: {
			client,
			request: { model: 'deepseek-v4-pro', messages: [], stream: true },
			totalRequestChars: 0,
			isThinkingModel: true,
		},
		progress: { report: vi.fn() },
		token: token as never,
		getCharsPerToken: () => 4,
		setCharsPerToken: vi.fn(),
	};
}

describe('streamChatCompletion retry backoff progress', () => {
	it('reports rate-limit retry as a thinking part', async () => {
		textParts.length = 0;
		thinkingParts.length = 0;
		dataParts.length = 0;
		const client = clientWith((callbacks) => {
			callbacks.onRetryBackoff?.({
				status: 429,
				nextAttempt: 2,
				maxAttempts: 4,
				delayMs: 1500,
			});
		});
		await streamChatCompletion(args(client));
		expect(thinkingParts).toEqual(['DeepSeek is rate limited. Retrying in 2s (2/4).']);
	});

	it('reports 5xx retry with the busy message', async () => {
		textParts.length = 0;
		thinkingParts.length = 0;
		const client = clientWith((callbacks) => {
			callbacks.onRetryBackoff?.({
				status: 503,
				nextAttempt: 3,
				maxAttempts: 4,
				delayMs: 3000,
			});
		});
		await streamChatCompletion(args(client));
		expect(thinkingParts).toEqual(['DeepSeek is busy. Retrying in 3s (3/4).']);
	});
});

describe('streamChatCompletion usage reporting', () => {
	it('maps flat prompt_cache_hit_tokens into prompt_tokens_details.cached_tokens', async () => {
		textParts.length = 0;
		thinkingParts.length = 0;
		dataParts.length = 0;
		const client = clientWith((callbacks) => {
			callbacks.onUsage?.({
				prompt_tokens: 100,
				completion_tokens: 200,
				total_tokens: 300,
				prompt_cache_hit_tokens: 42,
				prompt_cache_miss_tokens: 58,
			});
		});
		await streamChatCompletion(args(client));
		expect(dataParts).toHaveLength(1);
		expect(dataParts[0].mimeType).toBe('usage');
		const json = JSON.parse(new TextDecoder().decode(dataParts[0].data));
		expect(json).toEqual({
			prompt_tokens: 100,
			completion_tokens: 200,
			total_tokens: 300,
			prompt_tokens_details: { cached_tokens: 42 },
		});
	});
});

describe('streamChatCompletion content forwarding', () => {
	it('reports content and thinking as their respective parts', async () => {
		textParts.length = 0;
		thinkingParts.length = 0;
		dataParts.length = 0;
		const client = clientWith((callbacks) => {
			callbacks.onThinking('Let me reason...');
			callbacks.onContent('Answer.');
			callbacks.onDone();
		});
		await streamChatCompletion(args(client));
		expect(thinkingParts).toEqual(['Let me reason...']);
		expect(textParts).toEqual(['Answer.']);
	});
});
