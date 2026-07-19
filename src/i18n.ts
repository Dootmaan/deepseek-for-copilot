import * as vscode from 'vscode';

/** Runtime UI strings (toasts, prompts, errors, picker labels). */
const en: Record<string, string> = {
	// Model picker
	'model.deepseek-v4-pro.detail': 'Flagship 1.6T MoE model, 1M context',
	'model.deepseek-v4-pro.tooltip':
		'DeepSeek V4-Pro — flagship 1.6T MoE model (49B active), 1M context, selectable thinking effort. Best for hard coding, math, and agentic tasks.',
	'model.deepseek-v4-flash.detail': 'Fast, cost-effective 284B MoE model, 1M context',
	'model.deepseek-v4-flash.tooltip':
		'DeepSeek V4-Flash — 284B MoE model (13B active), 1M context, selectable thinking effort. Fast and economical; performance approaches V4-Pro.',
	'model.custom.detail': 'Custom model',

	// Auth
	'auth.apiKeyRequiredDetail': 'Run "DeepSeek: Set API Key" to configure.',
	'auth.prompt':
		'Enter your DeepSeek API key. Create one at platform.deepseek.com/api_keys.',
	'auth.placeholder': 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
	'auth.emptyValidation': 'API key cannot be empty',
	'auth.saved': 'DeepSeek API key saved.',
	'auth.removed': 'DeepSeek API key removed.',
	'auth.notConfigured': 'DeepSeek API key not configured. Run "DeepSeek: Set API Key" from the Command Palette.',

	// Thinking effort control
	'effort.title': 'Thinking Effort',
	'effort.none.label': 'None',
	'effort.none.desc': 'Disable thinking — fastest, lowest cost',
	'effort.high.label': 'High',
	'effort.high.desc': 'Balanced reasoning (default, recommended)',
	'effort.max.label': 'Max',
	'effort.max.desc': 'Deepest reasoning — best for hard coding, uses more tokens',

	// Request limits
	'request.toolsLimitExceeded':
		'DeepSeek supports at most {0} tools in one request, but this request has {1}. Use VS Code Configure Tools to disable tools you rarely use.',
	'request.retry.rateLimited': 'DeepSeek is rate limited. Retrying in {0}s ({1}/{2}).',
	'request.retry.busy': 'DeepSeek is busy. Retrying in {0}s ({1}/{2}).',

	// HTTP errors
	'error.http.400': '[{0}] Invalid request. Check the request parameters.',
	'error.http.401':
		'[{0}] Authentication failed. Check your DeepSeek API key, or create one at platform.deepseek.com.',
	'error.http.401.withCreateApiKeyLink':
		'[{0}] Authentication failed. Check your DeepSeek API key, or [create one]({1}).',
	'error.http.402': '[{0}] Your DeepSeek balance is used up. Top up at platform.deepseek.com/usage.',
	'error.http.404': '[{0}] Model or endpoint not found. Check the model id and Base URL setting.',
	'error.http.422': '[{0}] Invalid parameters. Check the request parameters.',
	'error.http.429': '[{0}] Too many requests. Slow down and try again.',
	'error.http.500': '[{0}] DeepSeek server error. Retry after a short wait.',
	'error.http.503': '[{0}] DeepSeek service is overloaded. Retry after a short wait.',
	'error.http.generic': '[{0}] The service returned an error response.',

	// Network errors
	'error.network.dns':
		'[{0}] DNS lookup failed. Check your network connection, firewall, proxy settings, or custom Base URL.',
	'error.network.unreachable':
		'[{0}] The target is unreachable or refused the connection. Check your Base URL, proxy, network, or firewall.',
	'error.network.interrupted':
		'[{0}] The connection was interrupted. Check your network, firewall, or proxy, or try again later.',
	'error.network.timeout':
		'[{0}] Connection timed out. Try again later, or check your network, firewall, or proxy.',
	'error.network.tls':
		'[{0}] TLS/certificate verification failed. Check your proxy settings, certificates, or custom Base URL.',
	'error.network.aborted':
		'[{0}] The request was aborted. If you did not cancel it, check your network or proxy, or try again later.',
	'error.network.protocol':
		'[{0}] The HTTP connection or response parsing failed. Check your proxy, custom Base URL, or service response.',
	'error.network.configuration':
		'[{0}] The request configuration is invalid. Check your custom Base URL or extension settings.',
	'error.network.generic':
		'[{0}] Network request failed. Check your network connection, firewall, proxy settings, or custom Base URL.',
	'error.unknown': 'DeepSeek request failed: {0}',

	// Error action buttons
	'error.action.setApiKey': 'Set API Key',
	'error.action.createApiKey': 'Create API Key',
	'error.action.viewDetails': 'Show Logs',

	// Lifecycle
	'extension.activateFailed': 'DeepSeek failed to activate. Run "DeepSeek: Show Logs" for details.',

	// Usage status bar
	'usage.status.loading': 'Refreshing…',
	'usage.status.ok.short': '$(wallet) DeepSeek {0}{1}',
	'usage.status.no-data': 'No usage data for this key.',
	'usage.status.auth-error': 'API key invalid. Click to set your key.',
	'usage.status.network-error': 'Usage unavailable (offline).',
	'usage.status.server-error': 'Usage request failed. Try again later.',
	'usage.tooltip.lastUpdated': 'Last updated: {0}',
	'usage.tooltip.offline': 'Usage unavailable (offline). Showing last data.',
	'usage.tooltip.insufficient': 'Balance insufficient for API calls.',
	'usage.panel.title': 'DeepSeek Usage',
	'usage.panel.refresh': 'Refresh',
	'usage.panel.setKey': 'Set API Key',
	'usage.panel.offline': 'Offline · showing last data',
	'usage.panel.unavailable': 'Usage unavailable. Use a DeepSeek API key (no `baseUrl` override) to view balance.',
	'usage.panel.lastUpdated': 'Last updated: {0}',
	'usage.balance.section': 'Account Balance',
	'usage.balance.available': 'Available',
	'usage.balance.total': 'Total',
	'usage.balance.granted': 'Granted',
	'usage.balance.toppedUp': 'Topped Up',
};

const zh: Record<string, string> = {
	'model.deepseek-v4-pro.detail': '旗舰 1.6T MoE 模型，100 万上下文',
	'model.deepseek-v4-pro.tooltip':
		'DeepSeek V4-Pro — 旗舰 1.6T MoE 模型（49B 激活参数），100 万上下文，可选思考强度。适合复杂编程、数学与智能体任务。',
	'model.deepseek-v4-flash.detail': '快速、经济的 284B MoE 模型，100 万上下文',
	'model.deepseek-v4-flash.tooltip':
		'DeepSeek V4-Flash — 284B MoE 模型（13B 激活参数），100 万上下文，可选思考强度。速度快、成本低，性能接近 V4-Pro。',
	'model.custom.detail': '自定义模型',

	'auth.apiKeyRequiredDetail': '请运行“DeepSeek: Set API Key”进行配置。',
	'auth.prompt': '请输入你的 DeepSeek API Key。可在 platform.deepseek.com/api_keys 创建。',
	'auth.placeholder': 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
	'auth.emptyValidation': 'API Key 不能为空',
	'auth.saved': 'DeepSeek API Key 已保存。',
	'auth.removed': 'DeepSeek API Key 已删除。',
	'auth.notConfigured': '尚未配置 DeepSeek API Key。请在命令面板运行“DeepSeek: Set API Key”。',

	'effort.title': '思考强度',
	'effort.none.label': '关闭',
	'effort.none.desc': '不进行思考——最快、消耗最低',
	'effort.high.label': '高',
	'effort.high.desc': '均衡推理（默认，推荐）',
	'effort.max.label': '最高',
	'effort.max.desc': '最深入的推理——适合复杂编程，消耗更多 token',

	'request.toolsLimitExceeded':
		'DeepSeek 单次请求最多支持 {0} 个工具，但本次请求包含 {1} 个。请使用 VS Code 的“配置工具”关闭不常用的工具。',
	'request.retry.rateLimited': 'DeepSeek 请求过于频繁。将在 {0} 秒后重试（{1}/{2}）。',
	'request.retry.busy': 'DeepSeek 服务繁忙。将在 {0} 秒后重试（{1}/{2}）。',

	'error.http.400': '[{0}] 请求无效。请检查请求参数。',
	'error.http.401': '[{0}] 身份验证失败。请检查你的 DeepSeek API Key，或在 platform.deepseek.com 创建一个。',
	'error.http.401.withCreateApiKeyLink': '[{0}] 身份验证失败。请检查你的 DeepSeek API Key，或[创建一个]({1})。',
	'error.http.402': '[{0}] 你的 DeepSeek 余额已用尽。请前往 platform.deepseek.com/usage 充值。',
	'error.http.404': '[{0}] 未找到模型或接口。请检查模型 ID 与 Base URL 设置。',
	'error.http.422': '[{0}] 参数无效。请检查请求参数。',
	'error.http.429': '[{0}] 请求过于频繁。请放慢速度后重试。',
	'error.http.500': '[{0}] DeepSeek 服务器错误。请稍后重试。',
	'error.http.503': '[{0}] DeepSeek 服务繁忙。请稍后重试。',
	'error.http.generic': '[{0}] 服务返回了错误响应。',

	'error.network.dns': '[{0}] DNS 解析失败。请检查网络连接、防火墙、代理设置或自定义 Base URL。',
	'error.network.unreachable': '[{0}] 目标不可达或拒绝连接。请检查 Base URL、代理、网络或防火墙。',
	'error.network.interrupted': '[{0}] 连接中断。请检查网络、防火墙或代理，或稍后重试。',
	'error.network.timeout': '[{0}] 连接超时。请稍后重试，或检查网络、防火墙或代理。',
	'error.network.tls': '[{0}] TLS/证书校验失败。请检查代理设置、证书或自定义 Base URL。',
	'error.network.aborted': '[{0}] 请求已中止。若非你主动取消，请检查网络或代理，或稍后重试。',
	'error.network.protocol': '[{0}] HTTP 连接或响应解析失败。请检查代理、自定义 Base URL 或服务响应。',
	'error.network.configuration': '[{0}] 请求配置无效。请检查自定义 Base URL 或扩展设置。',
	'error.network.generic': '[{0}] 网络请求失败。请检查网络连接、防火墙、代理设置或自定义 Base URL。',
	'error.unknown': 'DeepSeek 请求失败：{0}',

	'error.action.setApiKey': '设置 API Key',
	'error.action.createApiKey': '创建 API Key',
	'error.action.viewDetails': '查看日志',

	'extension.activateFailed': 'DeepSeek 激活失败。请运行“DeepSeek: Show Logs”查看详情。',

	'usage.status.loading': '刷新中…',
	'usage.status.ok.short': '$(wallet) DeepSeek {0}{1}',
	'usage.status.no-data': '此 Key 暂无用量数据。',
	'usage.status.auth-error': 'API Key 无效。点击设置 Key。',
	'usage.status.network-error': '用量不可用（离线）。',
	'usage.status.server-error': '用量请求失败，请稍后重试。',
	'usage.tooltip.lastUpdated': '最后更新：{0}',
	'usage.tooltip.offline': '用量不可用（离线），显示上次数据。',
	'usage.tooltip.insufficient': '余额不足，无法继续调用 API。',
	'usage.panel.title': 'DeepSeek 用量',
	'usage.panel.refresh': '刷新',
	'usage.panel.setKey': '设置 API Key',
	'usage.panel.offline': '离线 · 显示上次数据',
	'usage.panel.unavailable': '用量不可用。请使用 DeepSeek API Key（不设置 `baseUrl` 覆盖）查看余额。',
	'usage.panel.lastUpdated': '最后更新：{0}',
	'usage.balance.section': '账户余额',
	'usage.balance.available': '可用',
	'usage.balance.total': '总额',
	'usage.balance.granted': '赠送',
	'usage.balance.toppedUp': '充值',
};

const bundles: Record<string, Record<string, string>> = { en, 'zh-cn': zh };

/** Look up a localized string by key, falling back to English then the key itself. */
export function t(key: string, ...args: unknown[]): string {
	const lang = vscode.env.language;
	const bundle = bundles[lang] ?? bundles['en'];
	const template = bundle[key] ?? bundles['en'][key] ?? key;
	if (args.length === 0) {
		return template;
	}
	return template.replace(/\{(\d+)\}/g, (_, index: string) => {
		const value = args[Number(index)];
		return value === undefined ? `{${index}}` : String(value);
	});
}
