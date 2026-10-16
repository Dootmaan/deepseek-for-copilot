import { describe, expect, it } from 'vitest';
import { MODELS } from './consts';

describe('MODELS', () => {
	it('includes the official DeepSeek V4.1 Flash model with image input enabled', () => {
		const model = MODELS.find((entry) => entry.id === 'deepseek-flash');
		expect(model).toBeDefined();
		expect(model?.capabilities.imageInput).toBe(true);
		expect(model?.capabilities.thinkingEffort?.levels).toEqual(['none', 'low', 'high', 'max']);
	});
});
