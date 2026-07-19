import * as vscode from 'vscode';
import { CONFIG_SECTION, EXTERNAL_URLS } from '../consts';
import { logger } from '../logger';

export function registerCommands(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('deepseek-copilot.getApiKey', () =>
			vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.apiKeys)),
		),
		vscode.commands.registerCommand('deepseek-copilot.openSettings', () =>
			vscode.commands.executeCommand('workbench.action.openSettings', CONFIG_SECTION),
		),
		vscode.commands.registerCommand('deepseek-copilot.showLogs', () => logger.show()),
	);
}
