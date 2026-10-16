import * as vscode from 'vscode';
import { AuthManager } from '../auth';
import { UsageClient } from '../client/usage';
import { VENDOR_ID } from '../consts';
import { resolveUsageHost } from '../endpoint';
import { logger } from '../logger';
import { DeepSeekChatProvider } from '../provider';
import { UsageStatusBar } from './usage-bar';

export async function registerProvider(
	context: vscode.ExtensionContext,
): Promise<DeepSeekChatProvider> {
	const authManager = new AuthManager(context);
	const provider = new DeepSeekChatProvider(context, authManager);
	const usageClient = new UsageClient(resolveUsageHost);
	const usageBar = new UsageStatusBar(context, authManager, usageClient);
	context.subscriptions.push(
		vscode.commands.registerCommand('deepseek-copilot.setApiKey', () =>
			provider.configureApiKey(),
		),
		vscode.commands.registerCommand('deepseek-copilot.clearApiKey', () =>
			provider.clearApiKey(),
		),
		vscode.lm.registerLanguageModelChatProvider(VENDOR_ID, provider),
		usageBar,
	);
	await activateCopilotChat();
	provider.refreshModelPicker();
	return provider;
}

async function activateCopilotChat(): Promise<void> {
	try {
		await vscode.extensions.getExtension('github.copilot-chat')?.activate();
	} catch (error) {
		logger.warn('Copilot Chat activation unavailable; model picker refresh may be delayed', error);
	}
}
